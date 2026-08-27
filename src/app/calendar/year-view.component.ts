// View "Năm": lưới 12 mini-calendar (mỗi tháng 1 ô), giống Google Calendar year view.
// Có chấm nhỏ dưới các ngày CÓ SỰ KIỆN để nhìn nhanh cả năm bận rộn thế nào.

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CalendarEvent } from './calendar.types';
import { isSameDay } from './date-utils';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';

interface MiniMonthCell {
  date: Date;
  inCurrentMonth: boolean;
}

@Component({
  selector: 'app-year-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Trên màn hình rộng (lg): khoá đúng 3 HÀNG tháng và cho lưới cao bằng khung chứa, để
         12 tháng vừa 1 màn hình không phải cuộn. Ô ngày KHÔNG còn cao cố định mà co theo chỗ
         trống (h-full max-h-7 aspect-square) — tính bằng pixel cứng không đáng tin vì còn phụ
         thuộc mức zoom và line-height thừa kế. Màn hình nhỏ vẫn cuộn như cũ (2 cột = 6 hàng).
         scroll-smooth: nếu vẫn còn dư chút thì cuộn cũng mượt chứ không giật. -->
    <div class="grid h-full grid-cols-2 gap-4 overflow-y-auto scroll-smooth p-4 sm:grid-cols-3 lg:grid-cols-4 lg:grid-rows-3 lg:gap-3 lg:overflow-hidden lg:p-3">
      @for (month of months(); track month.getTime()) {
        <div class="flex min-h-0 flex-col rounded-lg p-2 transition-colors hover:bg-gray-50 lg:p-1.5">
          <div class="mb-2 shrink-0 text-center text-sm font-semibold leading-5 text-gray-700 lg:mb-1">{{ tr.monthLong(month.getMonth()) }}</div>
          <div class="grid shrink-0 grid-cols-7 gap-y-1 text-center text-[10px] font-medium leading-4 text-gray-400 lg:gap-y-0.5">
            @for (label of weekdayLabels(); track label) {
              <span>{{ label }}</span>
            }
          </div>
          <div class="grid grid-cols-7 gap-y-1 text-center lg:min-h-0 lg:flex-1 lg:grid-rows-6 lg:gap-y-0.5">
            @for (cell of cellsFor(month); track cell.date.getTime()) {
              <!-- Màn nhỏ: ô cố định 28px cho dễ chạm. Từ lg: ô co giãn theo chiều cao còn lại
                   (tối thiểu 20px, tối đa 28px) để 12 tháng luôn vừa 1 màn hình. -->
              <button
                type="button"
                (click)="dateClicked.emit(cell.date)"
                class="relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] leading-none transition-colors hover:bg-blue-100 lg:aspect-square lg:h-full lg:max-h-7 lg:min-h-5 lg:w-auto"
                [class.text-gray-300]="!cell.inCurrentMonth"
                [class.text-gray-700]="cell.inCurrentMonth && !isToday(cell.date)"
                [class.bg-blue-700]="isToday(cell.date)"
                [class.text-white]="isToday(cell.date)"
                [class.font-semibold]="cell.inCurrentMonth && hasEvent(cell.date)"
              >
                {{ cell.date.getDate() }}
                <!-- Chấm nhỏ dưới ngày có sự kiện; hôm nay thì đổi thành trắng cho nổi trên nền xanh -->
                @if (cell.inCurrentMonth && hasEvent(cell.date)) {
                  <span
                    class="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                    [class.bg-blue-500]="!isToday(cell.date)"
                    [class.bg-white]="isToday(cell.date)"
                  ></span>
                }
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
  events = input<CalendarEvent[]>([]);
  dateClicked = output<Date>();

  protected readonly tr = inject(TranslateService);
  private readonly settings = inject(SettingsService);
  readonly weekdayLabels = computed(() => this.tr.orderedWeekdays(this.settings.weekStartsOn()));
  private readonly today = new Date();

  months = computed(() => {
    const year = this.viewedDate().getFullYear();
    return Array.from({ length: 12 }, (_, m) => new Date(year, m, 1));
  });

  /** Set các ngày (yyyy-mm-dd) có ít nhất 1 sự kiện — tính 1 lần khi events đổi */
  private readonly eventDays = computed(() => {
    const set = new Set<string>();
    for (const e of this.events()) {
      const d = e.start;
      // Với sự kiện kéo dài nhiều ngày, đánh dấu mọi ngày từ start -> end
      const end = e.end;
      const cur = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cur <= last) {
        set.add(this.dayKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return set;
  });

  hasEvent(d: Date): boolean {
    return this.eventDays().has(this.dayKey(d));
  }

  private dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  cellsFor(monthStart: Date): MiniMonthCell[] {
    const firstWeekday = monthStart.getDay();
    const leading = (firstWeekday - this.settings.weekStartsOn() + 7) % 7;
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const daysInPrevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate();

    const cells: MiniMonthCell[] = [];
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
  }

  isToday(d: Date): boolean {
    return isSameDay(d, this.today);
  }
}
