// Mini calendar ở sidebar — giúp người dùng biết mình đang ở đâu khi navigate.
// Chấm xanh ĐẬM = hôm nay (theo giờ hệ thống máy).
// Chấm xanh NHẠT = ngày đang được xem ở view chính (viewedDate), nếu khác hôm nay.

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { addMonths, isSameDay, startOfMonth } from './date-utils';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';

interface DayCell {
  date: Date;
  inCurrentMonth: boolean;
}

@Component({
  selector: 'app-mini-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="select-none">
      <div class="mc-head">
        <span class="mc-title">
          {{ tr.monthLong(displayMonth().getMonth()) }} {{ displayMonth().getFullYear() }}
        </span>
        <div class="flex gap-1">
          <button type="button" (click)="prevMonth()" class="mc-nav" aria-label="Tháng trước">
            <svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="currentColor"><path d="M12.5 15 7 10l5.5-5 1 1-4.5 4 4.5 4z" /></svg>
          </button>
          <button type="button" (click)="nextMonth()" class="mc-nav" aria-label="Tháng sau">
            <svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="currentColor"><path d="M7.5 15 13 10 7.5 5l-1 1 4.5 4-4.5 4z" /></svg>
          </button>
        </div>
      </div>

      <div class="mc-week">
        @for (label of weekdayLabels(); track label) {
          <span>{{ label }}</span>
        }
      </div>

      <div class="mc-grid">
        @for (cell of cells(); track cell.date.getTime()) {
          <button
            type="button"
            (click)="pick(cell.date)"
            class="mc-day"
            [class.is-other]="!cell.inCurrentMonth"
            [class.is-today]="isToday(cell.date)"
            [class.is-viewed]="isViewed(cell.date)"
          >
            {{ cell.date.getDate() }}
          </button>
        }
      </div>
    </div>
  `,
})
export class MiniCalendarComponent {
  /** Ngày đang được xem ở view chính */
  viewedDate = input.required<Date>();
  dateSelected = output<Date>();

  private readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);
  readonly weekdayLabels = computed(() => this.tr.orderedWeekdays(this.settings.weekStartsOn()));
  private readonly today = new Date();

  /** Tháng đang hiển thị trong mini calendar (có thể lệch khỏi viewedDate nếu user tự bấm mũi tên) */
  displayMonth = signal<Date>(startOfMonth(new Date()));

  constructor() {
    effect(() => {
      // Mỗi khi ngày xem chính đổi (vd: bấm "Hôm nay", chuyển tuần...), đồng bộ lại tháng hiển thị
      this.displayMonth.set(startOfMonth(this.viewedDate()));
    });
  }

  cells(): DayCell[] {
    const monthStart = this.displayMonth();
    const firstWeekday = monthStart.getDay(); // 0 = Chủ nhật
    const leading = (firstWeekday - this.settings.weekStartsOn() + 7) % 7;
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const daysInPrevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate();

    const cells: DayCell[] = [];
    for (let i = leading - 1; i >= 0; i--) {
      cells.push({
        date: new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, daysInPrevMonth - i),
        inCurrentMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(monthStart.getFullYear(), monthStart.getMonth(), d), inCurrentMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inCurrentMonth: false });
    }
    return cells;
  }

  isToday(d: Date): boolean {
    return isSameDay(d, this.today);
  }

  isViewed(d: Date): boolean {
    return isSameDay(d, this.viewedDate());
  }

  prevMonth(): void {
    this.displayMonth.update((d) => addMonths(d, -1));
  }

  nextMonth(): void {
    this.displayMonth.update((d) => addMonths(d, 1));
  }

  pick(d: Date): void {
    this.dateSelected.emit(d);
  }
}
