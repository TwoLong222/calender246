// View "Tháng": lưới 6 hàng x 7 cột, mỗi ô ngày hiển thị tối đa vài sự kiện dạng chip.

import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CalendarEvent } from './calendar.types';
import { isSameDay, startOfMonth } from './date-utils';
import { HolidaysService } from './holidays.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { CalendarStateService } from './calendar-state.service';
import { solarToLunar } from '../lunar/lunar.util';
import { eventColorClass, eventColorStyle } from './event-color';

interface MonthCell {
  date: Date;
  inCurrentMonth: boolean;
  /** Nhãn ngày âm: mùng 1 hiện "1/<tháng>", còn lại chỉ số ngày. */
  lunarLabel: string;
  isLunarStart: boolean;
  holiday: string | null;
  holidayPublic: boolean;
}

/** Banner 1 sự kiện nhiều ngày trong 1 hàng tuần — có thể bị cắt ở đầu/cuối hàng nếu sự kiện
 *  còn tiếp tục sang tuần trước/sau (chỉ bo góc ở đúng ngày bắt đầu/kết thúc thật). */
interface WeekBanner {
  key: string;
  event: CalendarEvent;
  row: number;
  colStart: number;
  colEnd: number;
  lane: number;
  roundLeft: boolean;
  roundRight: boolean;
}

const MAX_CHIPS_PER_CELL = 3;
const BANNER_H = 18;
const BANNER_GAP = 2;
/** Khoảng cách từ đỉnh ô tới banner đầu tiên — đủ chỗ cho hàng số ngày phía trên (số ngày
 *  âm lịch + huy hiệu số ngày dương lịch cao 24px + đệm p-1.5 6px) mà không đè lên. */
const BANNER_TOP = 34;
/**
 * Số dải nhiều ngày TỐI ĐA vẽ trong 1 hàng-tuần.
 *
 * Không giới hạn thì một tuần có nhiều sự kiện dài sẽ xếp chồng cao quá chiều cao hàng,
 * TRÀN xuống hàng dưới và ĐÈ MẤT số ngày (mỗi hàng chỉ cao ~1/6 lưới). Phần dư gộp lại
 * thành nhãn "+N nữa" ở cuối chồng.
 */
