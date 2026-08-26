// View "Tháng": lưới 6 hàng x 7 cột, mỗi ô ngày hiển thị tối đa vài sự kiện dạng chip.

import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CalendarEvent } from './calendar.types';
import { isSameDay, startOfMonth } from './date-utils';
import { HolidaysService } from './holidays.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { CalendarStateService } from './calendar-state.service';
import { solarToLunar } from '../lunar/lunar.util';

interface MonthCell {
  date: Date;
  inCurrentMonth: boolean;
  /** Nhãn ngày âm: mùng 1 hiện "1/<tháng>", còn lại chỉ số ngày. */
  lunarLabel: string;
  isLunarStart: boolean;
  holiday: string | null;
  holidayPublic: boolean;
}

const MAX_CHIPS_PER_CELL = 3;

@Component({
  selector: 'app-month-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full flex-col">
      <div class="grid grid-cols-7 border-b border-gray-200 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        @for (label of weekdayLabels(); track label) {
          <div class="py-2.5">{{ label }}</div>
        }
      </div>

      <div class="grid flex-1 grid-cols-7 grid-rows-6">
        @for (cell of cells(); track cell.date.getTime()) {
          <div
            class="group flex flex-col border-b border-r border-gray-100 p-1.5 transition-colors hover:bg-gray-50/70"
            [class.bg-gray-50]="!cell.inCurrentMonth"
            [class.ring-2]="dragOverTime() === cell.date.getTime()"
            [class.ring-inset]="dragOverTime() === cell.date.getTime()"
            [class.ring-blue-400]="dragOverTime() === cell.date.getTime()"
            (click)="dateClicked.emit(cell.date)"
            (dragover)="onDragOver(cell.date, $event)"
            (dragleave)="onDragLeave(cell.date)"
            (drop)="onDrop(cell.date, $event)"
          >
            <div class="mb-1 flex items-start justify-between">
              <span
                class="pt-0.5 text-[10px] leading-5"
                [class.text-gray-300]="!cell.inCurrentMonth"
                [class.font-semibold]="cell.isLunarStart"
                [class.text-amber-600]="cell.inCurrentMonth && cell.isLunarStart"
                [class.text-gray-400]="cell.inCurrentMonth && !cell.isLunarStart"
              >{{ cell.lunarLabel }}</span>
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-medium"
                [class.text-gray-300]="!cell.inCurrentMonth"
                [class.text-red-600]="cell.inCurrentMonth && cell.holidayPublic && !isToday(cell.date)"
                [class.text-gray-700]="cell.inCurrentMonth && !cell.holidayPublic && !isToday(cell.date)"
                [class.bg-blue-700]="isToday(cell.date)"
                [class.text-white]="isToday(cell.date)"
              >
                {{ cell.date.getDate() }}
              </span>
            </div>

            @if (cell.holiday) {
              <p
                class="mb-1 truncate text-[10px] leading-tight"
                [class.text-red-600]="cell.holidayPublic"
                [class.text-gray-500]="!cell.holidayPublic"
                [class.opacity-50]="!cell.inCurrentMonth"
                [title]="cell.holiday"
              >{{ cell.holiday }}</p>
            }

            <div class="flex flex-1 flex-col gap-1 overflow-hidden">
              @for (e of eventsFor(cell.date); track e.id) {
                <button
                  type="button"
                  [draggable]="state.canEditEvent(e)"
                  (dragstart)="onDragStart(e, $event)"
                  (dragend)="onDragEnd()"
                  (click)="onEventClick(e, $event)"
                  class="flex items-center gap-1 truncate rounded px-1.5 py-[3px] text-left text-[11px] font-medium text-white shadow-sm transition-transform hover:-translate-y-px hover:shadow"
                  [class.cursor-move]="state.canEditEvent(e)"
                  [class]="colorClass(e.color) + (state.isHighlighted(e.id) ? ' ring-2 ring-amber-400 animate-pulse' : '')"
                >
                  @if (state.isSharedEvent(e)) { <span title="Lịch được chia sẻ">👥</span> }
                  @if (!e.isAllDay) { <span class="mono shrink-0 opacity-80">{{ eventTime(e) }}</span> }
                  <span class="truncate">{{ e.title || tr.t('common.untitled') }}</span>
                </button>
              }
              @if (overflowCount(cell.date) > 0) {
                <span class="px-1.5 text-[11px] font-medium text-gray-400 group-hover:text-gray-500">+{{ overflowCount(cell.date) }} nữa</span>
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
  protected readonly tr = inject(TranslateService);
  protected readonly state = inject(CalendarStateService);
  private readonly holidays = inject(HolidaysService);
  readonly weekdayLabels = computed(() => this.tr.orderedWeekdays(this.settings.weekStartsOn()));
  private readonly today = new Date();

  /** Dựng 1 ô lịch kèm sẵn ngày âm + ngày lễ (tính động cho mọi năm). */
  private makeCell(date: Date, inCurrentMonth: boolean): MonthCell {
    const lunar = solarToLunar(date.getDate(), date.getMonth() + 1, date.getFullYear());
    const holiday = this.holidays.get(date);
    return {
      date,
      inCurrentMonth,
      lunarLabel: lunar.day === 1 ? `${lunar.day}/${lunar.month}` : `${lunar.day}`,
      isLunarStart: lunar.day === 1,
      holiday: holiday?.name ?? null,
      holidayPublic: holiday?.isPublic ?? false,
    };
  }

  cells = computed<MonthCell[]>(() => {
    const monthStart = startOfMonth(this.viewedDate());
    const firstWeekday = monthStart.getDay();
    // Số ô "tràn" của tháng trước, tính theo ngày bắt đầu tuần (0=CN, 1=T2).
    const leading = (firstWeekday - this.settings.weekStartsOn() + 7) % 7;
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const daysInPrevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate();

    const cells: MonthCell[] = [];
    for (let i = leading - 1; i >= 0; i--) {
      cells.push(this.makeCell(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, daysInPrevMonth - i), false));
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(this.makeCell(new Date(monthStart.getFullYear(), monthStart.getMonth(), d), true));
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      cells.push(this.makeCell(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), false));
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

  /** Giờ bắt đầu ngắn gọn cho chip sự kiện trong ô ngày (chỉ sự kiện không phải cả ngày). */
  eventTime(e: CalendarEvent): string {
    return e.start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  onEventClick(e: CalendarEvent, domEvent: Event): void {
    domEvent.stopPropagation();
    this.eventClicked.emit(e);
  }

  // ----- Kéo-thả sự kiện sang ngày khác (chỉ trong lịch tháng) -----
  /** Sự kiện đang được kéo. */
  private draggedEvent: CalendarEvent | null = null;
  /** getTime() của ô ngày đang rê chuột lên -> tô viền xanh gợi ý nơi thả. */
  protected readonly dragOverTime = signal<number | null>(null);

  onDragStart(e: CalendarEvent, ev: DragEvent): void {
    // Không có quyền sửa -> chặn kéo (draggable đã false nhưng chặn thêm cho chắc).
    if (!this.state.canEditEvent(e)) {
      ev.preventDefault();
      return;
    }
    this.draggedEvent = e;
    ev.dataTransfer?.setData('text/plain', e.id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }

  onDragEnd(): void {
    this.draggedEvent = null;
    this.dragOverTime.set(null);
  }

  onDragOver(date: Date, ev: DragEvent): void {
    if (!this.draggedEvent) return; // chỉ nhận thả khi đang kéo sự kiện
    ev.preventDefault(); // bắt buộc để cho phép 'drop'
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    this.dragOverTime.set(date.getTime());
  }

  onDragLeave(date: Date): void {
    if (this.dragOverTime() === date.getTime()) this.dragOverTime.set(null);
  }

  onDrop(date: Date, ev: DragEvent): void {
    ev.preventDefault();
    const e = this.draggedEvent;
    this.draggedEvent = null;
    this.dragOverTime.set(null);
    if (!e) return;
    if (isSameDay(e.start, date)) return; // thả lại đúng ngày cũ -> không đổi
    if (!this.state.canEditEvent(e)) return;
    // Giữ nguyên GIỜ và thời lượng, chỉ dời sang NGÀY mới.
    const newStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), e.start.getHours(), e.start.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + (e.end.getTime() - e.start.getTime()));
    this.state.updateEventTimes({ ...e, start: newStart, end: newEnd });
  }
}
