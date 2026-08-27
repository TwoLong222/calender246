// GroupChatService — Phần trò chuyện của nhóm.
// Lo việc hiện tin nhắn, gửi/sửa/thu hồi tin, đếm tin chưa đọc và báo "đang gõ".

import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../auth/supabase.service';
import { NotificationService } from '../notifications/notification.service';
import { GroupsApiService } from './groups-api.service';
import { GroupsStateService } from './groups-state.service';
import { GroupRealtimeService, ChatMessage } from './realtime.service';
import { GroupMessage, SendMessagePayload } from './groups.types';

/** Key localStorage lưu danh sách nhóm đã tắt thông báo. */
const MUTED_KEY = 'group-chat-muted';

const PAGE_SIZE = 30;
const TYPING_TTL = 4000; // ms — "đang gõ" tự ẩn nếu không có tín hiệu mới
const TYPING_THROTTLE = 1500; // ms — giãn cách tối thiểu giữa 2 lần báo "đang gõ"
// Dự phòng khi socket không real-time được (vd dev 2 máy dùng 2 backend riêng):
// âm thầm tải lại tin mới nhất / số chưa đọc theo chu kỳ, không cần F5.
const POLL_INTERVAL = 4000; // ms — nhóm đang mở chat
const UNREAD_POLL_INTERVAL = 15000; // ms — badge chưa đọc của mọi nhóm

@Injectable({ providedIn: 'root' })
export class GroupChatService {
  private readonly api = inject(GroupsApiService);
  private readonly realtime = inject(GroupRealtimeService);
  private readonly supabase = inject(SupabaseService);
  private readonly notifications = inject(NotificationService);
  private readonly groupsState = inject(GroupsStateService);

  /** Tin nhắn theo nhóm: groupId -> danh sách (cũ -> mới) */
  private readonly messages = signal<Record<string, GroupMessage[]>>({});
  /** Số tin chưa đọc theo nhóm */
  readonly unread = signal<Record<string, number>>({});
  /** Email đang gõ theo nhóm */
  readonly typing = signal<Record<string, string[]>>({});
  /** Còn tin cũ hơn để tải không (cho nút "Xem thêm") */
  readonly hasMore = signal<Record<string, boolean>>({});
  readonly loading = signal<Record<string, boolean>>({});
  readonly error = signal<string | null>(null);

  /** Nhóm có khung chat đang mở (để đánh dấu đã đọc, không cộng chưa đọc) */
  private readonly openGroupId = signal<string | null>(null);

