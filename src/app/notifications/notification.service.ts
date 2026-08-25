// NotificationService: nhắc lịch NGAY TRONG APP.
// Cứ 30 giây (và mỗi khi danh sách event đổi) quét các sự kiện SẮP bắt đầu trong 10 phút tới
// mà chưa nhắc -> hiện toast góc màn hình + thông báo trình duyệt (nếu người dùng cho phép).
// Mỗi sự kiện chỉ nhắc 1 lần.

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { CalendarStateService } from '../calendar/calendar-state.service';
import { CalendarEvent } from '../calendar/calendar.types';
import { AttachmentsApiService } from '../calendar/attachments-api.service';
import { SupabaseService } from '../auth/supabase.service';
import { TranslateService } from '../i18n/translate.service';
import { SettingsService } from '../settings/settings.service';

export interface Toast {
  id: string;
  /** 'event' nhắc lịch; 'file' tài liệu; 'chat' tin nhắn; 'invite' lời mời; 'cancelled' hủy; 'changed' cập nhật; 'shared' được chia sẻ lịch. */
  kind: 'event' | 'file' | 'chat' | 'invite' | 'cancelled' | 'changed' | 'shared';
  title: string;
  /** Dòng phụ: giờ bắt đầu (event), tên sự kiện (file), hoặc email người mời (invite). */
  detail?: string;
  /** Nội dung tin nhắn (chat). */
  body?: string;
  /** ID sự kiện — dùng cho toast 'invite' để bấm Đồng ý/Từ chối ngay. */
  eventId?: string;
}

/** Thông báo LƯU LẠI trong chuông (khác toast thoáng qua). */
export interface ChangeNotice {
  id: string;
  eventId: string;
  title: string;
  /** Các dòng mô tả thay đổi, vd: "Ngày giờ bắt đầu → 14:00 1/9". */
  changes: string[];
  at: number;
}
export interface CancelNotice {
  id: string;
  title: string;
  at: number;
}
/** Nhắc lịch tới giờ — do BACKEND tạo (bảng notifications), lưu trong chuông. */
export interface ReminderNotice {
  id: string;
  title: string;
  body: string;
  eventId: string | null;
  at: number;
}

/** 1 dòng trong LỊCH SỬ THÔNG BÁO (khác toast/chuông: lưu MỌI thông báo từng bắn ra,
 *  kể cả đã đọc/đã tắt, để xem lại sau — lưu VĨNH VIỄN trên trình duyệt, không tự xóa). */
export interface HistoryEntry {
  id: string;
  kind: Toast['kind'];
  title: string;
  detail?: string;
  body?: string;
  at: number;
  /** Sự kiện liên quan (nếu có) -> bấm vào dòng lịch sử sẽ nhảy tới sự kiện đó. */
  eventId?: string;
}

const SEEN_FILES_KEY = 'notified-file-open';
const HISTORY_KEY = 'notif-history';
/** Giới hạn số dòng lưu tối đa (không giới hạn thời gian) — phòng localStorage phình to vô hạn. */
const HISTORY_MAX_ITEMS = 1000;

const CHANGE_NOTICES_KEY = 'notif-change-notices';
const CANCEL_NOTICES_KEY = 'notif-cancel-notices';
/** Chuông thông báo (Bị sửa/Bị hủy) chỉ giữ tối đa 3 ngày — quá hạn tự động rơi khỏi chuông
 *  dù chưa bấm xóa (nhưng vẫn còn nguyên trong trang Lịch sử thông báo, lưu vĩnh viễn). */
