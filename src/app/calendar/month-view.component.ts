// View "Tháng": lưới 6 hàng x 7 cột, mỗi ô ngày hiển thị tối đa vài sự kiện dạng chip.

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CalendarEvent } from './calendar.types';
import { isSameDay, startOfMonth } from './date-utils';
import { HolidaysService } from './holidays.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';

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
      <div class="month-weekhead">
        @for (label of weekdayLabels(); track label) {
          <div>{{ label }}</div>
        }
      </div>

      <div class="month-grid flex-1">
        @for (cell of cells(); track cell.date.getTime()) {
          <div
            class="month-cell"
            [class.is-other]="!cell.inCurrentMonth"
            (click)="dateClicked.emit(cell.date)"
          >
            <span class="month-day-num" [class.is-today]="isToday(cell.date)">
              {{ cell.date.getDate() }}
            </span>

            <div class="flex flex-1 flex-col gap-1 overflow-hidden">
              @for (e of eventsFor(cell.date); track e.id) {
                <button
                  type="button"
                  (click)="onEventClick(e, $event)"
                  [class]="'evt-chip ' + colorClass(e.color)"
                >
                  {{ e.title || '(Không có tiêu đề)' }}
                </button>
              }
              @if (overflowCount(cell.date) > 0) {
                <span class="month-overflow">+{{ overflowCount(cell.date) }} nữa</span>
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

  private readonly settings = inject(SettingsService);
  private readonly tr = inject(TranslateService);
  readonly weekdayLabels = computed(() => this.tr.orderedWeekdays(this.settings.weekStartsOn()));
  private readonly today = new Date();

  cells = computed<MonthCell[]>(() => {
    const monthStart = startOfMonth(this.viewedDate());
    const firstWeekday = monthStart.getDay();
    // Số ô "tràn" của tháng trước, tính theo ngày bắt đầu tuần (0=CN, 1=T2).
    const leading = (firstWeekday - this.settings.weekStartsOn() + 7) % 7;
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const daysInPrevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate();

    const cells: MonthCell[] = [];
    for (let i = leading - 1; i >= 0; i--) {
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
      sky: 'evt-sky',
      violet: 'evt-violet',
      emerald: 'evt-emerald',
      rose: 'evt-rose',
      amber: 'evt-amber',
    };
    return map[color] ?? 'evt-sky';
  }

  onEventClick(e: CalendarEvent, domEvent: Event): void {
    domEvent.stopPropagation();
    this.eventClicked.emit(e);
  }
}