const MAX_BANNER_LANES = 3;

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

      <div class="relative min-h-0 flex-1">
      <div
        class="grid h-full select-none grid-cols-7 grid-rows-6"
        (pointermove)="onGridPointerMove($event)"
        (pointerup)="onGridPointerUp($event)"
        (pointercancel)="onGridPointerUp($event)"
      >
        @for (cell of cells(); track cell.date.getTime()) {
          <div
            class="group relative flex flex-col border-b border-r border-gray-100 p-1.5 transition-colors hover:bg-gray-50/70"
            [attr.data-cell-date]="cell.date.getTime()"
            [class.bg-gray-50]="!cell.inCurrentMonth"
            [class.ring-2]="dragOverTime() === cell.date.getTime()"
            [class.ring-inset]="dragOverTime() === cell.date.getTime()"
            [class.ring-blue-400]="dragOverTime() === cell.date.getTime()"
            (pointerdown)="onCellPointerDown($event, cell.date)"
            (click)="onCellClick(cell.date)"
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

            <div class="flex flex-1 flex-col gap-1 overflow-hidden" [style.margin-top.px]="bannerReserve(cell.date)">
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
                  [style.background-color]="colorStyle(e.color)"
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

      <!-- Dải sự kiện NHIỀU NGÀY — lưới RIÊNG đè lên trên (cùng số cột/hàng nên khớp ô ngày
           bên dưới), KHÔNG dùng chung lưới với ô ngày: trộn phần tử có vị trí tường minh
           (grid-column trải nhiều cột) với phần tử tự xếp vị trí (ô ngày) trong CÙNG 1 lưới
           khiến trình duyệt ưu tiên chỗ cho banner trước rồi đẩy dạt ô ngày sang chỗ trống
           khác -> lệch/mất số ngày. Tách lưới là cách chuẩn để tránh xung đột đó. -->
      <div class="pointer-events-none absolute inset-0 grid grid-cols-7 grid-rows-6">
        <!-- Xem trước lúc đang kéo — vẽ luôn 1 dải màu (giống banner thật) thay vì chỉ tô nền ô,
             để thấy ngay khoảng ngày sắp tạo, giống hiệu ứng kéo của Google Calendar. -->
        @for (p of dragPreview(); track p.key) {
          <div
            class="popup-in flex items-center truncate px-1.5 text-[11px] font-medium text-white shadow-sm"
            [class.rounded-l]="p.roundLeft"
            [class.rounded-r]="p.roundRight"
            style="background-color:#2563eb;"
            [style.grid-row]="p.row + 1"
            [style.grid-column]="(p.colStart + 1) + ' / ' + (p.colEnd + 2)"
            [style.margin-top.px]="bannerTop"
            [style.height.px]="bannerH"
          >
            <span class="truncate">{{ p.dayCount === 1 ? tr.t('common.untitled') : p.dayCount + ' ' + tr.t('common.days') }}</span>
          </div>
        }
        @for (b of weekBanners(); track b.key) {
          <button
            type="button"
            (click)="onEventClick(b.event, $event)"
            class="pointer-events-auto z-10 flex items-center truncate px-1.5 text-left text-[11px] font-medium text-white shadow-sm transition-transform hover:-translate-y-px hover:shadow"
            [class.rounded-l]="b.roundLeft"
            [class.rounded-r]="b.roundRight"
            [class]="colorClass(b.event.color) + (state.isHighlighted(b.event.id) ? ' ring-2 ring-amber-400 animate-pulse' : '')"
            [style.background-color]="colorStyle(b.event.color)"
            [style.grid-row]="b.row + 1"
            [style.grid-column]="(b.colStart + 1) + ' / ' + (b.colEnd + 2)"
            [style.margin-top.px]="bannerTop + b.lane * bannerStep"
            [style.height.px]="bannerH"
          >
            <span class="truncate">{{ b.event.title || tr.t('common.untitled') }}</span>
          </button>
        }

        <!-- Tuần có nhiều dải hơn số lane cho phép -> gộp phần dư thành 1 nhãn, thay vì để
             chồng dải cao quá hàng rồi tràn xuống đè mất số ngày của hàng dưới. -->
        @for (o of overflowRows(); track o.row) {
          <span
            class="truncate px-1.5 text-[10px] font-medium text-gray-500"
            [style.grid-row]="o.row + 1"
            [style.grid-column]="'1 / 8'"
            [style.margin-top.px]="bannerTop + maxBannerLanes * bannerStep"
            [style.height.px]="bannerH"
          >+{{ o.count }} sự kiện dài nữa</span>
        }
      </div>
      </div>
    </div>
  `,
})
export class MonthViewComponent {
  viewedDate = input.required<Date>();
  events = input.required<CalendarEvent[]>();

  dateClicked = output<Date>();
  eventClicked = output<CalendarEvent>();
  /** Kéo chọn nhiều ô ngày liền nhau -> mở form tạo sự kiện "Cả ngày" trải dài đúng khoảng đã chọn. */
  rangeSelected = output<{ start: Date; end: Date }>();

  private readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);
  protected readonly state = inject(CalendarStateService);
  private readonly holidays = inject(HolidaysService);
  readonly weekdayLabels = computed(() => this.tr.orderedWeekdays(this.settings.weekStartsOn()));
  private readonly today = new Date();
  protected readonly bannerH = BANNER_H;
  protected readonly bannerTop = BANNER_TOP;
  protected readonly bannerStep = BANNER_H + BANNER_GAP;

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

  /** cells() gộp theo từng hàng-tuần (7 ô liên tiếp) — dùng để định vị banner nhiều ngày. */
  private readonly weeks = computed<Date[][]>(() => {
    const flat = this.cells();
    const weeks: Date[][] = [];
    for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7).map((c) => c.date));
    return weeks;
  });

  isToday(d: Date): boolean {
    return isSameDay(d, this.today);
  }

  /** Sự kiện trải nhiều ngày -> hiện bằng banner liền mạch (weekBanners), không lặp lại thành chip trong ô. */
  private isMultiDay(e: CalendarEvent): boolean {
    return !isSameDay(e.start, e.end);
  }

  private eventsOnDate(d: Date): CalendarEvent[] {
    return this.events().filter((e) => isSameDay(e.start, d) && !this.isMultiDay(e));
  }

  eventsFor(d: Date): CalendarEvent[] {
    return this.eventsOnDate(d).slice(0, MAX_CHIPS_PER_CELL);
  }

  overflowCount(d: Date): number {
    return Math.max(0, this.eventsOnDate(d).length - MAX_CHIPS_PER_CELL);
  }

  private atMidnight(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private diffDays(a: Date, b: Date): number {
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
  }

  /**
   * Xếp banner của các sự kiện nhiều ngày theo từng hàng-tuần, mỗi sự kiện chiếm 1 "lane"
   * (hàng dọc) — giữ NGUYÊN lane khi sự kiện tiếp tục sang tuần sau để nhìn liền mạch, chỉ
   * bo góc trái/phải ở đúng ngày bắt đầu/kết thúc thật (còn lại cắt thẳng ở mép hàng-tuần).
   */
  readonly weekBanners = computed<WeekBanner[]>(() => {
    const weeks = this.weeks();
    const multiDay = this.events()
      .filter((e) => this.isMultiDay(e))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const laneOf = new Map<string, number>();
    const result: WeekBanner[] = [];

    for (let w = 0; w < weeks.length; w++) {
      const weekStart = this.atMidnight(weeks[w][0]);
      const weekEnd = this.atMidnight(weeks[w][6]);
      const active = multiDay.filter((e) => this.atMidnight(e.start) <= weekEnd && this.atMidnight(e.end) >= weekStart);

      const occupied = new Set<number>();
      for (const e of active) {
        const l = laneOf.get(e.id);
        if (l !== undefined) occupied.add(l);
      }
      for (const e of active) {
        if (!laneOf.has(e.id)) {
          let lane = 0;
          while (occupied.has(lane)) lane++;
          laneOf.set(e.id, lane);
          occupied.add(lane);
        }
      }

      for (const e of active) {
        const eStart = this.atMidnight(e.start);
        const eEnd = this.atMidnight(e.end);
        const colStart = Math.max(0, this.diffDays(weekStart, eStart));
        const colEnd = Math.min(6, this.diffDays(weekStart, eEnd));
        result.push({
          key: `${e.id}-${w}`,
          event: e,
          row: w,
          colStart,
          colEnd,
          lane: laneOf.get(e.id)!,
          roundLeft: isSameDay(e.start, weeks[w][colStart]),
          roundRight: isSameDay(e.end, weeks[w][colEnd]),
        });
        // Sự kiện đã kết thúc trong tuần này -> giải phóng lane cho tuần sau.
        if (eEnd <= weekEnd) laneOf.delete(e.id);
      }
    }
    // Chỉ giữ các lane nằm trong giới hạn; phần vượt do overflowBanners() lo.
    return result.filter((b) => b.lane < MAX_BANNER_LANES);
  });

  /** Số dải bị ẩn ở mỗi hàng-tuần (chỉ số hàng -> số lượng), để hiện nhãn "+N nữa". */
  readonly bannerOverflow = computed<Record<number, number>>(() => {
    const weeks = this.weeks();
    const multiDay = this.events().filter((e) => this.isMultiDay(e));
    const out: Record<number, number> = {};
    for (let w = 0; w < weeks.length; w++) {
      const weekStart = this.atMidnight(weeks[w][0]);
      const weekEnd = this.atMidnight(weeks[w][6]);
      const active = multiDay.filter(
        (e) => this.atMidnight(e.start) <= weekEnd && this.atMidnight(e.end) >= weekStart,
      );
      if (active.length > MAX_BANNER_LANES) out[w] = active.length - MAX_BANNER_LANES;
    }
    return out;
  });

  /** Các hàng-tuần cần hiện nhãn "+N nữa" (dạng mảng để @for duyệt được). */
  readonly overflowRows = computed<{ row: number; count: number }[]>(() =>
    Object.entries(this.bannerOverflow()).map(([row, count]) => ({ row: +row, count })),
  );

  protected readonly maxBannerLanes = MAX_BANNER_LANES;

  /** Chỗ chừa phía trên trong 1 ô ngày cho các banner nhiều ngày đang phủ qua ngày đó, để chip 1-ngày không bị đè lên. */
  bannerReserve(date: Date): number {
    let maxLane = -1;
    for (const b of this.weekBanners()) {
      const week = this.weeks()[b.row];
      if (!week) continue;
      const from = week[b.colStart].getTime();
      const to = week[b.colEnd].getTime();
      const t = this.atMidnight(date).getTime();
      if (t >= from && t <= to) maxLane = Math.max(maxLane, b.lane);
    }
    // Kẹp theo MAX_BANNER_LANES: weekBanners() đã lọc bỏ lane vượt ngưỡng nên chỗ chừa
    // cũng không được tính theo lane không còn được vẽ.
    const lanes = Math.min(maxLane + 1, MAX_BANNER_LANES);
    return lanes <= 0 ? 0 : this.bannerTop + lanes * this.bannerStep - 4;
  }

  colorClass(color: string): string {
    return eventColorClass(color);
  }

  /** Màu nền cho chip khi người dùng tự chọn mã hex (rỗng nếu dùng màu dựng sẵn). */
  colorStyle(color: string): string {
    return eventColorStyle(color);
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

  // ----- Kéo chọn NHIỀU ô ngày -> tạo nhanh sự kiện "Cả ngày" (giống Google Calendar) -----
  protected readonly dragStart = signal<Date | null>(null);
  protected readonly dragEnd = signal<Date | null>(null);
  private dragCtx: { startDate: Date; startX: number; startY: number; moved: boolean } | null = null;
  /** Vừa kéo-tạo xong -> nuốt click kế tiếp (trình duyệt vẫn tự bắn click sau khi thả chuột
   *  ở ô khác), tránh nó gọi dateClicked đè mất form nhiều ngày vừa mở bằng form 1 ngày. */
  private suppressNextClick = false;

  onCellPointerDown(ev: PointerEvent, date: Date): void {
    if (ev.pointerType === 'touch') return; // điện thoại: giữ cử chỉ cuộn + chạm, dùng click ô ngày như cũ
    if (ev.button !== 0) return; // chỉ chuột trái
    if ((ev.target as HTMLElement).closest('button')) return; // bấm trúng 1 sự kiện -> để nó tự xử lý (mở/kéo dời)
    this.suppressNextClick = false; // bắt đầu tương tác mới -> xóa cờ cũ
    this.dragCtx = { startDate: date, startX: ev.clientX, startY: ev.clientY, moved: false };
  }

  onCellClick(date: Date): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    this.dateClicked.emit(date);
  }

  onGridPointerMove(ev: PointerEvent): void {
    const ctx = this.dragCtx;
    if (!ctx) return;
    // Chưa vượt ngưỡng 5px thì coi là click (không kéo) -> để (click) ô ngày xử lý như cũ.
    if (!ctx.moved) {
      if (Math.hypot(ev.clientX - ctx.startX, ev.clientY - ctx.startY) < 5) return;
      ctx.moved = true;
      this.dragStart.set(ctx.startDate);
      (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    }
    const d = this.dateAtPoint(ev.clientX, ev.clientY);
    if (d) this.dragEnd.set(d);
  }

  onGridPointerUp(ev: PointerEvent): void {
    const ctx = this.dragCtx;
    this.dragCtx = null;
    if (!ctx?.moved) {
      this.dragStart.set(null);
      this.dragEnd.set(null);
      return; // không thật sự kéo -> để (click) ô ngày mở form 1 ngày như cũ
    }
    try { (ev.currentTarget as HTMLElement).releasePointerCapture?.(ev.pointerId); } catch { /* chưa giữ -> bỏ qua */ }
    const a = this.dragStart();
    const b = this.dragEnd() ?? a;
    this.dragStart.set(null);
    this.dragEnd.set(null);
    if (!a || !b) return;
    const start = a.getTime() <= b.getTime() ? a : b;
    const end = a.getTime() <= b.getTime() ? b : a;
    if (isSameDay(start, end)) return; // kéo trong đúng 1 ô = click đơn, đã xử lý bởi (click)
    this.suppressNextClick = true; // đã kéo thật -> nuốt click theo sau (bắn ở ô thả chuột)
    this.rangeSelected.emit({ start, end });
  }

  /** Tìm ô ngày đang nằm dưới con trỏ qua tọa độ màn hình (vì kéo có thể lướt qua nhiều ô). */
  private dateAtPoint(x: number, y: number): Date | null {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-cell-date]') as HTMLElement | null;
    const t = el?.dataset['cellDate'];
    return t ? new Date(Number(t)) : null;
  }

  /**
   * Dải xem trước lúc đang kéo — cắt theo từng hàng-tuần giống hệt cách vẽ banner sự kiện
   * thật (weekBanners), để lúc đang kéo đã thấy ngay hình dạng cuối cùng sẽ ra sao, giống
   * hiệu ứng "vẽ dải sự kiện" của Google Calendar thay vì chỉ tô sáng từng ô rời rạc.
   */
  readonly dragPreview = computed<{ key: string; row: number; colStart: number; colEnd: number; roundLeft: boolean; roundRight: boolean; dayCount: number }[]>(() => {
    const a = this.dragStart();
    const b = this.dragEnd();
    if (!a || !b) return [];
    const start = a.getTime() <= b.getTime() ? a : b;
    const end = a.getTime() <= b.getTime() ? b : a;
    const sMid = this.atMidnight(start);
    const eMid = this.atMidnight(end);
    const dayCount = this.diffDays(sMid, eMid) + 1;
    const weeks = this.weeks();
    const result: { key: string; row: number; colStart: number; colEnd: number; roundLeft: boolean; roundRight: boolean; dayCount: number }[] = [];
    for (let w = 0; w < weeks.length; w++) {
      const weekStart = this.atMidnight(weeks[w][0]);
      const weekEnd = this.atMidnight(weeks[w][6]);
      if (sMid > weekEnd || eMid < weekStart) continue;
      const colStart = Math.max(0, this.diffDays(weekStart, sMid));
      const colEnd = Math.min(6, this.diffDays(weekStart, eMid));
      result.push({
        key: `preview-${w}`,
        row: w,
        colStart,
        colEnd,
        roundLeft: isSameDay(start, weeks[w][colStart]),
        roundRight: isSameDay(end, weeks[w][colEnd]),
        dayCount,
      });
    }
    return result;
  });
}
