// Popover chi tiết sự kiện — khớp bố cục hình 7: tiêu đề, thời gian, danh sách khách
// (kèm trạng thái RSVP), nút sửa (✏️)/xóa (🗑️)/đóng (✕).

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CalendarStateService } from './calendar-state.service';

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
              <button type="button" (click)="remove()" class="rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="Xóa">🗑️</button>
              <button type="button" (click)="state.closeDetail()" class="rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="Đóng">✕</button>
            </div>
          </div>

          <p class="mb-2 text-sm text-gray-600">{{ dateLabel(e.start) }} · {{ timeLabel(e.start) }} – {{ timeLabel(e.end) }}</p>

          @if (e.location) {
            <p class="mb-2 text-sm text-gray-600">📍 {{ e.location }}</p>
          }
          @if (e.description) {
            <p class="mb-2 text-sm text-gray-600">📝 {{ e.description }}</p>
          }

          @if (e.guests.length > 0) {
            <div class="mt-3 border-t border-gray-100 pt-3">
              <p class="mb-1 text-xs text-gray-400">{{ e.guests.length }} khách</p>
              <ul class="space-y-1">
                @for (g of e.guests; track g.email) {
                  <li class="flex items-center gap-2 text-sm text-gray-700">
                    <span [class]="statusDotClass(g.status)"></span>
                    {{ g.email }}
                  </li>
                }
              </ul>
            </div>
          }

          <div class="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3 text-sm">
            <span class="text-gray-500">Tham dự?</span>
            <button type="button" class="rounded-full border border-gray-300 px-3 py-1 hover:bg-gray-50">Có</button>
            <button type="button" class="rounded-full border border-gray-300 px-3 py-1 hover:bg-gray-50">Không</button>
            <button type="button" class="rounded-full border border-gray-300 px-3 py-1 hover:bg-gray-50">Có thể</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EventDetailPopoverComponent {
  protected readonly state = inject(CalendarStateService);

  event = computed(() => this.state.selectedEvent());

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

  remove(): void {
    const e = this.event();
    if (e && confirm(`Xóa sự kiện "${e.title}"?`)) {
      this.state.deleteEvent(e.id);
    }
  }
}
