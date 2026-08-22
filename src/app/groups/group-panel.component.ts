// GroupPanelComponent: bảng điều khiển 1 nhóm (mở từ sidebar).
// - Xem/ mời/ xóa thành viên; copy mã & link tham gia.
// - Danh sách sự kiện nhóm + form thêm nhanh (hiện real-time cho mọi thành viên).
// - Chủ nhóm có thể giải tán nhóm.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupsStateService } from './groups-state.service';
import { ChatService } from './chat.service';
import { CalendarEvent } from '../calendar/calendar.types';
import { GroupMessage } from './groups.types';

@Component({
  selector: 'app-group-panel',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (group(); as g) {
      <div class="fixed inset-0 z-40 flex items-start justify-center bg-black/30 pt-16" (click)="state.closePanel()">
        <div class="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="h-3 w-3 rounded-full" [class]="dotClass()"></span>
                <h2 class="text-lg font-medium text-gray-900">{{ g.name }}</h2>
              </div>
              <p class="mt-0.5 text-xs text-gray-500">
                {{ g.members?.length ?? g.memberCount ?? 0 }} thành viên ·
                <span class="text-emerald-600">{{ state.onlineCount(g.id) }} đang online</span>
              </p>
            </div>
            <button type="button" (click)="state.closePanel()" class="rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="Đóng">✕</button>
          </div>

          <!-- Mã & link tham gia -->
          <div class="mb-4 rounded-lg bg-gray-50 p-3">
            <p class="mb-1 text-xs font-medium text-gray-600">Mời bằng mã / link</p>
            <div class="flex items-center gap-2">
              <code class="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm">{{ g.join_code }}</code>
              <button type="button" (click)="copyCode(g.join_code)" class="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300">
                {{ copied() ? 'Đã copy ✓' : 'Copy mã' }}
              </button>
              <button type="button" (click)="copyLink(g.join_code)" class="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300">
                {{ copiedLink() ? 'Đã copy ✓' : 'Copy link' }}
              </button>
            </div>
          </div>

          <!-- Tabs: Sự kiện / Trò chuyện -->
          <div class="mb-3 flex gap-1 border-b border-gray-200 text-sm">
            <button
              type="button"
              (click)="tab.set('events')"
              class="-mb-px border-b-2 px-3 py-1.5"
              [class.border-blue-700]="tab() === 'events'"
              [class.font-medium]="tab() === 'events'"
              [class.text-blue-700]="tab() === 'events'"
              [class.border-transparent]="tab() !== 'events'"
              [class.text-gray-500]="tab() !== 'events'"
            >Sự kiện</button>
            <button
              type="button"
              (click)="tab.set('chat')"
              class="-mb-px flex items-center gap-1 border-b-2 px-3 py-1.5"
              [class.border-blue-700]="tab() === 'chat'"
              [class.font-medium]="tab() === 'chat'"
              [class.text-blue-700]="tab() === 'chat'"
              [class.border-transparent]="tab() !== 'chat'"
              [class.text-gray-500]="tab() !== 'chat'"
            >
              Trò chuyện
              @if (unreadCount() > 0 && tab() !== 'chat') {
                <span class="rounded-full bg-red-600 px-1.5 text-xs font-medium text-white">{{ unreadCount() }}</span>
              }
            </button>
          </div>

          @if (tab() === 'events') {
          <!-- Thành viên -->
          <div class="mb-4">
            <p class="mb-2 text-sm font-medium text-gray-700">Thành viên</p>
            <ul class="space-y-1">
              @for (m of g.members ?? []; track m.email) {
                <li class="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-gray-50">
                  <span class="flex items-center gap-2">
                    <span
                      class="inline-block h-2 w-2 rounded-full"
                      [class.bg-emerald-500]="isOnline(m.email)"
                      [class.bg-gray-300]="!isOnline(m.email)"
                    ></span>
                    {{ m.email }}
                    @if (m.role === 'owner') { <span class="text-xs text-blue-600">(chủ nhóm)</span> }
                    @if (!m.joined_at) { <span class="text-xs text-gray-400">(đã mời)</span> }
                  </span>
                  @if (isOwner() && m.role !== 'owner') {
                    <button type="button" (click)="state.removeMember(g.id, m.email)" class="text-gray-400 hover:text-red-600" aria-label="Xóa">✕</button>
                  }
                </li>
              }
            </ul>

            @if (isOwner()) {
              <div class="mt-2 flex gap-2">
                <input
                  type="email"
                  [(ngModel)]="inviteEmail"
                  (keydown.enter)="doInvite(g.id)"
                  placeholder="Mời bằng email"
                  class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <button type="button" (click)="doInvite(g.id)" class="rounded bg-blue-700 px-3 py-1 text-sm text-white hover:bg-blue-800">Mời</button>
              </div>
            }
          </div>

          <!-- Sự kiện nhóm -->
          <div class="mb-4 border-t border-gray-100 pt-3">
            <p class="mb-2 text-sm font-medium text-gray-700">Sự kiện nhóm</p>
            @if (events().length === 0) {
              <p class="text-sm text-gray-400">Chưa có sự kiện nào. Thêm bên dưới — mọi người sẽ thấy ngay.</p>
            } @else {
              <ul class="space-y-1">
                @for (e of events(); track e.id) {
                  <li class="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-gray-50">
                    <span class="min-w-0">
                      <span class="block truncate font-medium text-gray-800">{{ e.title || '(Không có tiêu đề)' }}</span>
                      <span class="block text-xs text-gray-500">{{ rangeLabel(e) }}</span>
                    </span>
                    <button type="button" (click)="state.deleteGroupEvent(g.id, e.id)" class="text-gray-400 hover:text-red-600" aria-label="Xóa">🗑️</button>
                  </li>
                }
              </ul>
            }

            <!-- Form thêm nhanh -->
            <div class="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
              <input type="text" [(ngModel)]="title" placeholder="Tiêu đề sự kiện" class="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <input type="date" [(ngModel)]="date" class="rounded border border-gray-300 px-2 py-1" />
                <input type="time" [(ngModel)]="startTime" class="rounded border border-gray-300 px-2 py-1" />
                <span>–</span>
                <input type="time" [(ngModel)]="endTime" class="rounded border border-gray-300 px-2 py-1" />
                <button type="button" (click)="addEvent(g.id)" class="ml-auto rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800">Thêm</button>
              </div>
            </div>
          </div>

          }

          @if (tab() === 'chat') {
          <!-- Trò chuyện nhóm -->
          <div class="mb-3">
            <!-- Nút xem tin cũ hơn -->
            @if (chat.hasMore()[g.id]) {
              <div class="mb-2 text-center">
                <button type="button" (click)="chat.loadOlder(g.id)" class="text-xs text-blue-600 hover:underline">Xem tin cũ hơn</button>
              </div>
            }

            <!-- Danh sách tin nhắn -->
            <div #msgList class="flex max-h-[45vh] min-h-[12rem] flex-col gap-2 overflow-y-auto rounded-lg bg-gray-50 p-3">
              @for (msg of messages(); track msg.id) {
                <div class="flex flex-col" [class.items-end]="chat.isMine(msg)">
                  <div
                    class="max-w-[80%] rounded-2xl px-3 py-1.5 text-sm"
                    [class.bg-blue-600]="chat.isMine(msg) && !msg.deleted_at"
                    [class.text-white]="chat.isMine(msg) && !msg.deleted_at"
                    [class.bg-white]="!chat.isMine(msg) && !msg.deleted_at"
                    [class.text-gray-800]="!chat.isMine(msg) && !msg.deleted_at"
                    [class.border]="!chat.isMine(msg) && !msg.deleted_at"
                    [class.border-gray-200]="!chat.isMine(msg) && !msg.deleted_at"
                    [class.bg-gray-100]="!!msg.deleted_at"
                    [class.italic]="!!msg.deleted_at"
                    [class.text-gray-400]="!!msg.deleted_at"
                  >
                    @if (!chat.isMine(msg) && !msg.deleted_at) {
                      <span class="mb-0.5 block text-xs font-medium text-gray-500">{{ senderLabel(msg) }}</span>
                    }
                    @if (msg.deleted_at) {
                      <span>Tin nhắn đã được thu hồi</span>
                    } @else if (editingId() === msg.id) {
                      <input
                        type="text"
                        [(ngModel)]="editText"
                        (keydown.enter)="saveEdit(g.id, msg.id)"
                        (keydown.escape)="cancelEdit()"
                        class="w-56 rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-800"
                      />
                      <div class="mt-1 flex gap-2 text-xs">
                        <button type="button" (click)="saveEdit(g.id, msg.id)" class="underline">Lưu</button>
                        <button type="button" (click)="cancelEdit()" class="underline">Hủy</button>
                      </div>
                    } @else {
                      <span class="whitespace-pre-wrap break-words">{{ msg.content }}</span>
                    }
                  </div>
                  <div class="mt-0.5 flex items-center gap-2 px-1 text-[10px] text-gray-400">
                    <span>{{ timeLabel(msg) }}</span>
                    @if (msg.edited_at && !msg.deleted_at) { <span>(đã sửa)</span> }
                    @if (chat.isMine(msg) && !msg.deleted_at && editingId() !== msg.id) {
                      <button type="button" (click)="startEdit(msg)" class="hover:text-blue-600">Sửa</button>
                      <button type="button" (click)="chat.remove(g.id, msg.id)" class="hover:text-red-600">Thu hồi</button>
                    }
                  </div>
                </div>
              } @empty {
                <p class="m-auto text-sm text-gray-400">Chưa có tin nhắn nào. Bắt đầu trò chuyện nào!</p>
              }
            </div>

            <!-- "Đang gõ…" -->
            @if (typingLabel()) {
              <p class="mt-1 px-1 text-xs italic text-gray-500">{{ typingLabel() }}</p>
            }

            <!-- Ô nhập tin -->
            <div class="mt-2 flex gap-2">
              <input
                type="text"
                [(ngModel)]="draft"
                (ngModelChange)="onDraftChange(g.id)"
                (keydown.enter)="sendMessage(g.id)"
                placeholder="Nhập tin nhắn…"
                class="flex-1 rounded-full border border-gray-300 px-4 py-1.5 text-sm"
              />
              <button type="button" (click)="sendMessage(g.id)" class="rounded-full bg-blue-700 px-4 py-1.5 text-sm text-white hover:bg-blue-800">Gửi</button>
            </div>
          </div>
          }

          @if (isOwner()) {
            <div class="border-t border-gray-100 pt-3 text-right">
              <button type="button" (click)="confirmDelete(g.id, g.name)" class="text-sm text-red-600 hover:underline">Giải tán nhóm</button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class GroupPanelComponent implements OnDestroy {
  protected readonly state = inject(GroupsStateService);
  protected readonly chat = inject(ChatService);

  @ViewChild('msgList') private msgList?: ElementRef<HTMLDivElement>;

  readonly group = computed(() => this.state.panelGroup());
  readonly events = computed(() => {
    const g = this.group();
    return g ? [...this.state.eventsOf(g.id)].sort((a, b) => a.start.getTime() - b.start.getTime()) : [];
  });
  readonly isOwner = computed(() => this.group()?.myRole === 'owner');

  // ---------- Chat ----------
  readonly tab = signal<'events' | 'chat'>('events');
  readonly editingId = signal<string | null>(null);
  editText = '';
  draft = '';

  readonly messages = computed<GroupMessage[]>(() => {
    const g = this.group();
    return g ? this.chat.messagesOf(g.id) : [];
  });
  readonly unreadCount = computed(() => {
    const g = this.group();
    return g ? this.chat.unreadOf(g.id) : 0;
  });
  readonly typingLabel = computed(() => {
    const g = this.group();
    if (!g) return '';
    const who = this.chat.typingOf(g.id);
    if (who.length === 0) return '';
    if (who.length === 1) return `${who[0]} đang gõ…`;
    return `${who.length} người đang gõ…`;
  });

  constructor() {
    // Mở khung chat của đúng nhóm mỗi khi chuyển sang tab "Trò chuyện" (hoặc đổi nhóm).
    effect(() => {
      const g = this.group();
      if (g && this.tab() === 'chat') {
        this.chat.open(g.id);
      } else {
        this.chat.close();
      }
    });
    // Tự cuộn xuống cuối khi có tin mới và đang xem chat.
    effect(() => {
      this.messages(); // theo dõi thay đổi
      if (this.tab() === 'chat') this.scrollToBottom();
    });
  }

  ngOnDestroy(): void {
    this.chat.close();
  }

  copied = signal(false);
  copiedLink = signal(false);
  inviteEmail = signal('');

  // Form thêm sự kiện
  title = signal('');
  date = signal(this.todayStr());
  startTime = signal('09:00');
  endTime = signal('10:00');

  dotClass(): string {
    const g = this.group();
    const color = g ? this.state.colorFor(g.id) : 'violet';
    const map: Record<string, string> = {
      violet: 'bg-violet-600',
      emerald: 'bg-emerald-600',
      rose: 'bg-rose-600',
      amber: 'bg-amber-600',
      sky: 'bg-sky-600',
    };
    return map[color] ?? 'bg-violet-600';
  }

  isOnline(email: string): boolean {
    const g = this.group();
    return !!g && this.state.onlineEmails(g.id).includes(email);
  }

  rangeLabel(e: CalendarEvent): string {
    const d = e.start.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
    if (e.isAllDay) return `${d} · Cả ngày`;
    const fmt = (x: Date) => x.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${d} · ${fmt(e.start)} – ${fmt(e.end)}`;
  }

  doInvite(groupId: string): void {
    const email = this.inviteEmail().trim();
    if (!email || !email.includes('@')) return;
    this.state.invite(groupId, email);
    this.inviteEmail.set('');
  }

  // ---------- Chat ----------
  sendMessage(groupId: string): void {
    const text = this.draft.trim();
    if (!text) return;
    this.chat.send(groupId, text);
    this.draft = '';
    this.scrollToBottom();
  }

  onDraftChange(groupId: string): void {
    if (this.draft.trim()) this.chat.notifyTyping(groupId);
  }

  startEdit(msg: GroupMessage): void {
    this.editingId.set(msg.id);
    this.editText = msg.content;
  }

  saveEdit(groupId: string, messageId: string): void {
    const text = this.editText.trim();
    if (text) this.chat.edit(groupId, messageId, text);
    this.cancelEdit();
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editText = '';
  }

  /** Tên người gửi hiển thị: phần trước @ của email cho gọn. */
  senderLabel(msg: GroupMessage): string {
    const email = msg.sender_email ?? '';
    return email.includes('@') ? email.split('@')[0] : email || 'Ẩn danh';
  }

  timeLabel(msg: GroupMessage): string {
    return new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom(): void {
    // Đợi DOM cập nhật xong rồi cuộn.
    setTimeout(() => {
      const el = this.msgList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  addEvent(groupId: string): void {
    const start = new Date(`${this.date()}T${this.startTime() || '00:00'}`);
    const end = new Date(`${this.date()}T${this.endTime() || '00:00'}`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    this.state.createGroupEvent(groupId, {
      kind: 'event',
      title: this.title().trim(),
      start,
      end,
      isAllDay: false,
      guests: [],
      color: this.state.colorFor(groupId),
    });
    this.title.set('');
  }

  confirmDelete(groupId: string, name: string): void {
    if (confirm(`Giải tán nhóm "${name}"? Mọi sự kiện nhóm sẽ bị xóa.`)) {
      this.state.deleteGroup(groupId);
    }
  }

  async copyCode(code: string): Promise<void> {
    await this.writeClipboard(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async copyLink(code: string): Promise<void> {
    await this.writeClipboard(`${window.location.origin}/?join=${code}`);
    this.copiedLink.set(true);
    setTimeout(() => this.copiedLink.set(false), 2000);
  }

  private async writeClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* trình duyệt chặn clipboard -> bỏ qua */
    }
  }

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
