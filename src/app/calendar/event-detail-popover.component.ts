// Popover chi tiết sự kiện — khớp bố cục hình 7: tiêu đề, thời gian, danh sách khách
// (kèm trạng thái RSVP), nút sửa (✏️)/xóa (🗑️)/đóng (✕).

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CalendarStateService } from './calendar-state.service';
import { SupabaseService } from '../auth/supabase.service';
import { AttendeeStatus } from './calendar.types';

@Component({
  selector: 'app-event-detail-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (event(); as e) {
      <div class="fixed inset-0 z-30" (click)="state.closeDetail()">
        <div
          class="absolute left-1/2 top-24 w-80 -translate-x-1/2 rounded-xl bg-white p-4 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full" [class]="dotClass(e.color)"></span>
              <h3 class="font-medium text-gray-900">{{ e.title || '(Không có tiêu đề)' }}</h3>
            </div>
            <div class="flex shrink-0 gap-1">
              <button type="button" (click)="edit()" class="rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="Sửa">✏️</button>
              <button type="button" (click)="confirmingDelete.set(true)" class="rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="Xóa">🗑️</button>
              <button type="button" (click)="state.closeDetail()" class="rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="Đóng">✕</button>
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
            <p class="mb-2 text-sm text-gray-600">📝 {{ e.description }}</p>
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

  event = computed(() => this.state.selectedEvent());

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
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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
  }

  doDelete(scope?: 'series'): void {
    const e = this.event();
    if (e) this.state.deleteEvent(e.id, scope);
    this.confirmingDelete.set(false);
  }
}
