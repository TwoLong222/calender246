// Lưới thời gian (time grid) dùng chung cho cả view "Ngày" (1 cột) và "Tuần" (7 cột).
// Gồm: header ngày, các dòng giờ 0h-23h, vạch đỏ biểu thị giờ hiện tại, và các block sự kiện.
//
// CẬP NHẬT: khi 2+ sự kiện trùng giờ nhau, thay vì đè hoàn toàn lên nhau, chúng được xếp
// SONG SONG cạnh nhau (giống Google Calendar thật) — xem hàm layoutEventsForDay().

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  OnDestroy,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CalendarEvent } from './calendar.types';
import { formatHourLabel, isSameDay, minutesSinceMidnight } from './date-utils';

/** Chiều cao (px) tương ứng với 1 giờ trong lưới — dùng để tính vị trí sự kiện & vạch đỏ */
const HOUR_HEIGHT = 56;

interface LayoutedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  /** % tính từ trái cột ngày */
  left: number;
  /** % chiều rộng, dùng chung với left để chia đều không gian cho các sự kiện trùng giờ */
  width: number;
}

/**
 * Xếp layout cho các sự kiện trong 1 ngày: nhóm các sự kiện trùng giờ (transitively overlapping)
 * thành từng "cụm", trong mỗi cụm dùng thuật toán greedy interval scheduling để xếp vào các cột
 * sao cho không có 2 sự kiện nào cùng cột bị chồng giờ — mỗi cụm chia đều chiều rộng theo số cột.
 */
function layoutEventsForDay(events: CalendarEvent[]): LayoutedEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
  );

  // Bước 1: gom thành các cụm sự kiện trùng giờ liên tiếp nhau
  const clusters: CalendarEvent[][] = [];
  let current: CalendarEvent[] = [];
  let clusterEnd = -Infinity;

  for (const e of sorted) {
    if (current.length === 0 || e.start.getTime() < clusterEnd) {
      current.push(e);
      clusterEnd = Math.max(clusterEnd, e.end.getTime());
    } else {
      clusters.push(current);
      current = [e];
      clusterEnd = e.end.getTime();
    }
  }
  if (current.length) clusters.push(current);

  const result: LayoutedEvent[] = [];

  for (const cluster of clusters) {
    // Bước 2: trong mỗi cụm, xếp từng sự kiện vào cột đầu tiên còn trống (không bị chồng)
    const columns: CalendarEvent[][] = [];
    const columnOf = new Map<string, number>();

    for (const e of cluster) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const lastInColumn = columns[c][columns[c].length - 1];
        if (lastInColumn.end.getTime() <= e.start.getTime()) {
          columns[c].push(e);
          columnOf.set(e.id, c);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([e]);
        columnOf.set(e.id, columns.length - 1);
      }
    }

    const totalColumns = columns.length;
    for (const e of cluster) {
      const colIndex = columnOf.get(e.id)!;
      const top = (minutesSinceMidnight(e.start) / 60) * HOUR_HEIGHT;
      const durationMin = Math.max(20, (e.end.getTime() - e.start.getTime()) / 60000);
      const height = (durationMin / 60) * HOUR_HEIGHT;
      const width = 100 / totalColumns;
      const left = colIndex * width;
      result.push({ event: e, top, height, left, width });
    }
  }

  return result;
}