const BELL_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** Mục "Sự kiện gần đây" trong chuông: tối đa 5 thông báo mới nhất trong 3 ngày (mọi loại). */
const RECENT_MAX_ITEMS = 5;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly state = inject(CalendarStateService);
  private readonly attachmentsApi = inject(AttachmentsApiService);
  private readonly supabase = inject(SupabaseService);
  private readonly tr = inject(TranslateService);
  private readonly settings = inject(SettingsService);

  /** Ảnh chụp MỌI sự kiện đang thấy (id -> thông tin) để phát hiện HỦY/ĐỔI ở lần quét sau. */
  private readonly invitedSnapshot = new Map<string, { title: string; start: number; end: number; location: string; description: string; myCanEdit: boolean }>();
  /** Id các sự kiện DO CHÍNH MÌNH tạo — để khi chúng biến mất thì không báo "bị huỷ". */
  private readonly ownEventIds = new Set<string>();

  /** Danh sách thông báo LƯU trong chuông: sự kiện bị SỬA và bị HỦY. Lưu localStorage, tự rơi
   *  khỏi chuông sau 3 ngày (xem BELL_MAX_AGE_MS) — khác history bên dưới (lưu vĩnh viễn). */
  readonly changeNotices = signal<ChangeNotice[]>(this.loadBellList(CHANGE_NOTICES_KEY));
  readonly cancelNotices = signal<CancelNotice[]>(this.loadBellList(CANCEL_NOTICES_KEY));
  /** Nhắc lịch tới giờ (backend đẩy qua bảng notifications) — hiện ở chuông. */
  readonly reminderNotices = signal<ReminderNotice[]>([]);
  private notifChannel?: RealtimeChannel;

  /** LỊCH SỬ TOÀN BỘ thông báo (mọi loại) — lưu VĨNH VIỄN trên trình duyệt (localStorage). */
  readonly history = signal<HistoryEntry[]>(this.loadHistory());

  /** Mốc thời gian "sống" — cập nhật mỗi 5 phút để recentHistory tự rơi bớt theo thời gian
   *  thực dù không có thông báo mới nào bắn ra (computed chỉ tính lại khi có tín hiệu đổi). */
  private readonly nowTick = signal(Date.now());
  /** MỤC "SỰ KIỆN GẦN ĐÂY" trong chuông: tối đa 5 thông báo mới nhất (mọi loại) trong 3 ngày
   *  qua — lấy trực tiếp từ history (đã lưu vĩnh viễn) nên không cần lưu trữ riêng. */
  readonly recentHistory = computed<HistoryEntry[]>(() => {
    const cutoff = this.nowTick() - BELL_MAX_AGE_MS;
    return this.history()
      .filter((h) => h.at >= cutoff)
      .slice(0, RECENT_MAX_ITEMS);
  });

  readonly toasts = signal<Toast[]>([]);
  private readonly notified = new Set<string>();
  /** Các lời mời đã hiện toast (tránh báo lại). */
  private readonly notifiedInvites = new Set<string>();
  /** Các lịch được chia sẻ đã báo toast (tránh báo lại). */
  private readonly notifiedShares = new Set<string>();
  /** Mốc mở app: trong ~4s đầu chỉ GHI NHẬN lời mời đang có, không bắn toast (tránh spam lúc mở). */
  private readonly startedAt = Date.now();

  constructor() {
    // KHÔNG tự xin quyền thông báo lúc mở app — chỉ xin khi người dùng bật công tắc
    // "Thông báo trình duyệt" trong Cài đặt (toggleBrowserNotif). Nhờ vậy chưa bật thì
    // không có thông báo desktop nào bật ra.
    setInterval(() => this.check(), 30_000);
    // Quét lại ngay khi danh sách event thay đổi (tạo/sửa/realtime)
    effect(() => {
      this.state.events();
      this.check();
    });
    // Bắn toast khi có LỜI MỜI MỚI (realtime). Bỏ qua các lời mời đã có sẵn lúc mở app.
    effect(() => {
      const invs = this.state.invitations();
      const warmup = Date.now() - this.startedAt < 4000;
      for (const iv of invs) {
        if (this.notifiedInvites.has(iv.eventId)) continue;
        this.notifiedInvites.add(iv.eventId);
        if (!warmup) this.fireInvite(iv);
      }
    });
    // Bắn toast khi có LỊCH MỚI được người khác chia sẻ cho mình (phát hiện qua poll).
    effect(() => {
      const shares = this.state.newlyShared();
      for (const s of shares) {
        if (this.notifiedShares.has(s.id)) continue;
        this.notifiedShares.add(s.id);
        this.fireShared(s.name);
      }
    });
    // Phát hiện HỦY/ĐỔI sự kiện -> toast real-time. Theo dõi CẢ HAI phía:
    //   - Sự kiện người khác tạo mà mình được mời (báo đổi + báo huỷ).
    //   - Sự kiện CHÍNH MÌNH tạo (chỉ báo đổi) — để người tạo biết khi khách được cấp
    //     quyền chỉnh sửa đã sửa gì. Không theo dõi huỷ ở nhóm này vì mình tự xoá là chính.
    // Thay đổi do CHÍNH MÌNH vừa thực hiện thì BỎ QUA (isRecentLocalChange) — không tự báo mình.
    effect(() => {
      const events = this.state.events();
      const me = this.supabase.user()?.email?.toLowerCase();
      if (!me) return;
      const alive = events.filter((e) => !e.deletedAt);
      const isMine = (e: CalendarEvent) => !e.creatorEmail || e.creatorEmail.toLowerCase() === me;

      const warmup = Date.now() - this.startedAt < 4000;
      // Thay đổi vừa do mình thao tác -> chỉ cập nhật ảnh chụp, không bắn thông báo.
      const selfEdit = this.state.isRecentLocalChange();

      const next = new Map<string, { title: string; start: number; end: number; location: string; description: string; myCanEdit: boolean }>();
      for (const e of alive) {
        const myCanEdit = e.guests.some((g) => g.email.toLowerCase() === me && g.canEdit);
        next.set(e.id, { title: e.title, start: e.start.getTime(), end: e.end.getTime(), location: e.location ?? '', description: e.description ?? '', myCanEdit });
      }

      if (!warmup && !selfEdit) {
        // ĐỔI: có ở cả 2 ảnh chụp nhưng khác nội dung (áp dụng cho cả sự kiện của mình)
        for (const e of alive) {
          const prev = this.invitedSnapshot.get(e.id);
          if (!prev) continue; // mới xuất hiện -> không phải "đổi"
          const cur = next.get(e.id)!;
          const lines = this.describeChanges(prev, cur, e);
          if (lines.length) this.fireChanged(e.id, e.title, lines);
          // Vừa được CẤP quyền chỉnh sửa (false -> true) — chỉ có nghĩa với khách mời
          if (!isMine(e) && !prev.myCanEdit && cur.myCanEdit) {
            this.fireChanged(e.id, e.title, [this.tr.t('notif.grantedEdit')]);
          }
        }
        // HỦY: chỉ xét sự kiện của NGƯỜI KHÁC (creator xoá / gỡ mình khỏi khách mời).
        for (const [id, prev] of this.invitedSnapshot) {
          if (next.has(id)) continue;
          const wasMine = this.ownEventIds.has(id);
          if (!wasMine) this.fireCancelled(prev.title);
        }
      }

      this.invitedSnapshot.clear();
      for (const [id, v] of next) this.invitedSnapshot.set(id, v);
      // Ghi nhớ sự kiện nào là của mình (dùng cho lần quét sau, khi nó đã biến mất).
      this.ownEventIds.clear();
      for (const e of alive) if (isMine(e)) this.ownEventIds.add(e.id);
    });
    // Quét tài liệu vừa mở: ngay khi mở app + mỗi 5 phút.
    setTimeout(() => this.checkAttachments(), 4_000);
    setInterval(() => this.checkAttachments(), 5 * 60_000);
    // Dọn chuông (Bị sửa/Bị hủy) quá 3 ngày định kỳ — phòng trường hợp mở app liên tục nhiều
    // ngày không F5 (lúc khởi động đã dọn 1 lần trong loadBellList() rồi, đây chỉ dọn thêm
    // khi đang chạy). History KHÔNG dọn theo giờ vì lưu vĩnh viễn, không có hạn.
    setInterval(() => this.pruneBellLists(), 60 * 60_000);
    // Cập nhật mốc thời gian cho recentHistory -> mục "Sự kiện gần đây" tự rơi bớt sau 3 ngày
    // kể cả khi không có thông báo mới nào bắn ra trong lúc đang mở app.
    setInterval(() => this.nowTick.set(Date.now()), 5 * 60_000);

    // Nhắc lịch tới giờ do BACKEND đẩy vào bảng notifications: nạp thông báo chưa đọc lúc mở app
    // + lắng nghe realtime để hiện chuông + toast NGAY khi có mốc nhắc mới. Đăng ký lại khi token đổi.
    effect(() => {
      const token = this.supabase.session()?.access_token;
      if (!token) return;
      this.supabase.client.realtime.setAuth(token);
      this.loadReminderNotices();
      this.subscribeNotifications();
    });
  }

  // ---------- Lịch sử thông báo (localStorage, lưu VĨNH VIỄN, không tự xóa) ----------

  private loadHistory(): HistoryEntry[] {
    let list: HistoryEntry[];
    try {
      list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    } catch {
      list = [];
    }
    const fresh = list.slice(-HISTORY_MAX_ITEMS);
    if (fresh.length !== list.length) this.saveHistory(fresh);
    return fresh;
  }

  private saveHistory(list: HistoryEntry[]): void {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch {
      /* localStorage đầy/bị chặn -> bỏ qua, không ảnh hưởng toast/chuông đang hoạt động */
    }
  }

  /** Ghi 1 thông báo vào lịch sử — gọi song song mỗi khi bắn toast. Không giới hạn thời gian,
   *  chỉ giới hạn SỐ DÒNG (HISTORY_MAX_ITEMS) để localStorage không phình vô hạn. */
  private pushHistory(entry: Omit<HistoryEntry, 'id' | 'at'>): void {
    const row: HistoryEntry = { ...entry, id: `${entry.kind}:${Date.now()}:${Math.random().toString(36).slice(2)}`, at: Date.now() };
    this.history.update((list) => {
      const next = [row, ...list].slice(0, HISTORY_MAX_ITEMS);
      this.saveHistory(next);
      return next;
    });
  }

  /** Xóa toàn bộ lịch sử thủ công (nút "Xóa hết" trên trang Lịch sử thông báo). */
  clearHistory(): void {
    this.history.set([]);
    this.saveHistory([]);
  }

  // ---------- Chuông thông báo — Bị sửa/Bị hủy (localStorage, tự rơi khỏi chuông sau 3 ngày) ----------

  private loadBellList<T extends { at: number }>(key: string): T[] {
    let list: T[];
    try {
      list = JSON.parse(localStorage.getItem(key) ?? '[]');
    } catch {
      list = [];
    }
    const cutoff = Date.now() - BELL_MAX_AGE_MS;
    const fresh = list.filter((x) => x.at >= cutoff);
    if (fresh.length !== list.length) this.saveBellList(key, fresh);
    return fresh;
  }

  private saveBellList<T>(key: string, list: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* localStorage đầy/bị chặn -> bỏ qua, chuông vẫn hoạt động trong phiên hiện tại */
    }
  }

  /** Dọn định kỳ: rơi khỏi chuông (nhưng vẫn còn trong Lịch sử) sau 3 ngày dù chưa bấm xóa. */
  private pruneBellLists(): void {
    const cutoff = Date.now() - BELL_MAX_AGE_MS;
    this.changeNotices.update((list) => {
      const fresh = list.filter((x) => x.at >= cutoff);
      if (fresh.length !== list.length) this.saveBellList(CHANGE_NOTICES_KEY, fresh);
      return fresh;
    });
    this.cancelNotices.update((list) => {
      const fresh = list.filter((x) => x.at >= cutoff);
      if (fresh.length !== list.length) this.saveBellList(CANCEL_NOTICES_KEY, fresh);
      return fresh;
    });
  }

  /** Nạp các thông báo nhắc CHƯA ĐỌC (hiện lại trong chuông kể cả khi lúc đó không mở app). */
  private loadReminderNotices(): void {
    this.supabase.client
      .from('notifications')
      .select('id, title, body, event_id, created_at, read_at')
      .eq('type', 'reminder')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(
        ({ data }) => {
          const list: ReminderNotice[] = (data ?? []).map((r: any) => ({
            id: r.id,
            title: r.title,
            body: r.body ?? '',
            eventId: r.event_id ?? null,
            at: new Date(r.created_at).getTime(),
          }));
          this.reminderNotices.set(list);
        },
        () => {},
      );
  }

  /** Lắng nghe INSERT trên bảng notifications (RLS chỉ trả về của chính mình) -> toast + chuông. */
  private subscribeNotifications(): void {
    if (this.notifChannel) {
      this.supabase.client.removeChannel(this.notifChannel);
      this.notifChannel = undefined;
    }
    const uid = this.supabase.user()?.id;
    this.notifChannel = this.supabase.client
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          ...(uid ? { filter: `user_id=eq.${uid}` } : {}),
        },
        (payload: any) => {
          const row = payload.new;
          if (row?.type === 'reminder') this.onReminderRow(row, true);
        },
      )
      .subscribe();
  }

  /** Thêm 1 nhắc lịch vào chuông; fireToast=true -> hiện toast nổi + bíp + thông báo trình duyệt. */
  private onReminderRow(row: any, fireToast: boolean): void {
    if (this.reminderNotices().some((n) => n.id === row.id)) return;
    const notice: ReminderNotice = {
      id: row.id,
      title: row.title,
      body: row.body ?? '',
      eventId: row.event_id ?? null,
      at: Date.now(),
    };
    this.reminderNotices.update((l) => [notice, ...l].slice(0, 50));
    if (!fireToast) return;
    const toastId = `reminder:${row.id}`;
    this.toasts.update((t) => [...t, { id: toastId, kind: 'event', title: notice.title, detail: notice.body, eventId: notice.eventId ?? undefined }]);
    setTimeout(() => this.dismiss(toastId), 15_000);
    this.playBeep();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`⏰ ${notice.title}`, { body: notice.body });
      } catch {
        /* bỏ qua */
      }
    }
  }

  /** Đánh dấu 1 nhắc lịch đã đọc (xóa khỏi chuông + ghi read_at ở DB). */
  dismissReminder(id: string): void {
    this.reminderNotices.update((l) => l.filter((x) => x.id !== id));
    this.supabase.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .then(() => {}, () => {});
  }

  /** Đánh dấu TẤT CẢ nhắc lịch đã đọc. */
  clearReminders(): void {
    const ids = this.reminderNotices().map((n) => n.id);
    this.reminderNotices.set([]);
    if (ids.length) {
      this.supabase.client
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', ids)
        .then(() => {}, () => {});
    }
  }

  /** Quét tài liệu đính kèm vừa tới giờ mở -> toast (mỗi file chỉ báo 1 lần/ máy). */
  private checkAttachments(): void {
    this.attachmentsApi.recentAvailable().subscribe({
      next: (list) => {
        const seen = this.loadSeenFiles();
        for (const a of list) {
          if (seen.has(a.id)) continue;
          seen.add(a.id);
          this.fireFile(a.file_name, a.event_title);
        }
        this.saveSeenFiles(seen);
      },
      error: () => {},
    });
  }

  private loadSeenFiles(): Set<string> {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(SEEN_FILES_KEY) ?? '[]'));
    } catch {
      return new Set<string>();
    }
  }
  private saveSeenFiles(s: Set<string>): void {
    try {
      // giữ tối đa 200 id gần nhất cho gọn
      localStorage.setItem(SEEN_FILES_KEY, JSON.stringify([...s].slice(-200)));
    } catch {
      /* bỏ qua */
    }
  }

  private fireFile(fileName: string, eventTitle: string): void {
    const toastId = `file:${fileName}:${Date.now()}`;
    this.toasts.update((t) => [...t, { id: toastId, kind: 'file', title: fileName, detail: eventTitle }]);
    this.pushHistory({ kind: 'file', title: fileName, detail: eventTitle });
    setTimeout(() => this.dismiss(toastId), 15_000);
    this.playBeep();
    if (this.canDesktopNotify()) {
      try {
        new Notification(`📎 Tài liệu đã mở: ${fileName}`, { body: eventTitle });
      } catch {
        /* bỏ qua */
      }
    }
  }

  /** Toast LỜI MỜI mới — có nút Đồng ý/Từ chối ngay trên toast. Ẩn sau 60s. */
  private fireInvite(iv: { eventId: string; title: string; creatorEmail: string | null }): void {
    const toastId = `invite:${iv.eventId}:${Date.now()}`;
    this.toasts.update((t) => [
      ...t,
      { id: toastId, kind: 'invite', title: iv.title || '(không tiêu đề)', detail: iv.creatorEmail ?? '', eventId: iv.eventId },
    ]);
    this.pushHistory({ kind: 'invite', title: iv.title || '(không tiêu đề)', detail: iv.creatorEmail ?? '', eventId: iv.eventId });
    setTimeout(() => this.dismiss(toastId), 60_000);
    this.playBeep();
    if (this.canDesktopNotify()) {
      try {
        new Notification(`📩 Lời mời mới: ${iv.title || 'Sự kiện'}`, { body: iv.creatorEmail ? `Từ ${iv.creatorEmail}` : '' });
      } catch {
        /* bỏ qua */
      }
    }
  }

  /** Toast khi được người khác CHIA SẺ LỊCH. Ẩn sau 15s. */
  private fireShared(calendarName: string): void {
    const toastId = `shared:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const title = this.tr.t('toast.catShared');
    this.toasts.update((t) => [...t, { id: toastId, kind: 'shared', title, detail: calendarName }]);
    this.pushHistory({ kind: 'shared', title, detail: calendarName });
    setTimeout(() => this.dismiss(toastId), 15_000);
    this.playBeep();
    if (this.canDesktopNotify()) {
      try {
        new Notification(`👥 ${title}`, { body: calendarName });
      } catch {
        /* bỏ qua */
      }
    }
  }

  private fmtDateTime(d: Date, allDay: boolean): string {
    return allDay ? this.settings.formatDate(d) : `${this.settings.formatDate(d)} ${this.settings.formatTime(d)}`;
  }

  /** Mô tả từng thay đổi thành các DÒNG riêng (ngày giờ bắt đầu / kết thúc tách biệt). */
  private describeChanges(
    prev: { title: string; start: number; end: number; location: string; description: string },
    cur: { title: string; start: number; end: number; location: string; description: string },
    e: CalendarEvent,
  ): string[] {
    const lines: string[] = [];
    if (prev.title !== cur.title) lines.push(`${this.tr.t('notif.fTitle')} → ${cur.title || '(trống)'}`);
    if (prev.start !== cur.start) lines.push(`${this.tr.t('notif.fStart')} → ${this.fmtDateTime(e.start, e.isAllDay)}`);
    if (prev.end !== cur.end) lines.push(`${this.tr.t('notif.fEnd')} → ${this.fmtDateTime(e.end, e.isAllDay)}`);
    if (prev.location !== cur.location) {
      lines.push(cur.location ? `${this.tr.t('notif.fLocation')} → ${cur.location}` : `${this.tr.t('notif.fLocation')} (đã gỡ)`);
    }
    if (prev.description !== cur.description) {
      lines.push(cur.description ? `${this.tr.t('notif.fDesc')} → ${cur.description}` : `${this.tr.t('notif.fDesc')} (đã gỡ)`);
    }
    return lines;
  }

  /** Sự kiện mình được mời đã bị người tạo HỦY -> toast + lưu vào chuông. */
  private fireCancelled(title: string): void {
    const safeTitle = title || '(không tiêu đề)';
    const id = `cancel:${safeTitle}:${Date.now()}`;
    this.cancelNotices.update((l) => {
      const next = [{ id, title: safeTitle, at: Date.now() }, ...l].slice(0, 30);
      this.saveBellList(CANCEL_NOTICES_KEY, next);
      return next;
    });
    this.toasts.update((t) => [...t, { id, kind: 'cancelled', title: this.tr.t('notif.cancelled'), detail: safeTitle }]);
    this.pushHistory({ kind: 'cancelled', title: this.tr.t('notif.cancelled'), detail: safeTitle });
    setTimeout(() => this.dismiss(id), 30_000);
    this.playBeep();
    if (this.canDesktopNotify()) {
      try {
        new Notification(`❌ ${this.tr.t('notif.cancelled')}`, { body: safeTitle });
      } catch {
        /* bỏ qua */
      }
    }
  }

  /** Sự kiện mình được mời vừa bị SỬA -> toast + lưu vào chuông (kèm các dòng thay đổi). */
  private fireChanged(eventId: string, title: string, lines: string[]): void {
    const safeTitle = title || '(không tiêu đề)';
    const id = `change:${eventId}:${Date.now()}`;
    this.changeNotices.update((l) => {
      const next = [{ id, eventId, title: safeTitle, changes: lines, at: Date.now() }, ...l].slice(0, 30);
      this.saveBellList(CHANGE_NOTICES_KEY, next);
      return next;
    });
    this.toasts.update((t) => [...t, { id, kind: 'changed', title: safeTitle, body: lines.join(', '), eventId }]);
    this.pushHistory({ kind: 'changed', title: safeTitle, body: lines.join(', '), eventId });
    setTimeout(() => this.dismiss(id), 30_000);
    this.playBeep();
    if (this.canDesktopNotify()) {
      try {
        new Notification(`✏️ ${this.tr.t('notif.changed')}: ${safeTitle}`, { body: lines.join(', ') });
      } catch {
        /* bỏ qua */
      }
    }
  }

  /** Xóa 1 thông báo "bị sửa" khỏi chuông. */
  dismissChange(id: string): void {
    this.changeNotices.update((l) => {
      const next = l.filter((x) => x.id !== id);
      this.saveBellList(CHANGE_NOTICES_KEY, next);
      return next;
    });
  }
  /** Xóa 1 thông báo "bị hủy" khỏi chuông. */
  dismissCancel(id: string): void {
    this.cancelNotices.update((l) => {
      const next = l.filter((x) => x.id !== id);
      this.saveBellList(CANCEL_NOTICES_KEY, next);
      return next;
    });
  }
  /** Xóa tất cả thông báo hủy/sửa đã lưu khỏi chuông (không đụng tới Lịch sử thông báo). */
  clearNotices(): void {
    this.changeNotices.set([]);
    this.cancelNotices.set([]);
    this.saveBellList(CHANGE_NOTICES_KEY, []);
    this.saveBellList(CANCEL_NOTICES_KEY, []);
  }

  private check(): void {
    const now = Date.now();
    for (const e of this.state.events()) {
      if (e.isAllDay || this.notified.has(e.id)) continue;
      // Chỉ nhắc sự kiện CÓ đặt nhắc, và đúng số phút đã chọn (5/15/30... phút trước).
      // Để "Không" (reminderMinutes == null) -> không báo toast.
      if (e.reminderMinutes == null) continue;
      const leadMs = e.reminderMinutes * 60 * 1000;
      const diff = e.start.getTime() - now;
      // Nhắc khi đã tới mốc (now >= start - leadMs). Grace 1 phút để:
      //  - "0 phút" báo ĐÚNG lúc bắt đầu (dù check chạy mỗi 30s, không bị lọt khe);
      //  - KHÔNG bắn cho sự kiện đã bắt đầu từ lâu (mở app muộn thì diff rất âm -> bỏ qua).
      const GRACE_MS = 60_000;
      if (diff <= leadMs && diff > -GRACE_MS) {
        this.notified.add(e.id);
        this.fire(e);
      }
    }
  }

  private fire(e: CalendarEvent): void {
    const timeLabel = e.start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const toastId = `${e.id}:${Date.now()}`;
    this.toasts.update((t) => [...t, { id: toastId, kind: 'event', title: e.title || '(không tiêu đề)', detail: timeLabel, eventId: e.id }]);
    this.pushHistory({ kind: 'event', title: e.title || '(không tiêu đề)', detail: timeLabel, eventId: e.id });
    setTimeout(() => this.dismiss(toastId), 15_000); // tự ẩn sau 15s

    this.playBeep();

    if (this.canDesktopNotify()) {
      try {
        new Notification(`⏰ Sắp tới: ${e.title || 'Sự kiện'}`, { body: `Bắt đầu lúc ${timeLabel}` });
      } catch {
        /* một số trình duyệt yêu cầu ServiceWorker cho Notification — bỏ qua nếu lỗi */
      }
    }
  }

  /** Kêu 2 tiếng bíp bằng Web Audio (không cần file âm thanh) */
  private playBeep(): void {
    try {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      ctx.resume?.();
      const beep = (at: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.2);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.22);
      };
      beep(0);
      beep(0.28);
      setTimeout(() => ctx.close(), 800);
    } catch {
      /* trình duyệt chặn âm thanh khi chưa có tương tác -> bỏ qua */
    }
  }

  /**
   * Thông báo chung (dùng cho tin nhắn nhóm mới):
   * - Luôn hiện toast nổi trong app + kêu bíp nhẹ.
   * - Nếu người dùng đang ở tab/cửa sổ KHÁC (tab ẩn) và đã cấp quyền -> báo thêm desktop.
   */
  notifyMessage(title: string, body: string): void {
    const toastId = `chat:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    this.toasts.update((t) => [...t, { id: toastId, title, body, kind: 'chat' }]);
    this.pushHistory({ kind: 'chat', title, body });
    setTimeout(() => this.dismiss(toastId), 8_000); // tự ẩn sau 8s
    this.playBeep();

    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (hidden && this.canDesktopNotify()) {
      try {
        new Notification(title, { body });
      } catch {
        /* một số trình duyệt yêu cầu ServiceWorker cho Notification — bỏ qua nếu lỗi */
      }
    }
  }

  dismiss(id: string): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  /**
   * Chỉ bắn thông báo DESKTOP (Notification API của trình duyệt) khi CẢ HAI điều kiện:
   *  1) Người dùng đã BẬT công tắc "Thông báo trình duyệt" trong Cài đặt.
   *  2) Trình duyệt đã cấp quyền.
   * Toast nổi trong app + tiếng bíp vẫn hiện bình thường (đó là UI của chính app).
   */
  private canDesktopNotify(): boolean {
    return (
      this.settings.settings().browser_notifications === true &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    );
  }
}
