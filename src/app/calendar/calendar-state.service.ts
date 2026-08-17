// Service quản lý toàn bộ state của tính năng Calendar bằng Angular Signals.
//
// CẬP NHẬT SO VỚI GIAI ĐOẠN 1: `events` giờ được tải từ NestJS API thật (qua
// EventsApiService) thay vì dữ liệu mẫu cố định. saveEvent/deleteEvent giờ là
// các thao tác BẤT ĐỒNG BỘ (gọi HTTP), nhưng interface bên ngoài (component gọi
// state.saveEvent(...)) không đổi — component không cần sửa gì thêm.

import { Injectable, computed, inject, signal } from '@angular/core';
import { CalendarEvent, EventKind, ViewMode } from './calendar.types';
import { addDays, addMonths, addYears, startOfDay } from './date-utils';
import { EventsApiService, RecurrenceOptions } from './events-api.service';

@Injectable({ providedIn: 'root' })
export class CalendarStateService {
  private readonly api = inject(EventsApiService);

  readonly events = signal<CalendarEvent[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly viewMode = signal<ViewMode>('week');
  readonly viewedDate = signal<Date>(startOfDay(new Date()));
  readonly selectedEventId = signal<string | null>(null);
  readonly isFormOpen = signal(false);
  readonly editingEventId = signal<string | null>(null);
  readonly formInitialKind = signal<EventKind>('event');
  readonly formInitialStart = signal<Date>(new Date());
  /** Tiêu đề các sự kiện bị trùng lịch — server xác nhận SAU khi lưu thành công, hiện cảnh báo cho người dùng */
  readonly lastSavedConflicts = signal<string[]>([]);

  private readonly today = new Date();

  readonly selectedEvent = computed(() => this.events().find((e) => e.id === this.selectedEventId()) ?? null);
  readonly editingEvent = computed(() => this.events().find((e) => e.id === this.editingEventId()) ?? null);

  constructor() {
    this.reload();
  }

  /** Gọi lại API lấy danh sách sự kiện mới nhất — dùng lúc khởi động và có thể gọi lại thủ công nếu cần */
  reload(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (events) => {
        this.events.set(events);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Không tải được danh sách sự kiện. Kiểm tra lại NestJS server đã chạy và đã đăng nhập chưa.');
        this.isLoading.set(false);
      },
    });
  }

  isToday(d: Date): boolean {
    const t = this.today;
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }

  goToday(): void {
    this.viewedDate.set(startOfDay(new Date()));
  }

  goPrev(): void {
    this.shift(-1);
  }

  goNext(): void {
    this.shift(1);
  }

  private shift(direction: 1 | -1): void {
    const d = this.viewedDate();
    switch (this.viewMode()) {
      case 'day':
        this.viewedDate.set(addDays(d, direction));
        break;
      case 'week':
        this.viewedDate.set(addDays(d, direction * 7));
        break;
      case 'month':
        this.viewedDate.set(addMonths(d, direction));
        break;
      case 'year':
        this.viewedDate.set(addYears(d, direction));
        break;
    }
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  selectDate(d: Date, switchToDayView = false): void {
    this.viewedDate.set(startOfDay(d));
    if (switchToDayView) this.viewMode.set('day');
  }

  selectEvent(id: string): void {
    this.selectedEventId.set(id);
  }

  closeDetail(): void {
    this.selectedEventId.set(null);
  }

  openCreateForm(kind: EventKind = 'event', start?: Date): void {
    this.editingEventId.set(null);
    this.formInitialKind.set(kind);
    this.formInitialStart.set(start ?? new Date());
    this.isFormOpen.set(true);
    this.selectedEventId.set(null);
  }

  openEditForm(event: CalendarEvent): void {
    this.editingEventId.set(event.id);
    this.formInitialKind.set(event.kind);
    this.formInitialStart.set(event.start);
    this.isFormOpen.set(true);
    this.selectedEventId.set(null);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.editingEventId.set(null);
  }

  /** Cảnh báo trùng lịch NGAY khi đang gõ trong modal (trước khi bấm Lưu) — tính ở client cho phản hồi tức thời */
  findConflicts(start: Date, end: Date, excludeId?: string): CalendarEvent[] {
    return this.events().filter((e) => {
      if (e.id === excludeId) return false;
      if (e.isAllDay || e.kind === 'task') return false;
      return start < e.end && end > e.start;
    });
  }

  saveEvent(draft: Omit<CalendarEvent, 'id'> & { id?: string }, recurrence?: RecurrenceOptions): void {
    const { id, ...rest } = draft;
    const request$ = id ? this.api.update(id, rest) : this.api.create(rest, recurrence);

    request$.subscribe({
      next: ({ event, conflictTitles }) => {
        if (recurrence) {
          // Sự kiện lặp tạo nhiều event cùng lúc -> tải lại danh sách để thấy hết các lần lặp
          this.reload();
        } else {
          this.events.update((list) => {
            const exists = list.some((e) => e.id === event.id);
            return exists ? list.map((e) => (e.id === event.id ? event : e)) : [...list, event];
          });
        }
        this.lastSavedConflicts.set(conflictTitles);
        this.closeForm();
      },
      error: () => {
        this.loadError.set('Lưu sự kiện thất bại. Thử lại sau.');
      },
    });
  }

  /**
   * Lưu giờ mới sau khi kéo co giãn sự kiện. Dùng cập nhật LẠC QUAN (optimistic):
   * đổi giờ trên UI NGAY (khỏi giật về chỗ cũ trong lúc chờ API), nếu API lỗi thì trả lại giờ cũ.
   */
  updateEventTimes(event: CalendarEvent): void {
    const { id, ...rest } = event;
    const previous = this.events();

    // Cập nhật ngay trên giao diện
    this.events.update((list) => list.map((e) => (e.id === id ? event : e)));

    this.api.update(id, rest).subscribe({
      next: ({ event: saved, conflictTitles }) => {
        this.events.update((list) => list.map((e) => (e.id === saved.id ? saved : e)));
        this.lastSavedConflicts.set(conflictTitles);
      },
      error: () => {
        this.events.set(previous); // lưu thất bại -> khôi phục giờ cũ
        this.loadError.set('Lưu sự kiện thất bại. Thử lại sau.');
      },
    });
  }

  deleteEvent(id: string): void {
    this.api.delete(id).subscribe({
      next: () => {
        this.events.update((list) => list.filter((e) => e.id !== id));
        this.selectedEventId.set(null);
      },
      error: () => {
        this.loadError.set('Xóa sự kiện thất bại. Thử lại sau.');
      },
    });
  }
}
