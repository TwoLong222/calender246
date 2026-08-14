// View "Năm": lưới 12 mini-calendar (mỗi tháng 1 ô), giống Google Calendar year view.
// Không hiển thị event trong view này (đúng hành vi Google Calendar thật) — chỉ để định hướng nhanh.

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { isSameDay, MONTH_LABELS } from './date-utils';

interface MiniMonthCell {
  date: Date;
  inCurrentMonth: boolean;
}

@Component({
  selector: 'app-year-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid h-full grid-cols-4 gap-6 overflow-y-auto p-4">
      @for (month of months(); track month.getTime()) {
        <div>
          <div class="mb-2 text-center text-sm font-medium text-gray-700">{{ MONTH_LABELS[month.getMonth()] }}</div>
          <div class="grid grid-cols-7 gap-y-1 text-center text-[10px] text-gray-400">
            @for (label of weekdayLabels; track label) {
              <span>{{ label }}</span>
            }
          </div>
          <div class="grid grid-cols-7 gap-y-1 text-center">
            @for (cell of cellsFor(month); track cell.date.getTime()) {
              <button
                type="button"
                (click)="dateClicked.emit(cell.date)"
                class="mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px]"
                [class.text-gray-300]="!cell.inCurrentMonth"
                [class.text-gray-700]="cell.inCurrentMonth && !isToday(cell.date)"
                [class.bg-blue-700]="isToday(cell.date)"
                [class.text-white]="isToday(cell.date)"
              >
                {{ cell.date.getDate() }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class YearViewComponent {
  viewedDate = input.required<Date>();
  dateClicked = output<Date>();

  readonly MONTH_LABELS = MONTH_LABELS;
  readonly weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  private readonly today = new Date();

  months = computed(() => {
    const year = this.viewedDate().getFullYear();
    return Array.from({ length: 12 }, (_, m) => new Date(year, m, 1));
  });

  cellsFor(monthStart: Date): MiniMonthCell[] {
    const firstWeekday = monthStart.getDay();
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const daysInPrevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate();

    const cells: MiniMonthCell[] = [];
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
  }

  isToday(d: Date): boolean {
    return isSameDay(d, this.today);
  }
}
