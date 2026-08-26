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
  effect,
  ElementRef,
  inject,
  OnDestroy,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CalendarEvent } from './calendar.types';
import { formatHourLabel, isSameDay, minutesSinceMidnight } from './date-utils';
import { SupabaseService } from '../auth/supabase.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { CalendarStateService } from './calendar-state.service';
import { IconComponent } from '../shared/icon.component';

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
      // Không cho block cao quá đáy cột ngày: sự kiện kéo dài qua ngày hôm sau sẽ hiển thị
      // tới đáy cột (báo hiệu "còn tiếp"), giờ kết thúc thật vẫn đúng ở popover/tháng.
      const height = Math.min((durationMin / 60) * HOUR_HEIGHT, HOUR_HEIGHT * 24 - top);
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
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full flex-col overflow-hidden">
      <!-- Header: tên ngày + số ngày, hôm nay có vòng tròn xanh. Bấm vào ngày -> xem view Ngày.
           gutter-pr: chừa đúng bề rộng thanh cuộn của lưới bên dưới -> các cột thẳng hàng. -->
      <div class="gutter-pr flex border-b border-gray-200 pl-14">
        @for (date of dates(); track date.getTime()) {
          <button
            type="button"
            (click)="dateSelected.emit(date)"
            class="flex flex-1 flex-col items-center gap-1 py-2.5 hover:bg-gray-50"
            title="Xem ngày này"
          >
            <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{{ weekdayLabel(date) }}</span>
            <span
              class="flex h-9 w-9 items-center justify-center rounded-full text-lg font-medium transition-colors hover:bg-blue-100"
              [class.bg-blue-700]="isToday(date)"
              [class.text-white]="isToday(date)"
              [class.text-gray-800]="!isToday(date)"
            >
              {{ date.getDate() }}
            </span>
          </button>
        }
      </div>

      <!-- HÀNG "CẢ NGÀY": sự kiện cả ngày không có giờ nên không đặt được trên lưới giờ
           -> cho riêng một dải ngay dưới header (giống Google Calendar). Trước đây chúng
           bị lọc bỏ hoàn toàn nên tick "Cả ngày" xong là sự kiện biến mất. -->
      @if (hasAllDay()) {
        <div class="gutter-pr flex border-b border-gray-200 bg-gray-50/60">
          <!-- Cột nhãn: chữ "Cả ngày" + nút thu gọn/mở rộng khi có nhiều sự kiện -->
          <div class="flex w-14 shrink-0 flex-col items-end justify-start gap-0.5 py-1 pr-2">
            <span class="text-[11px] font-medium leading-tight text-gray-500">{{ tr.t('common.allDay') }}</span>
            @if (allDayOverflow()) {
              <button
                type="button"
                (click)="allDayExpanded.set(!allDayExpanded())"
                class="rounded p-0.5 text-gray-500 hover:bg-gray-200"
                [title]="allDayExpanded() ? tr.t('allday.collapse') : tr.t('allday.expand')"
                [attr.aria-label]="allDayExpanded() ? tr.t('allday.collapse') : tr.t('allday.expand')"
              >
                <app-icon [name]="allDayExpanded() ? 'chevron-up' : 'chevron-down'" class="h-3.5 w-3.5" />
              </button>
            }
          </div>
          @for (date of dates(); track date.getTime()) {
            <div class="min-h-[2rem] min-w-0 flex-1 space-y-1 border-l border-gray-100 p-1">
              @for (e of visibleAllDay(date); track e.id) {
                <button
                  type="button"
                  (click)="onEventClick(e, $event)"
                  class="block w-full truncate rounded px-2 py-0.5 text-left text-xs font-medium text-white shadow-sm"
                  [class]="colorClass(e.color)"
                >
                  @if (state.isSharedEvent(e)) { <span title="Lịch được chia sẻ">👥 </span> }{{ e.title || tr.t('common.untitled') }}
                </button>
              }
              <!-- Còn dư -> "N mục khác" (bấm để mở rộng), giống Google Calendar -->
              @if (hiddenAllDayCount(date) > 0) {
                <button
                  type="button"
                  (click)="allDayExpanded.set(true)"
                  class="block w-full truncate px-2 text-left text-xs text-gray-600 hover:underline"
                >{{ hiddenAllDayCount(date) }} {{ tr.t('allday.more') }}</button>
              }
            </div>
          }
        </div>
      }

      <!-- Lưới thời gian, cuộn được -->
      <div #scrollArea class="relative flex-1 overflow-y-auto">
        <div #gridRow class="flex" [style.height.px]="HOUR_HEIGHT * 24">
          <!-- Cột nhãn giờ -->
          <div class="w-14 shrink-0">
            @for (hour of hours; track hour) {
              <div class="relative" [style.height.px]="HOUR_HEIGHT">
                <!-- Nhãn giờ nhô lên -8px để canh đúng vạch kẻ. Riêng giờ ĐẦU TIÊN (0h) thì
                     không nhô, nếu không nó tràn lên trên và bị dải "Cả ngày" che mất
                     (đúng lỗi "giờ 0h bị cắt/chồng chữ" đã gặp). -->
                <span
                  class="mono absolute right-2 text-[11px] font-medium text-gray-500"
                  [class.-top-2]="hour > 0"
                  [class.top-0]="hour === 0"
                >{{ formatHourLabel(hour, settings.is24h()) }}</span>
              </div>
            }
          </div>

          <!-- Các cột ngày -->
          @for (date of dates(); track date.getTime()) {
            <div class="relative flex-1 border-l border-gray-100">
              @for (hour of hours; track hour) {
                <div
                  class="cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50/40"
                  [style.height.px]="HOUR_HEIGHT"
                  (click)="onSlotClick(date, hour)"
                ></div>
              }

              <!-- Vạch đỏ: giờ hiện tại (có thể tắt trong Cài đặt) -->
              @if (isToday(date) && settings.settings().show_current_time) {
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
                  (pointerdown)="startMove($event, item.event)"
                  (pointermove)="onMove($event)"
                  (pointerup)="endMove($event)"
                  (pointercancel)="endMove($event)"
                  class="group absolute z-10 cursor-grab touch-none overflow-hidden rounded px-2 py-1 text-left text-xs text-white shadow-sm ring-1 ring-white/70 transition-shadow hover:shadow-md active:cursor-grabbing"
                  [style.top.px]="item.top"
                  [style.height.px]="item.height"
                  [style.left.%]="item.left"
                  [style.width.%]="item.width"
                  [class]="colorClass(item.event.color) + (state.isHighlighted(item.event.id) ? ' ring-2 ring-amber-400 animate-pulse' : '')"
                >
                  <!-- Tay cầm kéo mép TRÊN: đổi giờ bắt đầu -->
                  <div
                    class="absolute inset-x-0 top-0 z-20 flex h-2.5 items-start justify-center cursor-ns-resize opacity-0 group-hover:opacity-100"
                    title="Kéo để đổi giờ bắt đầu"
                    (pointerdown)="startResize($event, item.event, 'top')"
                    (pointermove)="onResizeMove($event)"
                    (pointerup)="endResize($event)"
                    (pointercancel)="endResize($event)"
                    (click)="$event.stopPropagation()"
                  >
                    <span class="mt-0.5 block h-0.5 w-6 rounded-full bg-white/80"></span>
                  </div>

                  @if (item.height < 40) {
                    <!-- Block quá ngắn: gộp giờ bắt đầu + tiêu đề trên 1 dòng để vẫn thấy được giờ -->
                    <span class="block truncate font-medium">
                      @if (state.isSharedEvent(item.event)) { <span title="Lịch được chia sẻ">👥 </span> }<span class="mono">{{ formatStart(item.event) }}</span> {{ item.event.title || tr.t('common.untitled') }}
                    </span>
                  } @else {
                    <span class="block truncate font-semibold">@if (state.isSharedEvent(item.event)) { <span title="Lịch được chia sẻ">👥 </span> }{{ item.event.title || tr.t('common.untitled') }}</span>
                    <span class="mono block truncate text-[11px] opacity-90">{{ formatRange(item.event) }}</span>
                  }

                  <!-- Tay cầm kéo mép DƯỚI: đổi giờ kết thúc (thời lượng) -->
                  <div
                    class="absolute inset-x-0 bottom-0 z-20 flex h-2.5 items-end justify-center cursor-ns-resize opacity-0 group-hover:opacity-100"
                    title="Kéo để đổi thời lượng"
                    (pointerdown)="startResize($event, item.event, 'bottom')"
                    (pointermove)="onResizeMove($event)"
                    (pointerup)="endResize($event)"
                    (pointercancel)="endResize($event)"
                    (click)="$event.stopPropagation()"
                  >
                    <span class="mb-0.5 block h-0.5 w-6 rounded-full bg-white/80"></span>
                  </div>
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
  /** Bấm vào 1 ngày ở header -> xem view Ngày của ngày đó */
  dateSelected = output<Date>();
  /** Phát ra khi người dùng kéo co giãn 1 sự kiện xong -> trang cha lưu lại qua API */
  eventTimesChanged = output<CalendarEvent>();

  readonly HOUR_HEIGHT = HOUR_HEIGHT;
  readonly hours = Array.from({ length: 24 }, (_, i) => i);
  readonly formatHourLabel = formatHourLabel;

  private readonly supabase = inject(SupabaseService);
  protected readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);
  private readonly today = new Date();
  private clearPreviewTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Sau khi thả kéo: GIỮ preview (vị trí mới) cho tới khi events() thật đã cập nhật đúng
    // vị trí đó rồi mới bỏ preview -> không có khoảnh khắc nào hiện lại chỗ cũ (kể cả kéo nhanh).
    effect(() => {
      const p = this.resizePreview();
      if (!p) return;
      const e = this.events().find((x) => x.id === p.id);
      if (e && e.start.getTime() === p.start.getTime() && e.end.getTime() === p.end.getTime()) {
        queueMicrotask(() => this.resizePreview.set(null));
      }
    });
  }

  /** Chỉ CHỦ event mới được kéo/co giãn (khách được mời không sửa được — RLS chặn) */
  protected readonly state = inject(CalendarStateService);
  canEdit(e: CalendarEvent): boolean {
    // Chủ event, hoặc editor của lịch được chia sẻ.
    return this.state.canEditEvent(e);
  }
  private readonly scrollAreaRef = viewChild<ElementRef<HTMLDivElement>>('scrollArea');
  private readonly gridRowRef = viewChild<ElementRef<HTMLDivElement>>('gridRow');
  private tickTimer?: ReturnType<typeof setInterval>;
  private readonly nowSignal = signal(new Date());

  /** Bối cảnh khi kéo DỜI cả block (giữ nguyên thời lượng, đổi giờ bắt đầu + có thể đổi ngày) */
  private moveCtx: {
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
    origStart: Date;
    origEnd: Date;
    durationMs: number;
    event: CalendarEvent;
  } | null = null;
  /** Cờ chặn: vừa kéo xong thì bỏ qua click kế tiếp để không mở popup chi tiết */
  private justDragged = false;

  /** Giờ tạm (preview) đang hiển thị trong lúc kéo co giãn — null nghĩa là không kéo */
  private readonly resizePreview = signal<{ id: string; start: Date; end: Date } | null>(null);
  /** Bối cảnh kéo hiện tại (không phải signal vì không cần render trực tiếp) */
  private resizeCtx: {
    id: string;
    edge: 'top' | 'bottom';
    startY: number;
    origStart: Date;
    origEnd: Date;
    event: CalendarEvent;
  } | null = null;

  nowOffset = computed(() => (minutesSinceMidnight(this.nowSignal()) / 60) * HOUR_HEIGHT);

  ngAfterViewInit(): void {
    const el = this.scrollAreaRef()?.nativeElement;
    if (el) el.scrollTop = 7 * HOUR_HEIGHT;

    this.tickTimer = setInterval(() => this.nowSignal.set(new Date()), 60_000);
  }

  ngOnDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    clearTimeout(this.clearPreviewTimer);
  }

  isToday(d: Date): boolean {
    return isSameDay(d, this.today);
  }

  weekdayLabel(d: Date): string {
    return this.tr.t('wd.' + d.getDay());
  }

  /** Sự kiện CẢ NGÀY của 1 ngày — hiện ở dải riêng phía trên lưới giờ. */
  allDayEvents(date: Date): CalendarEvent[] {
    return this.events().filter((e) => e.isAllDay && this.coversDay(e, date));
  }
  /** Có sự kiện cả ngày nào trong các ngày đang xem không (để ẩn dải khi không có). */
  hasAllDay(): boolean {
    return this.dates().some((d) => this.allDayEvents(d).length > 0);
  }

  /** Số sự kiện cả ngày hiện tối đa khi CHƯA mở rộng (giống Google Calendar). */
  private readonly ALL_DAY_COLLAPSED = 2;
  /** Người dùng đã bấm mở rộng dải "Cả ngày" hay chưa. */
  readonly allDayExpanded = signal(false);
  /** Có ngày nào nhiều sự kiện hơn mức hiện được không -> mới hiện nút thu gọn/mở rộng. */
  allDayOverflow(): boolean {
    return this.dates().some((d) => this.allDayEvents(d).length > this.ALL_DAY_COLLAPSED);
  }
  /** Danh sách sự kiện cả ngày ĐANG hiện của 1 ngày (cắt bớt khi đang thu gọn). */
  visibleAllDay(date: Date): CalendarEvent[] {
    const list = this.allDayEvents(date);
    if (this.allDayExpanded() || !this.allDayOverflow()) return list;
    return list.slice(0, this.ALL_DAY_COLLAPSED);
  }
  /** Số sự kiện bị giấu của 1 ngày -> hiện "N mục khác". */
  hiddenAllDayCount(date: Date): number {
    return this.allDayEvents(date).length - this.visibleAllDay(date).length;
  }
  /** Sự kiện cả ngày có thể kéo dài nhiều ngày -> hiện ở MỌI ngày nó phủ qua. */
  private coversDay(e: CalendarEvent, date: Date): boolean {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);
    return e.start <= dayEnd && e.end >= dayStart;
  }

  positionedEvents(date: Date): LayoutedEvent[] {
    const preview = this.resizePreview();
    const eventsOnDate = this.events()
      .filter((e) => !e.isAllDay)
      // Thay giờ thật bằng giờ preview trong lúc kéo (co giãn HOẶC dời) để block cập nhật tức thời...
      .map((e) => (preview && preview.id === e.id ? { ...e, start: preview.start, end: preview.end } : e))
      // ...rồi MỚI lọc theo ngày, nhờ vậy khi kéo sang cột ngày khác thì event tự chuyển cột theo con trỏ
      .filter((e) => isSameDay(e.start, date));
    return layoutEventsForDay(eventsOnDate);
  }

  /** Xác định cột NGÀY nào đang nằm dưới con trỏ (cho kéo dời qua ngày khác ở view Tuần) */
  private dayFromClientX(clientX: number): Date {
    const dates = this.dates();
    const el = this.gridRowRef()?.nativeElement;
    if (!el) return dates[0];
    const rect = el.getBoundingClientRect();
    const LABEL_WIDTH = 56; // bề rộng cột nhãn giờ bên trái (class w-14)
    const colWidth = (rect.width - LABEL_WIDTH) / dates.length;
    const idx = Math.max(0, Math.min(dates.length - 1, Math.floor((clientX - rect.left - LABEL_WIDTH) / colWidth)));
    return dates[idx];
  }

  /** Bắt đầu bấm giữ trên thân event — CHƯA coi là kéo cho tới khi con trỏ dịch quá ngưỡng */
  startMove(ev: PointerEvent, event: CalendarEvent): void {
    if (!this.canEdit(event)) return; // không phải chủ event -> không kéo (vẫn click mở chi tiết được)
    this.justDragged = false;
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    this.moveCtx = {
      id: event.id,
      startX: ev.clientX,
      startY: ev.clientY,
      moved: false,
      origStart: event.start,
      origEnd: event.end,
      durationMs: event.end.getTime() - event.start.getTime(),
      event,
    };
  }

  onMove(ev: PointerEvent): void {
    const ctx = this.moveCtx;
    if (!ctx) return;

    const dx = ev.clientX - ctx.startX;
    const dy = ev.clientY - ctx.startY;
    // Ngưỡng 4px: dưới ngưỡng vẫn coi là "click" (mở chi tiết), không phải kéo
    if (!ctx.moved && Math.hypot(dx, dy) < 4) return;
    ctx.moved = true;

    // Dọc -> đổi giờ bắt đầu (snap 15 phút); Ngang -> đổi ngày theo cột dưới con trỏ
    const deltaMin = Math.round((dy / HOUR_HEIGHT) * 60 / 15) * 15;
    const durMin = ctx.durationMs / 60000;
    const origMinutes = ctx.origStart.getHours() * 60 + ctx.origStart.getMinutes();
    const newMinutes = Math.max(0, Math.min(1440 - durMin, origMinutes + deltaMin)); // giữ event trong 1 ngày

    const base = new Date(this.dayFromClientX(ev.clientX));
    base.setHours(0, 0, 0, 0);
    const newStart = new Date(base.getTime() + newMinutes * 60000);
    const newEnd = new Date(newStart.getTime() + ctx.durationMs);

    this.resizePreview.set({ id: ctx.id, start: newStart, end: newEnd });
  }

  endMove(ev: PointerEvent): void {
    const ctx = this.moveCtx;
    const preview = this.resizePreview();
    this.moveCtx = null;
    (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);

    if (!ctx || !ctx.moved) {
      this.resizePreview.set(null); // chỉ là click -> để (click) mở popup chi tiết
      return;
    }

    this.justDragged = true; // đã kéo -> chặn click mở popup ngay sau đó

    if (preview && (preview.start.getTime() !== ctx.origStart.getTime() || preview.end.getTime() !== ctx.origEnd.getTime())) {
      // Có đổi vị trí: emit để lưu, GIỮ preview cho tới khi events() khớp (effect tự bỏ) -> không giật
      this.eventTimesChanged.emit({ ...ctx.event, start: preview.start, end: preview.end });
      this.scheduleClearPreview();
    } else {
      this.resizePreview.set(null); // không đổi gì -> bỏ preview ngay
    }
  }

  /** An toàn: nếu vì lý do gì events() không khớp preview (vd lưu lỗi) thì vẫn bỏ preview sau 2s */
  private scheduleClearPreview(): void {
    clearTimeout(this.clearPreviewTimer);
    this.clearPreviewTimer = setTimeout(() => this.resizePreview.set(null), 2000);
  }

  /** Bắt đầu kéo 1 mép của sự kiện (top = đổi giờ bắt đầu, bottom = đổi giờ kết thúc) */
  startResize(ev: PointerEvent, event: CalendarEvent, edge: 'top' | 'bottom'): void {
    if (!this.canEdit(event)) return; // chỉ chủ event mới co giãn được
    ev.preventDefault();
    ev.stopPropagation(); // không để lan lên nút -> tránh mở popup chi tiết
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    this.resizeCtx = { id: event.id, edge, startY: ev.clientY, origStart: event.start, origEnd: event.end, event };
    this.resizePreview.set({ id: event.id, start: event.start, end: event.end });
  }

  onResizeMove(ev: PointerEvent): void {
    const ctx = this.resizeCtx;
    if (!ctx) return;

    // Đổi khoảng cách kéo (px) -> phút, làm tròn về bội số 15 phút cho "dính" đẹp như Google Calendar
    const deltaMin = Math.round(((ev.clientY - ctx.startY) / HOUR_HEIGHT) * 60 / 15) * 15;
    const MIN_MS = 15 * 60000;

    const dayStart = new Date(ctx.origStart);
    dayStart.setHours(0, 0, 0, 0);

    let start = ctx.origStart;
    let end = ctx.origEnd;

    if (ctx.edge === 'bottom') {
      end = new Date(ctx.origEnd.getTime() + deltaMin * 60000);
      // Sự kiện có giờ cụ thể phải kết thúc trong cùng ngày (23:59:59) — không cho kéo qua
      // ngày hôm sau, vì view Tuần/Ngày chỉ vẽ trên cột ngày bắt đầu (cắt cụt phần dư), gây
      // hiểu nhầm; muốn tạo sự kiện nhiều ngày thì dùng chế độ "Cả ngày" trong form.
      const endOfDayMs = dayStart.getTime() + 24 * 60 * 60000 - 1000;
      if (end.getTime() > endOfDayMs) end = new Date(endOfDayMs);
      if (end.getTime() - start.getTime() < MIN_MS) end = new Date(start.getTime() + MIN_MS);
    } else {
      start = new Date(ctx.origStart.getTime() + deltaMin * 60000);
      if (start.getTime() < dayStart.getTime()) start = new Date(dayStart.getTime());
      if (end.getTime() - start.getTime() < MIN_MS) start = new Date(end.getTime() - MIN_MS);
    }

    this.resizePreview.set({ id: ctx.id, start, end });
  }

  endResize(ev: PointerEvent): void {
    const ctx = this.resizeCtx;
    const preview = this.resizePreview();
    this.resizeCtx = null;
    (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);

    if (
      ctx &&
      preview &&
      (preview.start.getTime() !== ctx.origStart.getTime() || preview.end.getTime() !== ctx.origEnd.getTime())
    ) {
      // Giữ preview tới khi events() khớp (effect tự bỏ) -> không nhấp nháy về giờ cũ
      this.eventTimesChanged.emit({ ...ctx.event, start: preview.start, end: preview.end });
      this.scheduleClearPreview();
    } else {
      this.resizePreview.set(null);
    }
  }

  private formatTime(d: Date): string {
    // Theo cài đặt định dạng giờ (12h/24h) + timezone của người dùng.
    return this.settings.formatTime(d);
  }

  formatRange(e: CalendarEvent): string {
    return `${this.formatTime(e.start)} – ${this.formatTime(e.end)}`;
  }

  /** Chỉ giờ bắt đầu — dùng khi block quá ngắn, chỉ hiện được 1 dòng */
  formatStart(e: CalendarEvent): string {
    return this.formatTime(e.start);
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
    // Nếu vừa kéo dời xong thì bỏ qua click này (không mở popup chi tiết)
    if (this.justDragged) {
      this.justDragged = false;
      return;
    }
    this.eventClicked.emit(event);
  }
}
