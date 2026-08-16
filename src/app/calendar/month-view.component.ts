// View "Tháng": lưới 6 hàng x 7 cột, mỗi ô ngày hiển thị tối đa vài sự kiện dạng chip.

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CalendarEvent } from './calendar.types';
import { isSameDay, startOfMonth } from './date-utils';

interface MonthCell {
  date: Date;
  inCurrentMonth: boolean;
}

const MAX_CHIPS_PER_CELL = 3;

@Component({
  selector: 'app-month-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full flex-col">
      <div class="grid grid-cols-7 border-b border-gray-200 text-center text-xs font-medium uppercase text-gray-500">
        @for (label of weekdayLabels; track label) {
          <div class="py-2">{{ label }}</div>
        }
      </div>

      <div class="grid flex-1 grid-cols-7 grid-rows-6">
        @for (cell of cells(); track cell.date.getTime()) {
          <div
            class="flex flex-col border-b border-r border-gray-100 p-1"
            [class.bg-gray-50]="!cell.inCurrentMonth"
            (click)="dateClicked.emit(cell.date)"
          >
            <span
              class="mb-1 flex h-6 w-6 items-center justify-center self-end rounded-full text-sm"
              [class.text-gray-300]="!cell.inCurrentMonth"
              [class.text-gray-700]="cell.inCurrentMonth && !isToday(cell.date)"
              [class.bg-blue-700]="isToday(cell.date)"
              [class.text-white]="isToday(cell.date)"
            >
              {{ cell.date.getDate() }}
            </span>

            <div class="flex flex-1 flex-col gap-0.5 overflow-hidden">
              @for (e of eventsFor(cell.date); track e.id) {
                <button
                  type="button"
                  (click)="onEventClick(e, $event)"
                  class="truncate rounded px-1 text-left text-[11px] text-white"
                  [class]="colorClass(e.color)"
                >
                  {{ e.title || '(Không có tiêu đề)' }}
                </button>
              }
              @if (overflowCount(cell.date) > 0) {
                <span class="px-1 text-[11px] text-gray-500">+{{ overflowCount(cell.date) }} nữa</span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class MonthViewComponent {
  viewedDate = input.required<Date>();
  events = input.required<CalendarEvent[]>();

  dateClicked = output<Date>();
  eventClicked = output<CalendarEvent>();

  readonly weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  private readonly today = new Date();

  cells = computed<MonthCell[]>(() => {
    const monthStart = startOfMonth(this.viewedDate());
    const firstWeekday = monthStart.getDay();
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const daysInPrevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate();

    const cells: MonthCell[] = [];
    for (let i = firstWeekday - 1; i >= 0; i--) {
      cells.push({
        date: new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, daysInPrevMonth - i),
        inCurrentMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(monthStart.getFullYear(), monthStart.getMonth(), d), inCurrentMonth: true });
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inCurrentMonth: false });
    }
    return cells;
  });

  isToday(d: Date): boolean {
    return isSameDay(d, this.today);
  }

  private eventsOnDate(d: Date): CalendarEvent[] {
    return this.events().filter((e) => isSameDay(e.start, d));
  }

  eventsFor(d: Date): CalendarEvent[] {
    return this.eventsOnDate(d).slice(0, MAX_CHIPS_PER_CELL);
  }

  overflowCount(d: Date): number {
    return Math.max(0, this.eventsOnDate(d).length - MAX_CHIPS_PER_CELL);
  }

  colorClass(color: string): string {
    const map: Record<string, string> = {
      sky: 'bg-sky-600',
      violet: 'bg-violet-600',
      emerald: 'bg-emerald-600',
      rose: 'bg-rose-600',
      amber: 'bg-amber-600',
    };
    return map[color] ?? 'bg-sky-600';
  }

  onEventClick(e: CalendarEvent, domEvent: Event): void {
    domEvent.stopPropagation();
    this.eventClicked.emit(e);
  }
}
