// GroupPanelComponent — Bảng chi tiết của một nhóm (mở từ sidebar).
// Gồm 2 tab: "Sự kiện" (thành viên + lịch nhóm) và "Trò chuyện" (nhắn tin).

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
import { GroupChatService } from './chat.service';
import { CalendarEvent } from '../calendar/calendar.types';
import { GroupMessage } from './groups.types';
import { ConfirmService } from '../shared/confirm.service';
import { TranslateService } from '../i18n/translate.service';
import { SupabaseService } from '../auth/supabase.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-group-panel',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (group(); as g) {
      <div class="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 pt-16" (click)="state.closePanel()">
        <div class="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white p-5 shadow-2xl" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="mb-3 flex shrink-0 items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-medium text-gray-900">{{ g.name }}</h2>
              </div>
              <p class="mt-0.5 text-xs text-gray-500">
                {{ g.members?.length ?? g.memberCount ?? 0 }} thành viên ·
                <span class="text-emerald-600">{{ state.onlineCount(g.id) }} đang online</span>
              </p>
            </div>
            <button type="button" (click)="state.closePanel()" class="btn-icon !p-1.5 text-gray-400" aria-label="Đóng"><app-icon name="x" class="h-4 w-4" /></button>
          </div>

          <!-- Mã & link tham gia -->
          <div class="mb-4 shrink-0 rounded-lg bg-gray-50 p-3">
            <p class="mb-1 text-xs font-medium text-gray-600">Mời bằng mã / link</p>
            <div class="flex flex-wrap items-center gap-2">
              <code class="min-w-0 flex-1 truncate rounded border border-gray-200 bg-white px-2 py-1 text-sm">{{ g.join_code }}</code>
              <button type="button" (click)="copyCode(g.join_code)" class="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300">
                {{ copied() ? 'Đã copy ✓' : 'Copy mã' }}
              </button>
              <button type="button" (click)="copyLink(g.join_code)" class="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300">
                {{ copiedLink() ? 'Đã copy ✓' : 'Copy link' }}
              </button>
            </div>
          </div>

          <!-- Tabs: Sự kiện / Trò chuyện -->
          <div class="mb-3 flex shrink-0 gap-1 border-b border-gray-200 text-sm">
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
          <div class="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
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
                    @if (m.status === 'declined') { <span class="text-xs text-red-500">(đã từ chối)</span> }
                    @else if (!m.joined_at) { <span class="text-xs text-amber-600">(đang chờ)</span> }
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
              @if (state.error(); as err) {
                <p class="mt-1 text-xs text-red-600">{{ err }}</p>
              }
              <p class="mt-1 text-xs text-gray-400">Người được mời sẽ tự vào nhóm khi đăng nhập bằng email đó.</p>
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
                  <li class="rounded px-2 py-1 text-sm hover:bg-gray-50">
                    @if (editEventId() === e.id) {
                      <!-- FORM SỬA sự kiện nhóm (đầy đủ như sự kiện thường) -->
                      <div class="space-y-2 rounded-lg bg-blue-50 p-2">
                        <input type="text" [(ngModel)]="eTitle" placeholder="Tiêu đề sự kiện" class="w-full rounded border border-gray-300 px-2 py-1" />
                        <div class="flex flex-wrap items-center gap-2">
                          <input type="date" [(ngModel)]="eDate" class="rounded border border-gray-300 px-2 py-1" />
                          <input type="time" [(ngModel)]="eStart" [disabled]="eAllDay()" class="rounded border border-gray-300 px-2 py-1 disabled:bg-gray-100 disabled:text-gray-400" />
                          <span>–</span>
                          <input type="time" [(ngModel)]="eEnd" [disabled]="eAllDay()" class="rounded border border-gray-300 px-2 py-1 disabled:bg-gray-100 disabled:text-gray-400" />
                        </div>
                        <label class="flex items-center gap-2 text-gray-600">
                          <input type="checkbox" [(ngModel)]="eAllDay" /> Cả ngày
                        </label>
                        <input type="text" [(ngModel)]="eLocation" placeholder="📍 Địa điểm" class="w-full rounded border border-gray-300 px-2 py-1" />
                        <textarea [(ngModel)]="eDescription" rows="2" placeholder="Mô tả" class="w-full resize-none rounded border border-gray-300 px-2 py-1"></textarea>
                        <!-- Đã bỏ hàng chọn màu ở đây: nhóm không còn màu riêng.
                             eColor vẫn giữ nguyên màu cũ của sự kiện khi lưu, và muốn đổi màu
                             thì mở sự kiện từ lịch chính (ở đó có ô tự chọn màu bất kỳ). -->
                        <div class="flex justify-end gap-2 pt-1">
                          <button type="button" (click)="cancelEventEdit()" class="rounded px-3 py-1 text-gray-600 hover:bg-gray-200">Hủy</button>
                          <button type="button" (click)="saveEventEdit(g.id)" class="rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800">Lưu</button>
                        </div>
                      </div>
                    } @else {
                      <div class="flex items-center justify-between gap-2">
                        <span class="min-w-0">
                          <span class="block truncate font-medium text-gray-800">{{ e.title || '(Không có tiêu đề)' }}</span>
                          <span class="block text-xs text-gray-500">{{ rangeLabel(e) }}</span>
                        </span>
                        <span class="flex shrink-0 items-center gap-2">
                          @if (e.meetLink) {
                            <a [href]="e.meetLink" target="_blank" rel="noopener" class="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-700">📹 Tham gia Meet</a>
                            @if (canModifyEvent(e)) {
                              <button type="button" (click)="state.removeMeetForEvent(g.id, e.id)" class="text-gray-400 hover:text-red-600" title="Gỡ Google Meet" aria-label="Gỡ Meet">✕</button>
                            }
                          } @else if (canModifyEvent(e)) {
                            <button type="button" (click)="state.createMeetForEvent(g.id, e.id)" class="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100" title="Tạo phòng họp Google Meet">📹 Tạo Meet</button>
                          }
                          @if (canModifyEvent(e)) {
                            <button type="button" (click)="startEventEdit(e)" class="text-gray-400 hover:text-blue-600" title="Sửa sự kiện" aria-label="Sửa">✏️</button>
                            <button type="button" (click)="state.deleteGroupEvent(g.id, e.id)" class="text-gray-400 hover:text-red-600" aria-label="Xóa">🗑️</button>
                          } @else {
                            <span class="text-xs text-gray-400" title="Chỉ người tạo mới sửa/xóa được">🔒</span>
                          }
                        </span>
                      </div>
                    }
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
          </div>

          }

          @if (tab() === 'chat') {
          <!-- Trò chuyện nhóm -->
          <div class="flex min-h-0 flex-1 flex-col">
            <!-- Nút xem tin cũ hơn -->
            @if (chat.hasMore()[g.id]) {
              <div class="mb-2 text-center">
                <button type="button" (click)="chat.loadOlder(g.id)" class="text-xs text-blue-600">Xem tin cũ hơn</button>
              </div>
            }

            <!-- Danh sách tin nhắn -->
            <div #msgList class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-gray-50 p-3">
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
                        class="w-full min-w-[8rem] rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-800"
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
            <div class="mt-2 flex shrink-0 gap-2">
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
            <div class="mt-2 shrink-0 border-t border-gray-100 pt-3">
              <button type="button" (click)="confirmDelete(g.id, g.name)" class="tap btn btn-danger w-full gap-1.5">
                <app-icon name="trash" class="h-4 w-4" /> Giải tán nhóm
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class GroupPanelComponent implements OnDestroy {
  protected readonly state = inject(GroupsStateService);
  protected readonly chat = inject(GroupChatService);
  private readonly confirm = inject(ConfirmService);
  protected readonly tr = inject(TranslateService);
  private readonly supabase = inject(SupabaseService);

  /** true nếu user hiện tại được phép sửa/xóa sự kiện nhóm này: người tạo, hoặc chủ nhóm,
   *  hoặc sự kiện cũ chưa có creatorEmail (giữ tương thích). Backend cũng chặn lại lần nữa. */
  protected canModifyEvent(e: CalendarEvent): boolean {
    if (this.isOwner()) return true;
    const me = this.supabase.user()?.email?.toLowerCase();
    return !e.creatorEmail || e.creatorEmail.toLowerCase() === me;
  }

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
    // Áp dụng tab mong muốn mỗi lần mở panel (vd bấm nút 💬 -> mở thẳng tab "Trò chuyện").
    effect(() => {
      this.state.panelOpenSeq(); // chạy lại mỗi lần mở panel
      this.tab.set(this.state.panelInitialTab());
    });
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

  // ---------- Form SỬA sự kiện nhóm (đầy đủ như sự kiện thường) ----------
  readonly editEventId = signal<string | null>(null);
  eTitle = signal('');
  eDate = signal(this.todayStr());
  eStart = signal('09:00');
  eEnd = signal('10:00');
  eAllDay = signal(false);
  eLocation = signal('');
  eDescription = signal('');
  /** Giữ nguyên màu sẵn có của sự kiện khi lưu (không còn ô chọn màu trong panel nhóm). */
  eColor = signal<string>('sky');

  /** Mở form sửa, nạp dữ liệu sự kiện hiện tại. */
  protected startEventEdit(e: CalendarEvent): void {
    this.editEventId.set(e.id);
    this.eTitle.set(e.title ?? '');
    this.eDate.set(this.dateStr(e.start));
    this.eStart.set(this.timeStr(e.start));
    this.eEnd.set(this.timeStr(e.end));
    this.eAllDay.set(e.isAllDay);
    this.eLocation.set(e.location ?? '');
    this.eDescription.set(e.description ?? '');
    this.eColor.set(e.color ?? 'sky');
  }

  protected cancelEventEdit(): void {
    this.editEventId.set(null);
  }

  /** Lưu thay đổi sự kiện nhóm qua updateGroupEvent (backend đã chặn quyền lần nữa). */
  protected saveEventEdit(groupId: string): void {
    const id = this.editEventId();
    if (!id) return;
    const start = this.eAllDay()
      ? new Date(`${this.eDate()}T00:00`)
      : new Date(`${this.eDate()}T${this.eStart() || '00:00'}`);
    const end = this.eAllDay()
      ? new Date(`${this.eDate()}T23:59`)
      : new Date(`${this.eDate()}T${this.eEnd() || '00:00'}`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    if (!this.eAllDay() && end.getTime() < start.getTime()) {
      this.state.error.set('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }
    this.state.error.set(null);
    this.state.updateGroupEvent(groupId, id, {
      kind: 'event',
      title: this.eTitle().trim(),
      description: this.eDescription().trim() || undefined,
      location: this.eLocation().trim() || undefined,
      start,
      end,
      isAllDay: this.eAllDay(),
      guests: [],
      color: this.eColor(),
    });
    this.editEventId.set(null);
  }

  private dateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  private timeStr(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
    const email = this.inviteEmail().trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) {
      this.state.error.set('Email không hợp lệ. Nhập đúng dạng ten@gmail.com');
      return;
    }
    this.state.error.set(null); // xóa lỗi cũ trước khi mời
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
      // Nhóm không còn màu riêng -> dùng màu mặc định như sự kiện cá nhân.
      color: 'sky',
    });
    this.title.set('');
  }

  async confirmDelete(groupId: string, name: string): Promise<void> {
    const ok = await this.confirm.ask({
      message: `${this.tr.t('confirm.delGroup')} "${name}"?`,
      detail: this.tr.t('confirm.delGroupDetail'),
      confirmText: this.tr.t('confirm.disband'),
    });
    if (ok) this.state.deleteGroup(groupId);
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
