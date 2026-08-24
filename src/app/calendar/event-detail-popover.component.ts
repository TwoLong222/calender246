// Popover chi tiết sự kiện — khớp bố cục hình 7: tiêu đề, thời gian, danh sách khách
// (kèm trạng thái RSVP), nút sửa (✏️)/xóa (🗑️)/đóng (✕).

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarStateService } from './calendar-state.service';
import { SupabaseService } from '../auth/supabase.service';
import { CommentsService } from './comments.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { AttendeeStatus } from './calendar.types';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-event-detail-popover',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (event(); as e) {
      <div class="detail-scrim" (click)="state.closeDetail()">
        <div class="popup-in detail-card" (click)="$event.stopPropagation()">
          <div class="detail-header">
            <div class="detail-title-row">
              <span class="detail-dot" [class]="'detail-dot ' + dotClass(e.color)"></span>
              <h3 class="detail-title">{{ e.title || tr.t('common.untitled') }}</h3>
            </div>
            <div class="detail-actions">
              @if (canManage()) {
                <button type="button" (click)="edit()" class="detail-icon-btn" [attr.aria-label]="tr.t('detail.edit')" [title]="tr.t('detail.edit')">
                  <app-icon name="pencil" class="h-4 w-4" />
                </button>
                <button type="button" (click)="confirmingDelete.set(true)" class="detail-icon-btn" [attr.aria-label]="tr.t('detail.delete')" [title]="tr.t('detail.delete')">
                  <app-icon name="trash" class="h-4 w-4" />
                </button>
              }
              <button type="button" (click)="state.closeDetail()" class="detail-icon-btn" [attr.aria-label]="tr.t('common.close')">
                <app-icon name="x" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div class="detail-body">
            <p class="detail-meta">
              <app-icon name="calendar" class="h-4 w-4" />
              <span>{{ dateLabel(e.start) }} · {{ timeLabel(e.start) }} – {{ timeLabel(e.end) }}</span>
            </p>

            @if (e.creatorEmail) {
              <p class="detail-meta">
                <app-icon name="user" class="h-4 w-4" />
                <span>{{ tr.t('detail.creator') }}: {{ e.creatorEmail }}</span>
              </p>
            }

            @if (e.location) {
              <p class="detail-meta">
                <app-icon name="map-pin" class="h-4 w-4" />
                <span>{{ e.location }}</span>
              </p>
            }
            @if (e.description) {
              <p class="detail-meta">
                <app-icon name="notes" class="h-4 w-4" />
                <span>{{ e.description }}</span>
              </p>
            }

            @if (e.guests.length > 0) {
              <div class="detail-section">
                <p class="detail-section-title">
                  <app-icon name="user" class="h-3.5 w-3.5" />
                  {{ e.guests.length }} {{ tr.t('detail.guests') }} · {{ acceptedCount() }} {{ tr.t('detail.accepted') }}, {{ pendingCount() }} {{ tr.t('detail.pending') }}
                </p>
                <ul class="detail-guest-list">
                  @for (g of e.guests; track g.email) {
                    <li class="detail-guest">
                      <span class="detail-guest-left">
                        <span [class]="'detail-guest-status-dot st-' + g.status"></span>
                        <span class="detail-guest-email">{{ g.email }}</span>
                      </span>
                      <span [class]="'detail-guest-status st-' + g.status">{{ statusLabel(g.status) }}</span>
                    </li>
                  }
                </ul>
              </div>
            }

            <div class="rsvp-row">
              <span class="rsvp-label">{{ tr.t('detail.attend') }}</span>
              <div class="rsvp-group">
                <button type="button" (click)="rsvp('accepted')"  class="rsvp-btn is-yes"   [class.is-on]="myStatus() === 'accepted'">{{ tr.t('rsvp.yes') }}</button>
                <button type="button" (click)="rsvp('declined')"  class="rsvp-btn is-no"    [class.is-on]="myStatus() === 'declined'">{{ tr.t('rsvp.no') }}</button>
                <button type="button" (click)="rsvp('tentative')" class="rsvp-btn is-maybe" [class.is-on]="myStatus() === 'tentative'">{{ tr.t('rsvp.maybe') }}</button>
              </div>
            </div>

            <!-- Bình luận -->
            <div class="detail-section">
              <p class="detail-section-title">
                <app-icon name="message" class="h-3.5 w-3.5" /> {{ tr.t('detail.comments') }}
              </p>

              <div class="detail-comments">
                <ul class="detail-comments-list">
                  @for (c of comments.comments(); track c.id) {
                    <li class="detail-comment">
                      <div class="detail-comment-head">
                        <span class="detail-comment-author">{{ c.userEmail }}</span>
                        <span class="detail-comment-time">{{ commentTime(c.createdAt) }}</span>
                      </div>
                      @if (editingId() === c.id) {
                        <textarea [(ngModel)]="editText" rows="2" class="detail-comment-edit-textarea"></textarea>
                        <div class="detail-comment-edit-actions">
                          <button type="button" (click)="saveEdit(c.id)" class="detail-comment-link" style="color: var(--accent)">{{ tr.t('form.save') }}</button>
                          <button type="button" (click)="cancelEdit()" class="detail-comment-link">{{ tr.t('del.cancel') }}</button>
                        </div>
                      } @else {
                        <p class="detail-comment-body">{{ c.content }}</p>
                        @if (isMine(c)) {
                          @if (deletingId() === c.id) {
                            <div class="detail-comment-actions">
                              <span class="detail-comment-link is-danger">{{ tr.t('detail.delComment') }}</span>
                              <button type="button" (click)="confirmDeleteComment(c.id)" class="detail-comment-link is-danger" style="font-weight: 600">{{ tr.t('detail.delete') }}</button>
                              <button type="button" (click)="deletingId.set(null)" class="detail-comment-link">{{ tr.t('del.cancel') }}</button>
                            </div>
                          } @else {
                            <div class="detail-comment-actions">
                              <button type="button" (click)="startEdit(c.id, c.content)" class="detail-comment-link">{{ tr.t('detail.edit') }}</button>
                              <button type="button" (click)="deletingId.set(c.id)" class="detail-comment-link is-danger">{{ tr.t('detail.delete') }}</button>
                            </div>
                          }
                        }
                      }
                    </li>
                  } @empty {
                    @if (!comments.loading()) {
                      <li class="detail-comment-empty">{{ tr.t('detail.noComments') }}</li>
                    }
                  }
                </ul>

                <div class="detail-comment-compose">
                  <textarea
                    [(ngModel)]="newComment"
                    rows="1"
                    [placeholder]="tr.t('detail.writeComment')"
                  ></textarea>
                  <button
                    type="button"
                    (click)="sendComment()"
                    [disabled]="!newComment().trim()"
                    class="detail-send"
                  >{{ tr.t('detail.send') }}</button>
                </div>
              </div>
            </div>

            <!-- Xác nhận xóa -->
            @if (confirmingDelete()) {
              <div class="detail-confirm">
                <p>{{ tr.t('detail.deleteEvent') }}</p>
                <div class="detail-confirm-actions">
                  <button type="button" (click)="doDelete()" class="btn-danger">{{ tr.t('detail.deleteThis') }}</button>
                  @if (e.seriesId) {
                    <button type="button" (click)="doDelete('series')" class="btn-danger is-strong">{{ tr.t('detail.deleteSeries') }}</button>
                  }
                  <button type="button" (click)="confirmingDelete.set(false)" class="btn-ghost">{{ tr.t('del.cancel') }}</button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class EventDetailPopoverComponent {
  protected readonly state = inject(CalendarStateService);
  private readonly supabase = inject(SupabaseService);
  protected readonly comments = inject(CommentsService);
  private readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);

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
    if (!e.creatorEmail) return true;
    return e.creatorEmail.toLowerCase() === this.supabase.user()?.email?.toLowerCase();
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
      sky: 'dot-sky',
      violet: 'dot-violet',
      emerald: 'dot-emerald',
      rose: 'dot-rose',
      amber: 'dot-amber',
    };
    return map[color] ?? 'dot-sky';
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
      } else {
        this.comments.clear();
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
