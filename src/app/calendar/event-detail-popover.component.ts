// Popover chi tiết sự kiện — khớp bố cục hình 7: tiêu đề, thời gian, danh sách khách
// (kèm trạng thái RSVP), nút sửa (✏️)/xóa (🗑️)/đóng (✕).

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarStateService } from './calendar-state.service';
import { SupabaseService } from '../auth/supabase.service';
import { CommentsService } from './comments.service';
import { SettingsService } from '../settings/settings.service';
import { AttendeeStatus } from './calendar.types';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-event-detail-popover',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (event(); as e) {
      <div class="fixed inset-0 z-30" (click)="state.closeDetail()">
        <div
          class="popup-in absolute left-1/2 top-24 w-80 -translate-x-1/2 rounded-xl bg-white p-4 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full" [class]="dotClass(e.color)"></span>
              <h3 class="font-medium text-gray-900">{{ e.title || '(Không có tiêu đề)' }}</h3>
            </div>
            <div class="flex shrink-0 gap-1">
              <!-- Chỉ người TẠO mới sửa/xóa được (khách được mời không thấy 2 nút này) -->
              @if (canManage()) {
                <button type="button" (click)="edit()" class="rounded-full p-1 text-gray-500 hover:bg-gray-100" aria-label="Sửa"><app-icon name="pencil" class="h-4 w-4" /></button>
                <button type="button" (click)="confirmingDelete.set(true)" class="rounded-full p-1 text-gray-500 hover:bg-gray-100" aria-label="Xóa"><app-icon name="trash" class="h-4 w-4" /></button>
              }
              <button type="button" (click)="state.closeDetail()" class="rounded-full p-1 text-gray-500 hover:bg-gray-100" aria-label="Đóng"><app-icon name="x" class="h-4 w-4" /></button>
            </div>
          </div>

          <p class="mb-2 text-sm text-gray-600">{{ dateLabel(e.start) }} · {{ timeLabel(e.start) }} – {{ timeLabel(e.end) }}</p>

          @if (e.creatorEmail) {
            <p class="mb-2 text-sm text-gray-600">👤 Người tạo: {{ e.creatorEmail }}</p>
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
                {{ e.guests.length }} khách · {{ acceptedCount() }} đồng ý, {{ pendingCount() }} chưa trả lời
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
            <span class="text-gray-500">Tham dự?</span>
            <button
              type="button"
              (click)="rsvp('accepted')"
              class="rounded-full border px-3 py-1"
              [class]="myStatus() === 'accepted' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 hover:bg-gray-50'"
            >
              Có
            </button>
            <button
              type="button"
              (click)="rsvp('declined')"
              class="rounded-full border px-3 py-1"
              [class]="myStatus() === 'declined' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 hover:bg-gray-50'"
            >
              Không
            </button>
            <button
              type="button"
              (click)="rsvp('tentative')"
              class="rounded-full border px-3 py-1"
              [class]="myStatus() === 'tentative' ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-300 hover:bg-gray-50'"
            >
              Có thể
            </button>
          </div>

          <!-- Bình luận -->
          <div class="mt-4 border-t border-gray-100 pt-3">
            <p class="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <app-icon name="message" class="h-4 w-4" /> Bình luận
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
                      <button type="button" (click)="saveEdit(c.id)" class="text-xs font-medium text-blue-700 hover:underline">Lưu</button>
                      <button type="button" (click)="cancelEdit()" class="text-xs text-gray-500 hover:underline">Hủy</button>
                    </div>
                  } @else {
                    <p class="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-800">{{ c.content }}</p>
                    @if (isMine(c)) {
                      @if (deletingId() === c.id) {
                        <div class="mt-1 flex items-center gap-3">
                          <span class="text-xs text-red-700">Xóa bình luận?</span>
                          <button type="button" (click)="confirmDeleteComment(c.id)" class="text-xs font-medium text-red-600 hover:underline">Xóa</button>
                          <button type="button" (click)="deletingId.set(null)" class="text-xs text-gray-500 hover:underline">Hủy</button>
                        </div>
                      } @else {
                        <div class="mt-1 flex gap-3">
                          <button type="button" (click)="startEdit(c.id, c.content)" class="text-xs text-gray-500 hover:underline">Sửa</button>
                          <button type="button" (click)="deletingId.set(c.id)" class="text-xs text-red-500 hover:underline">Xóa</button>
                        </div>
                      }
                    }
                  }
                </li>
              } @empty {
                @if (!comments.loading()) {
                  <li class="text-xs text-gray-400">Chưa có bình luận nào.</li>
                }
              }
            </ul>

            <div class="flex gap-2">
              <textarea
                [(ngModel)]="newComment"
                rows="1"
                placeholder="Viết bình luận..."
                class="flex-1 resize-none rounded border border-gray-300 px-2 py-1 text-sm"
              ></textarea>
              <button
                type="button"
                (click)="sendComment()"
                [disabled]="!newComment().trim()"
                class="shrink-0 self-start rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40"
              >
                Gửi
              </button>
            </div>
          </div>

          <!-- Xác nhận xóa: nếu là sự kiện lặp thì cho chọn xóa riêng hoặc xóa cả chuỗi -->
          @if (confirmingDelete()) {
            <div class="mt-3 rounded-md bg-red-50 p-3 text-sm">
              <p class="mb-2 text-red-800">Xóa sự kiện này?</p>
              <div class="flex flex-wrap gap-2">
                <button type="button" (click)="doDelete()" class="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700">
                  Xóa sự kiện này
                </button>
                @if (e.seriesId) {
                  <button type="button" (click)="doDelete('series')" class="rounded bg-red-700 px-3 py-1 text-white hover:bg-red-800">
                    Xóa cả chuỗi lặp
                  </button>
                }
                <button type="button" (click)="confirmingDelete.set(false)" class="rounded px-3 py-1 text-gray-600 hover:bg-gray-100">
                  Hủy
                </button>
              </div>
            </div>
          }
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

  /** Nhãn tiếng Việt cho trạng thái RSVP của từng khách */
  statusLabel(status: string): string {
    const map: Record<string, string> = {
      accepted: 'Đồng ý',
      declined: 'Từ chối',
      tentative: 'Có thể',
      needsAction: 'Chưa trả lời',
    };
    return map[status] ?? 'Chưa trả lời';
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
    return d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
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