  /** Tổng số tin chưa đọc (mọi nhóm) — cho tiêu đề tab/thông báo nếu cần */
  readonly totalUnread = computed(() => Object.values(this.unread()).reduce((a, b) => a + b, 0));

  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastTypingSent = 0;
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.realtime.chat$.subscribe((m) => this.applyRealtime(m));
    this.realtime.typing$.subscribe(({ groupId, email }) => this.addTyping(groupId, email));
    setInterval(() => this.loadUnread(), UNREAD_POLL_INTERVAL);
  }

  private get myId(): string | null {
    return this.supabase.user()?.id ?? null;
  }
  private get myEmail(): string {
    return (this.supabase.user()?.email ?? '').toLowerCase();
  }

  /** Danh sách tin của 1 nhóm (dùng trong UI) */
  messagesOf(groupId: string): GroupMessage[] {
    return this.messages()[groupId] ?? [];
  }

  unreadOf(groupId: string): number {
    return this.unread()[groupId] ?? 0;
  }

  // ---------- Tắt thông báo theo từng nhóm ----------
  // Lưu trên trình duyệt (mỗi máy một kiểu), không đụng database — đây là sở thích cá nhân
  // chứ không phải dữ liệu chung của nhóm.
  private readonly muted = signal<Set<string>>(new Set(this.loadMuted()));

  private loadMuted(): string[] {
    try {
      const raw = localStorage.getItem(MUTED_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return []; // localStorage bị chặn / dữ liệu hỏng -> coi như không tắt nhóm nào
    }
  }

  /** Nhóm này có đang tắt thông báo không. */
  isMuted(groupId: string): boolean {
    return this.muted().has(groupId);
  }

  /** Bật/tắt thông báo cho 1 nhóm. */
  toggleMuted(groupId: string): void {
    this.muted.update((s) => {
      const next = new Set(s);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      try {
        localStorage.setItem(MUTED_KEY, JSON.stringify([...next]));
      } catch {
        /* không lưu được thì thôi, phiên này vẫn đúng */
      }
      return next;
    });
  }

  typingOf(groupId: string): string[] {
    return this.typing()[groupId] ?? [];
  }

  // ---------- Tải dữ liệu ----------
  /** Nạp số tin chưa đọc mọi nhóm — gọi khi mở trang lịch, sau đó tự lặp lại theo poll ngầm. */
  loadUnread(): void {
    this.api.unread().subscribe({
      next: (map) => this.unread.set(map ?? {}),
      error: () => {},
    });
  }

  /** Mở khung chat của 1 nhóm: tải lịch sử (nếu chưa) + đánh dấu đã đọc. */
  open(groupId: string): void {
    this.openGroupId.set(groupId);
    if (this.messages()[groupId] === undefined) this.loadHistory(groupId);
    this.markRead(groupId);
    this.startPolling(groupId);
  }

  close(): void {
    this.openGroupId.set(null);
    this.stopPolling();
  }

  /** Âm thầm tải lại tin mới nhất mỗi vài giây — không hiện loading, không hiện lỗi. */
  private startPolling(groupId: string): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.refreshSilently(groupId), POLL_INTERVAL);
  }

  private stopPolling(): void {
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  private refreshSilently(groupId: string): void {
    this.api.listMessages(groupId, undefined, PAGE_SIZE).subscribe({
      next: (list) => {
        for (const msg of list) this.upsert(groupId, msg);
        if (this.openGroupId() === groupId) this.markRead(groupId);
      },
      error: () => {}, // im lặng — thử lại ở lần poll sau
    });
  }

  private loadHistory(groupId: string): void {
    this.setLoading(groupId, true);
    this.api.listMessages(groupId, undefined, PAGE_SIZE).subscribe({
      next: (list) => {
        this.messages.update((m) => ({ ...m, [groupId]: list }));
        this.hasMore.update((h) => ({ ...h, [groupId]: list.length >= PAGE_SIZE }));
        this.setLoading(groupId, false);
      },
      error: () => {
        this.error.set('Không tải được tin nhắn.');
        this.setLoading(groupId, false);
      },
    });
  }

  /** Tải thêm tin CŨ hơn (cuộn lên đầu). */
  loadOlder(groupId: string): void {
    const list = this.messages()[groupId] ?? [];
    if (!list.length || this.loading()[groupId]) return;
    const before = list[0].created_at;
    this.setLoading(groupId, true);
    this.api.listMessages(groupId, before, PAGE_SIZE).subscribe({
      next: (older) => {
        this.messages.update((m) => ({ ...m, [groupId]: [...older, ...(m[groupId] ?? [])] }));
        this.hasMore.update((h) => ({ ...h, [groupId]: older.length >= PAGE_SIZE }));
        this.setLoading(groupId, false);
      },
      error: () => this.setLoading(groupId, false),
    });
  }

  // ---------- Gửi / sửa / thu hồi ----------
  /**
   * Gửi tin. `extra` cho phép kèm tin đang được trả lời.
   */
  send(groupId: string, content: string, extra?: Omit<SendMessagePayload, 'content'>): void {
    const text = content.trim();
    if (!text) return;

    // Optimistic: hiện ngay 1 tin tạm, sau đó thay bằng bản chính thức từ server.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const temp: GroupMessage = {
      id: tempId,
      group_id: groupId,
      sender_id: this.myId ?? '',
      sender_email: this.myEmail || null,
      content: text,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      reply_to_id: extra?.replyToId ?? null,
    };
    this.upsert(groupId, temp);

    this.api.sendMessage(groupId, { content: text, ...extra }).subscribe({
      next: (saved) => {
        this.removeById(groupId, tempId);
        this.upsert(groupId, saved); // bản broadcast (nếu tới) trùng id -> không nhân đôi
      },
      error: () => {
        this.removeById(groupId, tempId);
        this.error.set('Không gửi được tin nhắn.');
      },
    });
  }

  /** Tin gốc của 1 tin trả lời (để hiện phần trích dẫn); null nếu không tìm thấy. */
  parentOf(groupId: string, msg: GroupMessage): GroupMessage | null {
    if (!msg.reply_to_id) return null;
    return this.messagesOf(groupId).find((m) => m.id === msg.reply_to_id) ?? null;
  }

  edit(groupId: string, messageId: string, content: string): void {
    const text = content.trim();
    if (!text) return;
    this.api.editMessage(groupId, messageId, text).subscribe({
      next: (saved) => this.upsert(groupId, saved),
      error: () => this.error.set('Không sửa được tin nhắn.'),
    });
  }

  remove(groupId: string, messageId: string): void {
    this.api.deleteMessage(groupId, messageId).subscribe({
      next: (saved) => this.upsert(groupId, saved),
      error: () => this.error.set('Không thu hồi được tin nhắn.'),
    });
  }

  /** Báo "đang gõ" (đã giãn cách để không spam). */
  notifyTyping(groupId: string): void {
    const now = Date.now();
    if (now - this.lastTypingSent < TYPING_THROTTLE) return;
    this.lastTypingSent = now;
    this.realtime.sendTyping(groupId);
  }

  isMine(msg: GroupMessage): boolean {
    return !!this.myId && msg.sender_id === this.myId;
  }

  // ---------- Nội bộ ----------
  private markRead(groupId: string): void {
    this.unread.update((u) => (u[groupId] ? { ...u, [groupId]: 0 } : u));
    this.api.markRead(groupId).subscribe({ next: () => {}, error: () => {} });
  }

  private applyRealtime(m: ChatMessage): void {
    const groupId = m.message.group_id;
    this.upsert(groupId, m.message);

    if (m.type === 'new') {
      if (this.openGroupId() === groupId) {
        this.markRead(groupId); // đang mở -> coi như đã đọc
      } else if (!this.isMine(m.message)) {
        this.unread.update((u) => ({ ...u, [groupId]: (u[groupId] ?? 0) + 1 }));
        this.notifyNewMessage(groupId, m.message); // toast trong app + desktop (nếu tab ẩn)
      }
    }
  }

  /** Bắn thông báo cho 1 tin nhắn mới ở nhóm mà người dùng KHÔNG đang mở chat. */
  private notifyNewMessage(groupId: string, msg: GroupMessage): void {
    // Nhóm đã tắt thông báo -> im lặng. Badge số chưa đọc vẫn cộng bình thường để không
    // mất dấu tin mới, chỉ là không bật toast/thông báo hệ thống nữa.
    if (this.isMuted(groupId)) return;
    const groupName = this.groupsState.groups().find((g) => g.id === groupId)?.name ?? 'Nhóm';
    const sender = (msg.sender_email ?? '').split('@')[0] || 'Ai đó';
    this.notifications.notifyMessage(`💬 ${groupName}`, `${sender}: ${msg.content}`, groupId);
  }

  /** Thêm hoặc thay tin theo id, giữ thứ tự cũ -> mới. */
  private upsert(groupId: string, msg: GroupMessage): void {
    this.messages.update((m) => {
      const list = m[groupId];
      if (list === undefined) return m; // chưa mở nhóm này -> không giữ, tránh phình bộ nhớ
      const idx = list.findIndex((x) => x.id === msg.id);
      let next: GroupMessage[];
      if (idx >= 0) {
        next = [...list];
        next[idx] = msg;
      } else {
        next = [...list, msg];
      }
      next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return { ...m, [groupId]: next };
    });
  }

  private removeById(groupId: string, id: string): void {
    this.messages.update((m) => {
      const list = m[groupId];
      if (!list) return m;
      return { ...m, [groupId]: list.filter((x) => x.id !== id) };
    });
  }

  private addTyping(groupId: string, email: string): void {
    const normalized = (email ?? '').toLowerCase();
    if (!normalized || normalized === this.myEmail) return;

    this.typing.update((t) => {
      const cur = t[groupId] ?? [];
      return cur.includes(normalized) ? t : { ...t, [groupId]: [...cur, normalized] };
    });

    const key = `${groupId}::${normalized}`;
    clearTimeout(this.typingTimers.get(key));
    this.typingTimers.set(
      key,
      setTimeout(() => {
        this.typing.update((t) => ({ ...t, [groupId]: (t[groupId] ?? []).filter((e) => e !== normalized) }));
        this.typingTimers.delete(key);
      }, TYPING_TTL),
    );
  }

  private setLoading(groupId: string, value: boolean): void {
    this.loading.update((l) => ({ ...l, [groupId]: value }));
  }
}
