// Popover chi tiết sự kiện — khớp bố cục hình 7: tiêu đề, thời gian, danh sách khách
// (kèm trạng thái RSVP), nút sửa (✏️)/xóa (🗑️)/đóng (✕).

import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarStateService } from './calendar-state.service';
import { SupabaseService } from '../auth/supabase.service';
import { CommentsService } from './comments.service';
import { AttachmentsApiService, EventAttachment, MAX_ATTACHMENT_BYTES, MAX_EVENT_ATTACHMENT_BYTES } from './attachments-api.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { ConfirmService } from '../shared/confirm.service';
import { AttendeeStatus } from './calendar.types';
import { eventColorClass, eventColorStyle } from './event-color';
import { IconComponent } from '../shared/icon.component';
import { DateTimePickerComponent } from '../shared/datetime-picker.component';
import { descriptionToHtml, htmlToPlain } from '../shared/html-text';
import { solarToLunar } from '../lunar/lunar.util';

@Component({
  selector: 'app-event-detail-popover',
  standalone: true,
  imports: [FormsModule, IconComponent, DateTimePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (event(); as e) {
      <div class="fixed inset-0 z-30" (click)="state.closeDetail()">
        <div
          #panelEl
          class="popup-in surface-panel absolute w-80 overflow-y-auto overflow-x-hidden !rounded-[var(--radius-lg)] p-4 !shadow-[var(--shadow-lg)]"
          [style.left.px]="panelPos().left"
          [style.top.px]="panelPos().top"
          [style.max-height.px]="panelPos().maxHeight"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <div class="flex min-w-0 items-start gap-2">
              <span class="mt-1.5 h-3 w-3 shrink-0 rounded-full" [class]="dotClass(e.color)" [style.background-color]="dotStyle(e.color)"></span>
              <h3 class="min-w-0 break-words font-semibold text-gray-900">{{ e.title || tr.t('common.untitled') }}</h3>
            </div>
            <div class="flex shrink-0 gap-0.5">
              <!-- Chỉ người TẠO mới sửa/xóa được (khách được mời không thấy 2 nút này) -->
              @if (canManage()) {
                <button type="button" (click)="edit()" class="btn-icon !p-1.5" [attr.aria-label]="tr.t('detail.edit')"><app-icon name="pencil" class="h-4 w-4" /></button>
                <button type="button" (click)="askDelete()" class="btn-icon !p-1.5" [attr.aria-label]="tr.t('detail.delete')"><app-icon name="trash" class="h-4 w-4" /></button>
              }
              <button type="button" (click)="state.closeDetail()" class="btn-icon !p-1.5" [attr.aria-label]="tr.t('common.close')"><app-icon name="x" class="h-4 w-4" /></button>
            </div>
          </div>

          <p class="mono mb-2 text-sm text-gray-600">
            {{ dateLabel(e.start) }} · {{ timeLabel(e.start) }} – {{ timeLabel(e.end) }}
            <span class="text-xs text-amber-600">({{ tr.t('detail.lunarShort') }} {{ lunarLabel(e.start) }})</span>
          </p>

          <!-- Google Meet -->
          <div class="mb-2 flex items-center gap-2">
            @if (e.meetLink) {
              <a [href]="e.meetLink" target="_blank" rel="noopener" class="btn btn-primary !bg-emerald-600 hover:!bg-emerald-700">📹 Tham gia Google Meet</a>
              @if (canManage()) {
                <button type="button" (click)="state.removeMeetForEvent(e.id)" class="btn-icon !p-1.5 hover:!text-red-600" title="Gỡ Google Meet" aria-label="Gỡ Meet"><app-icon name="x" class="h-4 w-4" /></button>
              }
            } @else if (canManage()) {
              <button type="button" (click)="state.createMeetForEvent(e.id)" class="btn btn-secondary">📹 Tạo Google Meet</button>
            }
          </div>

          <!-- Sự kiện lặp: cho biết lặp bao nhiêu lần và kéo dài tới ngày nào -->
          @if (seriesInfo(); as s) {
            <p class="mb-2 text-sm text-gray-600">
              🔁 {{ tr.t('detail.repeats') }}:
              <span class="font-medium">{{ s.count }} {{ tr.t('detail.times') }}</span>
              · {{ s.first }} → {{ s.last }}
            </p>
          }

          @if (e.creatorEmail) {
            <p class="mb-2 break-all text-sm text-gray-600">👤 {{ tr.t('detail.creator') }}: {{ e.creatorEmail }}</p>
          }

          @if (e.location) {
            <!-- break-words: địa điểm/mô tả có thể chứa chuỗi dài không dấu cách (vd link dán vào).
                 Popover đang overflow-x-hidden nên không ngắt từ là chữ bị CẮT MẤT, không cuộn được. -->
            <p class="rich-text mb-2 break-words text-sm text-gray-600">📍 <span [innerHTML]="locationHtml()"></span></p>
          }
          @if (e.description) {
            <!-- Mô tả dài (thư mời Google hay kèm cả khối hướng dẫn gọi điện) chiếm hết popover
                 nên mặc định thu gọn; chỉ hiện nút khi thật sự dài. -->
            <div class="mb-2 flex items-start gap-2 text-sm text-gray-600">
              <app-icon name="notes" class="mt-0.5 h-4 w-4 shrink-0" />
              <div class="min-w-0 flex-1">
                <div
                  class="rich-text break-words"
                  [class.line-clamp-6]="descLong() && !descExpanded()"
                  [innerHTML]="descHtml()"
                ></div>
                @if (descLong()) {
                  <button type="button" (click)="descExpanded.set(!descExpanded())" class="tap mt-0.5 text-xs font-medium text-blue-600 hover:underline">
                    {{ descExpanded() ? tr.t('detail.showLess') : tr.t('detail.showMore') }}
                  </button>
                }
              </div>
            </div>
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

          <!-- CHỈ hiện khi mình THỰC SỰ nằm trong danh sách khách mời. Trước đây khối này
               không có điều kiện nên ai mở sự kiện cũng thấy "Tham dự?", kể cả người không
               được mời và cả chính người tạo sự kiện không có khách nào. -->
          @if (isInvited()) {
          <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm">
            <span class="text-gray-500">{{ tr.t('detail.attend') }}</span>
            <button
              type="button"
              (click)="rsvp('accepted')"
              class="tap rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              [class]="myStatus() === 'accepted' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 hover:bg-gray-50'"
            >
              {{ tr.t('rsvp.yes') }}
            </button>
            <button
              type="button"
              (click)="rsvp('declined')"
              class="tap rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              [class]="myStatus() === 'declined' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 hover:bg-gray-50'"
            >
              {{ tr.t('rsvp.no') }}
            </button>
            <button
              type="button"
              (click)="rsvp('tentative')"
              class="tap rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              [class]="myStatus() === 'tentative' ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-300 hover:bg-gray-50'"
            >
              {{ tr.t('rsvp.maybe') }}
            </button>
          </div>
          }

          <!-- Tài liệu đính kèm -->
          <div class="mt-4 border-t border-gray-100 pt-3">
            <div class="mb-2 flex items-center justify-between">
              <p class="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <app-icon name="notes" class="h-4 w-4" /> {{ tr.t('attach.title') }}
              </p>
              @if (canManage()) {
                <label class="btn btn-secondary !py-1 !text-xs cursor-pointer">
                  {{ uploading() ? tr.t('attach.uploading') : tr.t('attach.add') }}
                  <input type="file" class="hidden" (change)="onFileSelected($event)" [disabled]="uploading()" />
                </label>
              }
            </div>
            @if (canManage()) {
              <p class="mb-1 text-[11px] text-gray-500">{{ tr.t('attach.limit') }}</p>
            }
            @if (uploadError()) {
              <p class="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">{{ uploadError() }}</p>
            }
            @if (canManage()) {
              <!-- Hẹn giờ cho file SẼ tải lên (áp cho lần thêm kế tiếp). Mỗi mốc nằm gọn trên
                   MỘT dòng: nhãn — ô ngày — ô giờ. Popover chỉ rộng w-80 nên dùng bản compact
                   của datetime-picker (ô hẹp hơn, không cho xuống dòng); nhãn cố định w-10 để
                   hai dòng "Mở từ" và "Đến" thẳng cột với nhau. -->
              <div class="mb-2 flex flex-col gap-2 rounded bg-gray-50 p-2 text-xs">
                <label class="flex items-center gap-1 text-gray-500">
                  <span class="w-10 shrink-0">{{ tr.t('attach.from') }}</span>
                  <app-datetime-picker [(ngModel)]="newFrom" [compact]="true" />
                </label>
                <label class="flex items-center gap-1 text-gray-500">
                  <span class="w-10 shrink-0">{{ tr.t('attach.until') }}</span>
                  <app-datetime-picker [(ngModel)]="newUntil" [compact]="true" />
                </label>
              </div>
            }
            @if (attachments().length === 0) {
              <p class="text-xs text-gray-400">{{ tr.t('attach.none') }}</p>
            } @else {
              <ul class="space-y-1">
                @for (a of attachments(); track a.id) {
                  <li class="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1 text-sm">
                    @if (a.status === 'available' && a.url) {
                      <a [href]="a.url" target="_blank" rel="noopener" class="min-w-0 flex-1 truncate text-blue-700">{{ a.file_name }}</a>
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
                    <!-- Sửa bình luận: Enter = Lưu, Shift+Enter = xuống dòng, Esc = Huỷ. -->
                    <textarea
                      [(ngModel)]="editText" maxlength="2000" rows="2"
                      (keydown.enter)="$event.preventDefault(); saveEdit(c.id)"
                      (keydown.escape)="cancelEdit()"
                      class="field mt-1 w-full text-sm"
                    ></textarea>
                    <div class="mt-1 flex gap-3">
                      <button type="button" (click)="saveEdit(c.id)" class="text-xs font-medium text-blue-700">{{ tr.t('form.save') }}</button>
                      <button type="button" (click)="cancelEdit()" class="text-xs text-gray-500">{{ tr.t('del.cancel') }}</button>
                    </div>
                  } @else {
                    <p class="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-800">{{ c.content }}</p>
                    @if (isMine(c)) {
                      @if (deletingId() === c.id) {
                        <div class="mt-1 flex items-center gap-3">
                          <span class="text-xs text-red-700">{{ tr.t('detail.delComment') }}</span>
                          <button type="button" (click)="confirmDeleteComment(c.id)" class="text-xs font-medium text-red-600">{{ tr.t('detail.delete') }}</button>
                          <button type="button" (click)="deletingId.set(null)" class="text-xs text-gray-500">{{ tr.t('del.cancel') }}</button>
                        </div>
                      } @else {
                        <div class="mt-1 flex gap-3">
                          <button type="button" (click)="startEdit(c.id, c.content)" class="text-xs text-gray-500">{{ tr.t('detail.edit') }}</button>
                          <button type="button" (click)="deletingId.set(c.id)" class="text-xs text-red-500">{{ tr.t('detail.delete') }}</button>
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
              <!-- Enter = Gửi (thay cho bấm nút bên cạnh), Shift+Enter = xuống dòng.
                   preventDefault để Enter không chèn thêm dòng trống trước khi gửi.
                   Angular chỉ khớp (keydown.enter) khi KHÔNG giữ phím bổ trợ, nên
                   Shift+Enter tự rơi vào hành vi mặc định của textarea. -->
              <textarea
                [(ngModel)]="newComment" maxlength="2000"
                rows="1"
                (keydown.enter)="$event.preventDefault(); sendComment()"
                [placeholder]="tr.t('detail.writeComment')"
                class="field flex-1 resize-none text-sm"
              ></textarea>
              <!-- Bỏ [disabled]="!newComment().trim()" — trước đây nút bị khóa/mờ đi trong
                   lúc đang gõ khiến người dùng tưởng bị "lock". sendComment() tự kiểm tra
                   rỗng bên trong (xem bên dưới), bấm khi chưa gõ gì chỉ no-op, không lỗi. -->
              <button
                type="button"
                (click)="sendComment()"
                class="tap btn btn-primary shrink-0 self-start !py-1.5"
              >{{ tr.t('detail.send') }}
              </button>
            </div>
          </div>

          <!-- Xác nhận xóa đã chuyển sang popup dùng chung (ConfirmService) — xem askDelete(). -->
        </div>
      </div>
    }

    <!-- Chọn khoảng ngày cần xoá trong chuỗi lặp (mở từ nút "Xoá theo khoảng ngày…") -->
    @if (rangeDeleteOpen()) {
      <div class="modal-backdrop-in fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4" (click)="rangeDeleteOpen.set(false)">
        <div class="modal-card-in w-full max-w-sm !rounded-[var(--radius-lg)] bg-white p-5 !shadow-[var(--shadow-lg)]" (click)="$event.stopPropagation()">
          <p class="text-base font-semibold text-gray-900">{{ tr.t('detail.deleteRangeTitle') }}</p>
          <p class="mt-1 text-sm text-gray-500">{{ tr.t('detail.deleteRangeHint') }}</p>

          <div class="mt-4 space-y-3">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-gray-600">{{ tr.t('detail.rangeFrom') }}</span>
              <input type="date" [value]="rangeFrom()" (input)="rangeFrom.set($any($event.target).value)" class="field w-full" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-gray-600">{{ tr.t('detail.rangeTo') }}</span>
              <input type="date" [value]="rangeTo()" (input)="rangeTo.set($any($event.target).value)" class="field w-full" />
            </label>
          </div>

          @if (rangeError(); as err) {
            <p class="mt-2 text-xs text-red-600">{{ err }}</p>
          }

          <div class="mt-5 flex justify-end gap-2">
            <button type="button" (click)="rangeDeleteOpen.set(false)" class="btn btn-secondary">{{ tr.t('del.cancel') }}</button>
            <button type="button" (click)="confirmRangeDelete()" class="btn text-white !bg-red-600 hover:!bg-red-700">{{ tr.t('detail.deleteRangeBtn') }}</button>
          </div>

          <!-- NGẮT LẶP: dừng hẳn chuỗi từ "Từ ngày" trở đi — không cần biết chuỗi kết thúc
               ngày nào, nên để riêng chứ không nhét chung nút xoá khoảng ở trên. -->
          <div class="mt-4 border-t border-gray-200 pt-3">
            <p class="mb-2 text-xs text-gray-500">{{ tr.t('detail.stopRepeatHint') }}</p>
            <button
              type="button"
              (click)="confirmStopRepeat()"
              class="btn btn-secondary w-full !justify-center"
            >{{ tr.t('detail.stopRepeat') }} {{ rangeFrom() || '…' }}</button>
          </div>
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

  /**
   * Vị trí bảng chi tiết — CHỐT MỘT LẦN lúc mở sự kiện (xem effect trong constructor).
   * KHÔNG được tính lại theo con trỏ: nếu tính lại, mỗi lần bấm trong bảng (nút X, nút
   * xoá…) bảng sẽ nhích theo chuột, nút trượt khỏi ngón tay và cú bấm không ăn.
   */
  protected readonly panelPos = signal<{ left: number; top: number; maxHeight: number }>({ left: 0, top: 96, maxHeight: 2000 });
  private readonly panelEl = viewChild<ElementRef<HTMLDivElement>>('panelEl');
  private adjustRaf: number | null = null;

  /**
   * Tính chỗ đặt bảng (ước lượng ban đầu) từ vị trí vừa bấm, kẹp lại để không tràn
   * khỏi màn hình. maxHeight ở đây chỉ là giới hạn AN TOÀN tuyệt đối (gần hết chiều
   * cao màn hình) — vị trí thật để bảng luôn hiện đủ (không bị cắt) do adjustToFit()
   * đảm nhiệm sau khi bảng đã vẽ xong và biết chiều cao thật.
   */
  private computePanelPos(): { left: number; top: number; maxHeight: number } {
    const W = 320; // = w-80
    const M = 12; // chừa mép
    const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
    const maxHeight = Math.max(200, vh - 2 * M);
    const p = this.state.lastPointer();
    if (!p || vw < 768) return { left: Math.max(M, (vw - W) / 2), top: 96, maxHeight };
    return {
      left: Math.min(Math.max(p.x - W / 2, M), Math.max(M, vw - W - M)),
      top: Math.min(Math.max(p.y - 24, M), Math.max(M, vh - 360)),
      maxHeight,
    };
  }

  /**
   * Sau khi bảng đã vẽ xong (biết chiều cao THẬT tùy nội dung: đính kèm, bình luận…),
   * đẩy top lên nếu bảng tràn quá đáy màn hình — để bảng luôn hiện trọn vẹn, không
   * phải cuộn bên trong, giống cách Google Calendar tự "lật" popup lên trên khi bên
   * dưới không đủ chỗ.
   */
  private adjustToFit(): void {
    const el = this.panelEl()?.nativeElement;
    if (!el) return;
    const M = 12;
    const vh = window.innerHeight;
    const h = el.offsetHeight;
    const maxTop = Math.max(M, vh - h - M);
    const cur = this.panelPos();
    if (cur.top > maxTop) this.panelPos.set({ ...cur, top: maxTop });
  }

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
    if (this.adjustRaf) cancelAnimationFrame(this.adjustRaf);
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
    // Chặn khi TỔNG dung lượng đính kèm của sự kiện + file mới vượt 100MB.
    const usedBytes = this.attachments().reduce((sum, a) => sum + (a.size_bytes ?? 0), 0);
    if (usedBytes + file.size > MAX_EVENT_ATTACHMENT_BYTES) {
      this.uploadError.set(this.tr.t('attach.eventTooLarge'));
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

  /** Mô tả đã dựng thành HTML (giữ xuống dòng + URL trần thành liên kết bấm được).
   *  Là computed để DOMParser chỉ chạy khi đổi sự kiện, không chạy mỗi lần vẽ lại. */
  protected readonly descHtml = computed(() => descriptionToHtml(this.event()?.description));

  /** Đang mở hết mô tả hay đang thu gọn. Đổi sang sự kiện khác thì thu gọn lại. */
  protected readonly descExpanded = signal(false);

  /** Chỉ hiện nút "Xem thêm" khi mô tả đủ dài, không thì nút thừa dưới 1 dòng chữ. */
  protected readonly descLong = computed(() => {
    const plain = htmlToPlain(this.event()?.description);
    return plain.length > 260 || plain.split('\n').length > 6;
  });

  /** Địa điểm dán nguyên link (Meet/Teams/Zoom) thì cho bấm luôn thay vì chữ chết. */
  protected readonly locationHtml = computed(() => descriptionToHtml(this.event()?.location));

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

  /**
   * Mình có nằm trong danh sách khách mời của sự kiện này không.
   * Dùng để quyết định có hiện khối "Tham dự? Có/Không/Có thể" hay không — người không
   * được mời (kể cả chủ sự kiện khi không mời ai) thì không có gì để trả lời.
   */
  protected readonly isInvited = computed<boolean>(() => {
    const email = this.supabase.user()?.email?.toLowerCase();
    const e = this.event();
    if (!email || !e) return false;
    return e.guests.some((g) => g.email.toLowerCase() === email);
  });

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

  /** Ngày âm tương ứng, vd "16/7" — để khỏi phải mở trang âm lịch riêng để tra. */
  protected lunarLabel(d: Date): string {
    const l = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
    return `${l.day}/${l.month}${l.leap ? ' ' + this.tr.t('lunar.leap') : ''}`;
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
    return eventColorClass(color);
  }

  /** Màu nền cho chấm khi người dùng tự chọn mã hex (rỗng nếu dùng màu dựng sẵn). */
  dotStyle(color: string): string {
    return eventColorStyle(color);
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

  constructor() {
    // CHỐT vị trí bảng ngay khi mở (hoặc đổi sang sự kiện khác). untracked() để hàm
    // tính vị trí đọc lastPointer mà KHÔNG bị chạy lại mỗi lần con trỏ bấm chỗ mới.
    effect(() => {
      const id = this.state.selectedEventId();
      if (this.adjustRaf) { cancelAnimationFrame(this.adjustRaf); this.adjustRaf = null; }
      if (!id) return;
      untracked(() => this.panelPos.set(this.computePanelPos()));
    });

    // Đổi sang sự kiện khác -> thu gọn lại mô tả, không thì sự kiện mới mở ra đã bung sẵn.
    effect(() => {
      this.state.selectedEventId();
      untracked(() => this.descExpanded.set(false));
    });

    /**
     * Bình luận/đính kèm được TẢI BẤT ĐỒNG BỘ (gọi API riêng, xong sau khi bảng đã
     * mở) nên chiều cao thật của bảng còn tăng thêm SAU lần đo đầu tiên — nếu chỉ
     * chỉnh vị trí một lần lúc mở, phần vừa tải xong (đính kèm/bình luận) vẫn có thể
     * bị tràn ra ngoài. Effect này đọc lại các danh sách đó để tự chỉnh lại mỗi khi
     * chúng thay đổi, đảm bảo bảng luôn hiện trọn vẹn.
     */
    effect(() => {
      const id = this.state.selectedEventId();
      this.comments.comments();
      this.attachments();
      if (!id) return;
      if (this.adjustRaf) cancelAnimationFrame(this.adjustRaf);
      this.adjustRaf = requestAnimationFrame(() => { this.adjustRaf = null; this.adjustToFit(); });
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

  /**
   * Hỏi xác nhận bằng popup dùng chung. Sự kiện lặp có thêm 2 lựa chọn:
   * "Xóa cả chuỗi" và "Xoá theo khoảng ngày…" (mở modal chọn từ ngày → đến ngày).
   */
  async askDelete(): Promise<void> {
    const e = this.event();
    if (!e) return;
    const r = await this.confirm.askEx({
      message: this.tr.t('detail.deleteEvent'),
      detail: e.title || this.tr.t('common.untitled'),
      confirmText: e.seriesId ? this.tr.t('detail.deleteThis') : this.tr.t('detail.delete'),
      secondaryText: e.seriesId ? this.tr.t('detail.deleteSeries') : undefined,
      tertiaryText: e.seriesId ? this.tr.t('detail.deleteRange') : undefined,
    });
    if (r === 'no') return;
    if (r === 'tertiary') {
      // Mặc định gợi ý đúng ngày của sự kiện đang mở, người dùng chỉnh lại tuỳ ý.
      const d = this.toDateInput(e.start);
      this.rangeFrom.set(d);
      this.rangeTo.set(d);
      this.rangeError.set('');
      this.rangeDeleteOpen.set(true);
      return;
    }
    this.state.deleteEvent(e.id, r === 'secondary' ? 'series' : undefined);
  }

  /**
   * Tóm tắt chuỗi lặp của sự kiện đang mở: lặp mấy lần, từ ngày nào tới ngày nào.
   * Tính từ chính danh sách sự kiện đã tải (backend sinh sẵn mọi lần lặp), nên không
   * cần gọi thêm API. null nếu sự kiện không thuộc chuỗi lặp nào.
   */
  protected readonly seriesInfo = computed<{ count: number; first: string; last: string } | null>(() => {
    const e = this.event();
    if (!e?.seriesId) return null;
    const all = this.state
      .events()
      .filter((x) => x.seriesId === e.seriesId)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    if (all.length === 0) return null;
    return {
      count: all.length,
      first: this.settings.formatDate(all[0].start),
      last: this.settings.formatDate(all[all.length - 1].start),
    };
  });

  // ----- Xoá chuỗi lặp theo khoảng ngày -----
  protected readonly rangeDeleteOpen = signal(false);
  protected readonly rangeFrom = signal('');
  protected readonly rangeTo = signal('');
  protected readonly rangeError = signal('');

  /** Date -> 'YYYY-MM-DD' theo giờ ĐỊA PHƯƠNG (không dùng toISOString vì nó đổi sang UTC). */
  private toDateInput(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  protected confirmRangeDelete(): void {
    const e = this.event();
    const from = this.rangeFrom();
    const to = this.rangeTo();
    if (!e) return;
    if (!from || !to) {
      this.rangeError.set(this.tr.t('detail.rangeMissing'));
      return;
    }
    if (from > to) {
      this.rangeError.set(this.tr.t('detail.rangeInvalid'));
      return;
    }
    this.rangeDeleteOpen.set(false);
    this.state.deleteEvent(e.id, 'range', { from, to });
  }

  /** Ngắt lặp: dừng chuỗi từ ô "Từ ngày" trở đi, các lần trước đó giữ nguyên. */
  protected confirmStopRepeat(): void {
    const e = this.event();
    const from = this.rangeFrom();
    if (!e) return;
    if (!from) {
      this.rangeError.set(this.tr.t('detail.rangeMissingFrom'));
      return;
    }
    this.rangeDeleteOpen.set(false);
    this.state.deleteEvent(e.id, 'from', { from });
  }
}
