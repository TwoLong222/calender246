// Popover chi tiết sự kiện — khớp bố cục hình 7: tiêu đề, thời gian, danh sách khách
// (kèm trạng thái RSVP), nút sửa (✏️)/xóa (🗑️)/đóng (✕).

import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarStateService } from './calendar-state.service';
import { SupabaseService } from '../auth/supabase.service';
import { CommentsService } from './comments.service';
import { AttachmentsApiService, EventAttachment, MAX_ATTACHMENT_BYTES } from './attachments-api.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { ConfirmService } from '../shared/confirm.service';
import { AttendeeStatus } from './calendar.types';
import { IconComponent } from '../shared/icon.component';
import { DateTimePickerComponent } from '../shared/datetime-picker.component';

@Component({
  selector: 'app-event-detail-popover',
  standalone: true,
  imports: [FormsModule, IconComponent, DateTimePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (event(); as e) {
      <div class="fixed inset-0 z-30" (click)="state.closeDetail()">
        <div
          class="popup-in absolute left-1/2 top-24 max-h-[calc(100vh-8rem)] w-80 -translate-x-1/2 overflow-y-auto overflow-x-hidden rounded-xl bg-white p-4 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full" [class]="dotClass(e.color)"></span>
              <h3 class="font-medium text-gray-900">{{ e.title || tr.t('common.untitled') }}</h3>
            </div>
            <div class="flex shrink-0 gap-1">
              <!-- Chỉ người TẠO mới sửa/xóa được (khách được mời không thấy 2 nút này) -->
              @if (canManage()) {
                <button type="button" (click)="edit()" class="rounded-full p-1 text-gray-500 hover:bg-gray-100" [attr.aria-label]="tr.t('detail.edit')"><app-icon name="pencil" class="h-4 w-4" /></button>
                <button type="button" (click)="confirmingDelete.set(true)" class="rounded-full p-1 text-gray-500 hover:bg-gray-100" [attr.aria-label]="tr.t('detail.delete')"><app-icon name="trash" class="h-4 w-4" /></button>
              }
              <button type="button" (click)="state.closeDetail()" class="rounded-full p-1 text-gray-500 hover:bg-gray-100" [attr.aria-label]="tr.t('common.close')"><app-icon name="x" class="h-4 w-4" /></button>
            </div>
          </div>

          <p class="mb-2 text-sm text-gray-600">{{ dateLabel(e.start) }} · {{ timeLabel(e.start) }} – {{ timeLabel(e.end) }}</p>

          <!-- Google Meet -->
          <div class="mb-2 flex items-center gap-2">
            @if (e.meetLink) {
              <a [href]="e.meetLink" target="_blank" rel="noopener" class="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-sm text-white hover:bg-emerald-700">📹 Tham gia Google Meet</a>
              @if (canManage()) {
                <button type="button" (click)="state.removeMeetForEvent(e.id)" class="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600" title="Gỡ Google Meet" aria-label="Gỡ Meet"><app-icon name="x" class="h-4 w-4" /></button>
              }
            } @else if (canManage()) {
              <button type="button" (click)="state.createMeetForEvent(e.id)" class="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100" title="Tạo phòng họp Google Meet">📹 Tạo Google Meet</button>
            }
          </div>

          @if (e.creatorEmail) {
            <p class="mb-2 text-sm text-gray-600">👤 {{ tr.t('detail.creator') }}: {{ e.creatorEmail }}</p>
          }

          @if (e.location) {
            <p class="mb-2 text-sm text-gray-600">📍 {{ e.location }}</p>
          }
          @if (e.description) {
            <p class="mb-2 flex items-start gap-2 text-sm text-gray-600"><app-icon name="notes" class="mt-0.5 h-4 w-4 shrink-0" /><span>{{ e.description }}</span></p>
          }

          @if (e.guests.length > 0) {
            <div class="mt-3 border-t border-gray-100 pt-3">
              <p class="mb-1 text-xs text-gray-400">
                {{ e.guests.length }} {{ tr.t('detail.guests') }} · {{ acceptedCount() }} {{ tr.t('detail.accepted') }}, {{ pendingCount() }} {{ tr.t('detail.pending') }}
              </p>
              <ul class="space-y-1">
                @for (g of e.guests; track g.email) {
                  <li class="flex items-center justify-between gap-2 text-sm text-gray-700">
                    <span class="flex items-center gap-2 truncate">
                      <span [class]="statusDotClass(g.status)"></span>
                      <span class="truncate">{{ g.email }}</span>
                    </span>
                    <span class="shrink-0 text-xs font-medium" [class]="statusTextClass(g.status)">{{ statusLabel(g.status) }}</span>
                  </li>
                }
              </ul>
            </div>
          }

          <div class="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3 text-sm">
            <span class="text-gray-500">{{ tr.t('detail.attend') }}</span>
            <button
              type="button"
              (click)="rsvp('accepted')"
              class="rounded-full border px-3 py-1"
              [class]="myStatus() === 'accepted' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 hover:bg-gray-50'"
            >
              {{ tr.t('rsvp.yes') }}
            </button>
            <button
              type="button"
              (click)="rsvp('declined')"
              class="rounded-full border px-3 py-1"
              [class]="myStatus() === 'declined' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 hover:bg-gray-50'"
            >
              {{ tr.t('rsvp.no') }}
            </button>
            <button
              type="button"
              (click)="rsvp('tentative')"
              class="rounded-full border px-3 py-1"
              [class]="myStatus() === 'tentative' ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-300 hover:bg-gray-50'"
            >
              {{ tr.t('rsvp.maybe') }}
            </button>
          </div>

          <!-- Tài liệu đính kèm -->
          <div class="mt-4 border-t border-gray-100 pt-3">
            <div class="mb-2 flex items-center justify-between">
              <p class="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <app-icon name="notes" class="h-4 w-4" /> {{ tr.t('attach.title') }}
              </p>
              @if (canManage()) {
                <label class="tap cursor-pointer rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50">
                  {{ uploading() ? tr.t('attach.uploading') : tr.t('attach.add') }}
                  <input type="file" class="hidden" (change)="onFileSelected($event)" [disabled]="uploading()" />
                </label>
              }
            </div>
            @if (canManage()) {
              <p class="mb-1 text-[11px] text-gray-400">{{ tr.t('attach.limit') }}</p>
            }
            @if (uploadError()) {
              <p class="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">{{ uploadError() }}</p>
            }
            @if (canManage()) {
              <!-- Hẹn giờ cho file SẼ tải lên (áp cho lần thêm kế tiếp) -->
              <div class="mb-2 grid grid-cols-2 gap-2 rounded bg-gray-50 p-2 text-xs">
                <label class="flex flex-col gap-0.5 text-gray-500">
                  {{ tr.t('attach.from') }}
                  <app-datetime-picker [(ngModel)]="newFrom" />
                </label>
                <label class="flex flex-col gap-0.5 text-gray-500">
                  {{ tr.t('attach.until') }}
                  <app-datetime-picker [(ngModel)]="newUntil" />
                </label>
                <p class="col-span-2 text-[11px] text-gray-400">{{ tr.t('attach.scheduleHint') }}</p>
              </div>
            }
            @if (attachments().length === 0) {
              <p class="text-xs text-gray-400">{{ tr.t('attach.none') }}</p>
            } @else {
              <ul class="space-y-1">
                @for (a of attachments(); track a.id) {
                  <li class="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1 text-sm">
                    @if (a.status === 'available' && a.url) {
                      <a [href]="a.url" target="_blank" rel="noopener" class="min-w-0 flex-1 truncate text-blue-700 hover:underline">{{ a.file_name }}</a>
                    } @else if (a.status === 'scheduled') {
                      <span class="min-w-0 flex-1 truncate text-gray-500" [title]="tr.t('attach.opensAt') + ' ' + fmt(a.available_from)">🔒 {{ a.file_name }}</span>
                    } @else if (a.status === 'expired') {
                      <span class="min-w-0 flex-1 truncate text-gray-400 line-through" [title]="tr.t('attach.expired')">{{ a.file_name }}</span>
                    } @else {
                      <span class="min-w-0 flex-1 truncate text-gray-700">{{ a.file_name }}</span>
                    }
                    <span class="shrink-0 text-xs text-gray-400">{{ fileSize(a.size_bytes) }}</span>
                    @if (canManage()) {
                      <button type="button" (click)="removeAttachment(a.id)" class="tap shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600" [attr.aria-label]="tr.t('detail.delete')"><app-icon name="x" class="h-3.5 w-3.5" /></button>
                    }
                  </li>
                  @if (a.status === 'scheduled') {
                    <li class="px-2 text-[11px] text-amber-600">🔒 {{ tr.t('attach.opensAt') }} {{ fmt(a.available_from) }}</li>
                  } @else if (a.status === 'expired') {
                    <li class="px-2 text-[11px] text-gray-400">{{ tr.t('attach.expired') }}</li>
                  } @else if (a.available_until) {
                    <li class="px-2 text-[11px] text-gray-400">{{ tr.t('attach.viewUntil') }} {{ fmt(a.available_until) }}</li>
                  }
                }
              </ul>
            }
          </div>

          <!-- Bình luận -->
          <div class="mt-4 border-t border-gray-100 pt-3">
            <p class="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <app-icon name="message" class="h-4 w-4" /> {{ tr.t('detail.comments') }}
            </p>

            <ul class="mb-2 max-h-40 space-y-2 overflow-y-auto">
              @for (c of comments.comments(); track c.id) {
                <li class="rounded-md bg-gray-50 px-2 py-1.5">
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="truncate text-xs font-medium text-gray-700">{{ c.userEmail }}</span>
                    <span class="shrink-0 text-[10px] text-gray-400">{{ commentTime(c.createdAt) }}</span>
                  </div>
                  @if (editingId() === c.id) {
                    <textarea [(ngModel)]="editText" rows="2" class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"></textarea>
                    <div class="mt-1 flex gap-3">
                      <button type="button" (click)="saveEdit(c.id)" class="text-xs font-medium text-blue-700 hover:underline">{{ tr.t('form.save') }}</button>
                      <button type="button" (click)="cancelEdit()" class="text-xs text-gray-500 hover:underline">{{ tr.t('del.cancel') }}</button>
                    </div>
                  } @else {
                    <p class="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-800">{{ c.content }}</p>
                    @if (isMine(c)) {
                      @if (deletingId() === c.id) {
                        <div class="mt-1 flex items-center gap-3">
                          <span class="text-xs text-red-700">{{ tr.t('detail.delComment') }}</span>
                          <button type="button" (click)="confirmDeleteComment(c.id)" class="text-xs font-medium text-red-600 hover:underline">{{ tr.t('detail.delete') }}</button>
                          <button type="button" (click)="deletingId.set(null)" class="text-xs text-gray-500 hover:underline">{{ tr.t('del.cancel') }}</button>
                        </div>
                      } @else {
                        <div class="mt-1 flex gap-3">
                          <button type="button" (click)="startEdit(c.id, c.content)" class="text-xs text-gray-500 hover:underline">{{ tr.t('detail.edit') }}</button>
                          <button type="button" (click)="deletingId.set(c.id)" class="text-xs text-red-500 hover:underline">{{ tr.t('detail.delete') }}</button>
                        </div>
                      }
                    }
                  }
                </li>
              } @empty {
                @if (!comments.loading()) {
                  <li class="text-xs text-gray-400">{{ tr.t('detail.noComments') }}</li>
                }
              }
            </ul>

            <div class="flex gap-2">
              <textarea
                [(ngModel)]="newComment"
                rows="1"
                [placeholder]="tr.t('detail.writeComment')"
                class="flex-1 resize-none rounded border border-gray-300 px-2 py-1 text-sm"
              ></textarea>
              <button
                type="button"
                (click)="sendComment()"
                [disabled]="!newComment().trim()"
                class="shrink-0 self-start rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40"
              >{{ tr.t('detail.send') }}
              </button>
            </div>
          </div>

          <!-- Xác nhận xóa: nếu là sự kiện lặp thì cho chọn xóa riêng hoặc xóa cả chuỗi -->
          @if (confirmingDelete()) {
            <div class="mt-3 rounded-md bg-red-50 p-3 text-sm">
              <p class="mb-2 text-red-800">{{ tr.t('detail.deleteEvent') }}</p>
              <div class="flex flex-wrap gap-2">
                <button type="button" (click)="doDelete()" class="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700">{{ tr.t('detail.deleteThis') }}
                </button>
                @if (e.seriesId) {
                  <button type="button" (click)="doDelete('series')" class="rounded bg-red-700 px-3 py-1 text-white hover:bg-red-800">
                    {{ tr.t('detail.deleteSeries') }}
                  </button>
                }
                <button type="button" (click)="confirmingDelete.set(false)" class="rounded px-3 py-1 text-gray-600 hover:bg-gray-100">
                  {{ tr.t('del.cancel') }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class EventDetailPopoverComponent implements OnDestroy {
  protected readonly state = inject(CalendarStateService);
  private readonly supabase = inject(SupabaseService);
  protected readonly comments = inject(CommentsService);
  private readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);
  private readonly attachmentsApi = inject(AttachmentsApiService);
  private readonly confirm = inject(ConfirmService);

  // ----- Tài liệu đính kèm -----
  protected readonly attachments = signal<EventAttachment[]>([]);
  protected readonly uploading = signal(false);
  /** Thông báo lỗi khi chọn tệp không hợp lệ (vd quá dung lượng). */
  protected readonly uploadError = signal('');
  /** Giờ hẹn cho file sẽ tải lên (datetime-local: "YYYY-MM-DDTHH:mm"). */
  protected readonly newFrom = signal('');
  protected readonly newUntil = signal('');

  /** Đồng hồ hẹn tự mở khóa/hết hạn file (dọn khi đổi event / đóng popover). */
  private unlockTimers: ReturnType<typeof setTimeout>[] = [];

  private clearUnlockTimers(): void {
    for (const t of this.unlockTimers) clearTimeout(t);
    this.unlockTimers = [];
  }

  /**
   * Hẹn giờ tự LÀM MỚI danh sách file đúng lúc mở khóa / hết hạn — không cần F5.
   * Vì việc mở khóa là theo THỜI GIAN (không có thay đổi DB nào để websocket bắn),
   * ta đặt setTimeout tới đúng mốc rồi gọi lại server để lấy link tải + trạng thái mới.
   */
  private scheduleUnlockTimers(eventId: string, list: EventAttachment[]): void {
    this.clearUnlockTimers();
    const now = Date.now();
    const MAX = 24 * 60 * 60 * 1000; // setTimeout không nhận số quá lớn -> chỉ hẹn trong 24h
    const at = new Set<number>();
    for (const a of list) {
      // File đang khóa -> hẹn tới đúng giờ mở
      if (a.status === 'scheduled' && a.available_from) at.add(new Date(a.available_from).getTime());
      // File đang mở nhưng có hạn -> hẹn tới lúc hết hạn để chuyển sang "hết hạn"
      if (a.status === 'available' && a.available_until) at.add(new Date(a.available_until).getTime());
      // Lệch giờ máy/server: lẽ ra đã mở mà vẫn khóa -> thử lại sau 5s
      if (a.status === 'scheduled' && a.available_from && new Date(a.available_from).getTime() <= now) {
        at.add(now + 5000);
      }
    }
    for (const t of at) {
      const delay = t - now + 1000; // +1s đệm cho chắc server đã tính là "mở"
      if (delay > 0 && delay <= MAX) {
        this.unlockTimers.push(setTimeout(() => this.loadAttachments(eventId), delay));
      }
    }
  }

  private loadAttachments(eventId: string): void {
    this.attachmentsApi.list(eventId).subscribe({
      next: (a) => { this.attachments.set(a); this.scheduleUnlockTimers(eventId, a); },
      error: () => { this.attachments.set([]); this.clearUnlockTimers(); },
    });
  }

  ngOnDestroy(): void {
    this.clearUnlockTimers();
  }
  protected onFileSelected(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    const e = this.event();
    if (!file || !e) return;
    // Chặn ngay ở client nếu file vượt giới hạn -> khỏi tải lên vô ích rồi mới lỗi.
    if (file.size > MAX_ATTACHMENT_BYTES) {
      this.uploadError.set(this.tr.t('attach.tooLarge'));
      input.value = '';
      return;
    }
    this.uploadError.set('');
    this.uploading.set(true);
    const schedule = {
      availableFrom: this.newFrom() ? new Date(this.newFrom()).toISOString() : null,
      availableUntil: this.newUntil() ? new Date(this.newUntil()).toISOString() : null,
    };
    this.attachmentsApi.upload(e.id, file, schedule).subscribe({
      next: () => {
        this.uploading.set(false);
        this.loadAttachments(e.id);
        input.value = '';
        this.newFrom.set('');
        this.newUntil.set('');
      },
      error: () => { this.uploading.set(false); input.value = ''; },
    });
  }
  protected async removeAttachment(attId: string): Promise<void> {
    const e = this.event();
    if (!e) return;
    const name = this.attachments().find((a) => a.id === attId)?.file_name;
    const ok = await this.confirm.ask({ message: this.tr.t('confirm.delFile'), detail: name });
    if (!ok) return;
    this.attachmentsApi.remove(e.id, attId).subscribe({ next: () => this.loadAttachments(e.id), error: () => {} });
  }
  protected fileSize(bytes: number | null): string {
    if (!bytes) return '';
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  /** Định dạng ngày giờ ngắn gọn cho nhãn trạng thái file. */
  protected fmt(iso?: string | null): string {
    if (!iso) return '';
    return this.settings.formatDate(new Date(iso)) + ' ' + this.settings.formatTime(new Date(iso));
  }

  event = computed(() => this.state.selectedEvent());

  // ----- Bình luận -----
  newComment = signal('');
  editingId = signal<string | null>(null);
  editText = signal('');
  deletingId = signal<string | null>(null);

  isMine(c: { userEmail: string }): boolean {
    return c.userEmail.toLowerCase() === this.comments.myEmail()?.toLowerCase();
  }

  commentTime(d: Date): string {
    return d.toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  sendComment(): void {
    const text = this.newComment().trim();
    if (!text) return;
    this.comments.add(text);
    this.newComment.set('');
  }

  startEdit(id: string, content: string): void {
    this.editingId.set(id);
    this.editText.set(content);
  }

  saveEdit(id: string): void {
    this.comments.edit(id, this.editText());
    this.editingId.set(null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  confirmDeleteComment(id: string): void {
    this.comments.remove(id);
    this.deletingId.set(null);
  }

  /** Trạng thái tham dự của CHÍNH user hiện tại cho event này (để tô đậm nút đang chọn) */
  myStatus = computed<AttendeeStatus | null>(() => {
    const email = this.supabase.user()?.email?.toLowerCase();
    const e = this.event();
    if (!email || !e) return null;
    return e.guests.find((g) => g.email.toLowerCase() === email)?.status ?? null;
  });

  rsvp(status: AttendeeStatus): void {
    const e = this.event();
    if (e) this.state.rsvp(e.id, status);
  }

  /** Chỉ người TẠO mới được sửa/xóa. Event cũ (chưa có creatorEmail) tạm cho phép (thường là của chính mình). */
  canManage = computed<boolean>(() => {
    const e = this.event();
    if (!e) return false;
    return this.state.canEditEvent(e);
  });

  /** Số khách đã đồng ý / chưa trả lời — tóm tắt cho người tạo dễ nhìn */
  acceptedCount = computed(() => this.event()?.guests.filter((g) => g.status === 'accepted').length ?? 0);
  pendingCount = computed(() => this.event()?.guests.filter((g) => g.status === 'needsAction').length ?? 0);

  /** Nhãn trạng thái RSVP theo ngôn ngữ hiện tại. */
  statusLabel(status: string): string {
    const valid = ['accepted', 'declined', 'tentative', 'needsAction'];
    return this.tr.t('rsvp.' + (valid.includes(status) ? status : 'needsAction'));
  }

  statusTextClass(status: string): string {
    const map: Record<string, string> = {
      accepted: 'text-emerald-600',
      declined: 'text-red-600',
      tentative: 'text-amber-600',
      needsAction: 'text-gray-400',
    };
    return map[status] ?? 'text-gray-400';
  }

  dateLabel(d: Date): string {
    const loc = this.tr.lang() === 'en' ? 'en-GB' : 'vi-VN';
    return d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'numeric' });
  }

  timeLabel(d: Date): string {
    // Theo cài đặt định dạng giờ (12h/24h) + timezone của người dùng.
    return this.settings.formatTime(d);
  }

  dotClass(color: string): string {
    const map: Record<string, string> = {
      sky: 'bg-sky-600',
      violet: 'bg-violet-600',
      emerald: 'bg-emerald-600',
      rose: 'bg-rose-600',
      amber: 'bg-amber-600',
    };
    return map[color] ?? 'bg-sky-600';
  }

  statusDotClass(status: string): string {
    const map: Record<string, string> = {
      accepted: 'inline-block h-2 w-2 rounded-full bg-emerald-500',
      declined: 'inline-block h-2 w-2 rounded-full bg-red-500',
      tentative: 'inline-block h-2 w-2 rounded-full bg-amber-500',
      needsAction: 'inline-block h-2 w-2 rounded-full bg-gray-300',
    };
    return map[status] ?? map['needsAction'];
  }

  edit(): void {
    const e = this.event();
    if (e) this.state.openEditForm(e);
  }

  /** Đang hiện menu xác nhận xóa (riêng cái này / cả chuỗi) hay không */
  readonly confirmingDelete = signal(false);

  constructor() {
    // Đổi sang event khác thì tắt menu xác nhận xóa (tránh bấm nhầm sang event mới)
    effect(() => {
      this.state.selectedEventId();
      this.confirmingDelete.set(false);
    });

    // Mở/đổi event -> tải bình luận của event đó; đóng popover -> dọn
    effect(() => {
      const e = this.event();
      if (e) {
        this.comments.loadFor(e.id);
        this.loadAttachments(e.id);
      } else {
        this.comments.clear();
        this.attachments.set([]);
        this.clearUnlockTimers();
        this.editingId.set(null);
        this.deletingId.set(null);
        this.newComment.set('');
      }
    });
  }

  doDelete(scope?: 'series'): void {
    const e = this.event();
    if (e) this.state.deleteEvent(e.id, scope);
    this.confirmingDelete.set(false);
  }
}