@Component({
  selector: 'app-time-grid-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full flex-col overflow-hidden">
      <!-- Header: tên ngày + số ngày, hôm nay có vòng tròn xanh -->
      <div class="flex border-b border-gray-200 pl-14">
        @for (date of dates(); track date.getTime()) {
          <div class="flex flex-1 flex-col items-center py-2">
            <span class="text-xs font-medium uppercase text-gray-500">{{ weekdayLabel(date) }}</span>
            <span
              class="mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg"
              [class.bg-blue-700]="isToday(date)"
              [class.text-white]="isToday(date)"
              [class.text-gray-800]="!isToday(date)"
            >
              {{ date.getDate() }}
            </span>
          </div>
        }
      </div>

      <!-- Lưới thời gian, cuộn được -->
      <div #scrollArea class="relative flex-1 overflow-y-auto">
        <div class="flex" [style.height.px]="HOUR_HEIGHT * 24">
          <!-- Cột nhãn giờ -->
          <div class="w-14 shrink-0">
            @for (hour of hours; track hour) {
              <div class="relative" [style.height.px]="HOUR_HEIGHT">
                <span class="absolute -top-2 right-2 text-[11px] text-gray-400">{{ formatHourLabel(hour) }}</span>
              </div>
            }
          </div>

          <!-- Các cột ngày -->
          @for (date of dates(); track date.getTime()) {
            <div class="relative flex-1 border-l border-gray-100">
              @for (hour of hours; track hour) {
                <div
                  class="cursor-pointer border-b border-gray-100 hover:bg-blue-50/40"
                  [style.height.px]="HOUR_HEIGHT"
                  (click)="onSlotClick(date, hour)"
                ></div>
              }

              <!-- Vạch đỏ: giờ hiện tại -->
              @if (isToday(date)) {
                <div
                  class="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                  [style.top.px]="nowOffset()"
                >
                  <span class="-ml-1 h-2.5 w-2.5 rounded-full bg-red-500"></span>
                  <span class="h-px flex-1 bg-red-500"></span>
                </div>
              }

              <!-- Các sự kiện trong ngày này — sự kiện trùng giờ được xếp song song cạnh nhau -->
              @for (item of positionedEvents(date); track item.event.id) {
                <button
                  type="button"
                  (click)="onEventClick(item.event, $event)"
                  class="absolute z-10 overflow-hidden rounded-md border border-white px-2 py-1 text-left text-xs text-white shadow-sm"
                  [style.top.px]="item.top"
                  [style.height.px]="item.height"
                  [style.left.%]="item.left"
                  [style.width.%]="item.width"
                  [class]="colorClass(item.event.color)"
                >
                  <span class="block truncate font-medium">{{ item.event.title || '(Không có tiêu đề)' }}</span>
                  <span class="block truncate opacity-90">{{ formatRange(item.event) }}</span>
                </button>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class TimeGridViewComponent implements AfterViewInit, OnDestroy {
  /** Danh sách ngày cần render — 1 phần tử = view Ngày, 7 phần tử = view Tuần */
  dates = input.required<Date[]>();
  events = input.required<CalendarEvent[]>();

  slotClicked = output<Date>();
  eventClicked = output<CalendarEvent>();

  readonly HOUR_HEIGHT = HOUR_HEIGHT;
  readonly hours = Array.from({ length: 24 }, (_, i) => i);
  readonly formatHourLabel = formatHourLabel;

  private readonly today = new Date();
  private readonly scrollAreaRef = viewChild<ElementRef<HTMLDivElement>>('scrollArea');
  private tickTimer?: ReturnType<typeof setInterval>;
  private readonly nowSignal = signal(new Date());

  nowOffset = computed(() => (minutesSinceMidnight(this.nowSignal()) / 60) * HOUR_HEIGHT);

  ngAfterViewInit(): void {
    const el = this.scrollAreaRef()?.nativeElement;
    if (el) el.scrollTop = 7 * HOUR_HEIGHT;

    this.tickTimer = setInterval(() => this.nowSignal.set(new Date()), 60_000);
  }

  ngOnDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  isToday(d: Date): boolean {
    return isSameDay(d, this.today);
  }

  weekdayLabel(d: Date): string {
    return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
  }

  positionedEvents(date: Date): LayoutedEvent[] {
    const eventsOnDate = this.events().filter((e) => !e.isAllDay && isSameDay(e.start, date));
    return layoutEventsForDay(eventsOnDate);
  }

  formatRange(e: CalendarEvent): string {
    const fmt = (d: Date) => {
      let h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}${m ? ':' + m.toString().padStart(2, '0') : ''}${ampm}`;
    };
    return `${fmt(e.start)} – ${fmt(e.end)}`;
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

  onSlotClick(date: Date, hour: number): void {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    this.slotClicked.emit(start);
  }

  onEventClick(event: CalendarEvent, domEvent: Event): void {
    domEvent.stopPropagation();
    this.eventClicked.emit(event);
  }
}
