// Service quản lý toàn bộ state của tính năng Calendar bằng Angular Signals.
//
// CẬP NHẬT SO VỚI GIAI ĐOẠN 1: `events` giờ được tải từ NestJS API thật (qua
// EventsApiService) thay vì dữ liệu mẫu cố định. saveEvent/deleteEvent giờ là
// các thao tác BẤT ĐỒNG BỘ (gọi HTTP), nhưng interface bên ngoài (component gọi
// state.saveEvent(...)) không đổi — component không cần sửa gì thêm.

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AttendeeStatus, CalendarEvent, EventKind, ViewMode } from './calendar.types';
import { addDays, addMonths, addYears, startOfDay } from './date-utils';
import { EventsApiService, RecurrenceOptions, Invitation } from './events-api.service';
import { SupabaseService } from '../auth/supabase.service';
import { SharingApiService } from '../sharing/sharing-api.service';
import { GoogleMeetService } from '../groups/google-meet.service';

@Injectable({ providedIn: 'root' })
export class CalendarStateService {
  private readonly api = inject(EventsApiService);
  private readonly supabase = inject(SupabaseService);
  private readonly sharingApi = inject(SharingApiService);
  private readonly meet = inject(GoogleMeetService);

  /** Các lịch được chia sẻ CHO mình (kèm vai trò) — để phân biệt & phân quyền editor. */
  readonly sharedCalendars = signal<{ id: string; role: 'viewer' | 'editor' }[]>([]);
  private readonly editorCalendarIds = computed(
    () => new Set(this.sharedCalendars().filter((c) => c.role === 'editor').map((c) => c.id)),
  );
  private readonly sharedCalendarIds = computed(
    () => new Set(this.sharedCalendars().map((c) => c.id)),
  );

  /** true nếu user hiện tại được phép SỬA event này (chủ event, hoặc editor của lịch được chia sẻ). */
  canEditEvent(e: CalendarEvent): boolean {
    const me = this.supabase.user()?.email?.toLowerCase();
    if (!e.creatorEmail) return true; // event cũ chưa có creatorEmail -> thường của mình
    if (e.creatorEmail.toLowerCase() === me) return true;
    return !!e.calendarId && this.editorCalendarIds().has(e.calendarId);
  }

  /** true nếu event thuộc lịch của NGƯỜI KHÁC chia sẻ cho mình (để hiện nhãn). */
  isSharedEvent(e: CalendarEvent): boolean {
    return !!e.calendarId && this.sharedCalendarIds().has(e.calendarId);
  }

  private loadSharedCalendars(): void {
    this.sharingApi.sharedWithMe().subscribe({
      next: (rows) =>
        this.sharedCalendars.set(
          (rows ?? [])
            .filter((r) => r.calendar)
            .map((r) => ({ id: r.calendar!.id, role: r.role })),
        ),
      error: () => {},
    });
  }

  readonly events = signal<CalendarEvent[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);

  /** Thùng rác: các sự kiện đã xóa (xóa mềm) — chỉ tải khi mở modal thùng rác */
  readonly trashedEvents = signal<CalendarEvent[]>([]);
  readonly isTrashOpen = signal(false);
  readonly isTrashLoading = signal(false);

  /** Bộ lọc hiển thị theo loại sự kiện (điều khiển bằng checkbox ở sidebar) */
  readonly visibleKinds = signal<Record<EventKind, boolean>>({ event: true, task: true, appointment: true });
  /**
   * Có hiện task đã hoàn thành trên lịch không. Do SettingsService đẩy vào (tránh
   * vòng phụ thuộc: SettingsService đã inject service này). Mặc định true.
   */
  readonly showCompletedTasks = signal(true);
  /** Danh sách sự kiện đã lọc theo visibleKinds (+ ẩn task xong nếu tắt) — các view lịch dùng cái này */
  readonly visibleEvents = computed(() =>
    this.events().filter(
      (e) =>
        this.visibleKinds()[e.kind] &&
        (this.showCompletedTasks() || e.kind !== 'task' || !e.completed),
    ),
  );

  toggleKind(kind: EventKind): void {
    this.visibleKinds.update((v) => ({ ...v, [kind]: !v[kind] }));
  }

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

  private reloadTimer?: ReturnType<typeof setTimeout>;
  private lastLocalChangeAt = 0;
  /** "Ghim" vị trí event vừa kéo trong ~2.5s: dù reload trả dữ liệu cũ vẫn giữ vị trí mới -> không giật */
  private readonly recentlyMoved = new Map<string, { start: Date; end: Date; until: number }>();

  private realtimeChannel?: RealtimeChannel;

  /** Lời mời CHƯA trả lời của user — hiện ở chuông thông báo trên trang lịch. */
  readonly invitations = signal<Invitation[]>([]);

  constructor() {
    this.reload();
    this.reloadInvitations();
    this.loadSharedCalendars();
    // QUAN TRỌNG: chỉ đăng ký Realtime SAU khi đã có token đăng nhập, và gắn token cho kênh
    // (setAuth). Nếu đăng ký lúc chưa đăng nhập, kênh chạy quyền ẩn danh -> RLS chặn -> KHÔNG
    // nhận được thay đổi của người khác (vd khách vừa Đồng ý) nên phải F5 mới thấy.
    // Đăng ký LẠI khi token đổi (đăng nhập lại / refresh token mỗi giờ) để kênh luôn hợp lệ.
    effect(() => {
      const token = this.supabase.session()?.access_token;
      if (!token) return;
      this.supabase.client.realtime.setAuth(token);
      this.subscribeRealtime();
    });
  }

  /**
   * Lắng nghe REALTIME: mỗi khi bảng events / event_attendees thay đổi (ai đó tạo/sửa/xóa/mời),
   * tự tải lại danh sách -> lịch cập nhật ngay không cần reload trang.
   * Gom nhiều thay đổi liên tiếp (vd tạo event lặp) vào 1 lần tải bằng debounce ~400ms.
   */
  private subscribeRealtime(): void {
    // Bỏ kênh cũ trước khi tạo kênh mới (tránh đăng ký trùng khi token đổi).
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = undefined;
    }
    this.realtimeChannel = this.supabase.client
      .channel('calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => this.scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_attendees' }, () => this.scheduleReload())
      .subscribe();
  }

  private scheduleReload(): void {
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      // Lời mời không có vấn đề "giật" -> luôn cập nhật (vd khách vừa được mời/đã trả lời).
      this.reloadInvitations();
      // Nếu vừa TỰ thay đổi (tạo/sửa/kéo/xóa) thì optimistic đã đúng rồi -> bỏ qua reload
      // để tránh nó tải lại và "giật" event về chỗ cũ. Thay đổi của NGƯỜI KHÁC vẫn reload bình thường.
      if (Date.now() - this.lastLocalChangeAt < 1500) return;
      this.reload();
    }, 400);
  }

  /** Đánh dấu mốc user vừa tự thay đổi -> để scheduleReload bỏ qua reload realtime của chính mình */
  private markLocalChange(): void {
    this.lastLocalChangeAt = Date.now();
  }

  /** Giữ nguyên giờ của các event vừa kéo (ghim) khi áp danh sách mới tải về */
  private applyPins(list: CalendarEvent[]): CalendarEvent[] {
    const now = Date.now();
    for (const [id, p] of this.recentlyMoved) if (p.until < now) this.recentlyMoved.delete(id);
    if (this.recentlyMoved.size === 0) return list;
    return list.map((e) => {
      const p = this.recentlyMoved.get(e.id);
      return p ? { ...e, start: p.start, end: p.end } : e;
    });
  }

  /** Gọi lại API lấy danh sách sự kiện mới nhất — dùng lúc khởi động và có thể gọi lại thủ công nếu cần */
  reload(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (events) => {
        this.events.set(this.applyPins(events));
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Không tải được danh sách sự kiện. Kiểm tra lại NestJS server đã chạy và đã đăng nhập chưa.');
        this.isLoading.set(false);
      },
    });
  }

  /** Tải lại danh sách lời mời chưa trả lời (cho chuông thông báo). */
  reloadInvitations(): void {
    this.api.listInvitations().subscribe({
      next: (l) => this.invitations.set(l),
      error: () => this.invitations.set([]),
    });
  }

  /** Đồng ý / Từ chối 1 lời mời NGAY trong app (không cần qua Gmail). */
  respondInvitation(eventId: string, status: 'accepted' | 'declined'): void {
    // Bỏ khỏi danh sách lời mời ngay (optimistic) cho mượt.
    this.invitations.update((l) => l.filter((x) => x.eventId !== eventId));
    this.api.rsvp(eventId, status as any).subscribe({
      next: () => {
        // Đồng ý -> tải lại lịch để thấy sự kiện vừa nhận. Từ chối -> không cần.
        if (status === 'accepted') this.reload();
      },
      // Lỗi -> tải lại danh sách lời mời để khôi phục trạng thái đúng.
      error: () => this.reloadInvitations(),
    });
  }

  /** Tạo phòng Google Meet cho 1 sự kiện rồi lưu link vào sự kiện đó. */
  async createMeetForEvent(eventId: string): Promise<void> {
    this.loadError.set(null);
    try {
      const link = await this.meet.createSpace(); // gọi Google Meet API (cần token Google + quyền Meet)
      this.api.setMeetLink(eventId, link).subscribe({
        next: (saved) => {
          this.markLocalChange();
          this.events.update((list) => list.map((e) => (e.id === saved.id ? saved : e)));
        },
        error: () => this.loadError.set('Lưu link Meet thất bại.'),
      });
    } catch (e: any) {
      // Chưa cấp quyền Meet -> chuyển sang Google xin quyền, xong quay lại bấm "Tạo Meet" lần nữa.
      if (e?.code === 'NEED_CONSENT') {
        await this.meet.requestAccess();
        return;
      }
      this.loadError.set(e?.message || 'Tạo Google Meet thất bại.');
    }
  }

  /** Gỡ link Google Meet khỏi 1 sự kiện. */
  removeMeetForEvent(eventId: string): void {
    this.loadError.set(null);
    this.api.removeMeetLink(eventId).subscribe({
      next: (saved) => {
        this.markLocalChange();
        this.events.update((list) => list.map((e) => (e.id === saved.id ? saved : e)));
      },
      error: () => this.loadError.set('Gỡ link Meet thất bại.'),
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

  saveEvent(
    draft: Omit<CalendarEvent, 'id'> & { id?: string },
    recurrence?: RecurrenceOptions,
    afterSave?: (event: CalendarEvent) => void,
    // Lỗi lưu (vd mất mạng, server 500...) — form vẫn đang mở nên KHÔNG dùng loadError
    // (banner đó nằm dưới modal, người dùng không thấy được). Truyền callback để modal
    // tự hiện lỗi ngay trong form, không đóng form (giữ lại dữ liệu vừa nhập, kể cả khách mời).
    onError?: () => void,
  ): void {
    this.markLocalChange();
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
        // Cho phép caller làm tiếp sau khi lưu (vd: upload file đính kèm vào event mới).
        afterSave?.(event);
        this.closeForm();
      },
      error: () => {
        this.loadError.set('Lưu sự kiện thất bại. Thử lại sau.');
        onError?.();
      },
    });
  }

  /**
   * Lưu giờ mới sau khi kéo co giãn sự kiện. Dùng cập nhật LẠC QUAN (optimistic):
   * đổi giờ trên UI NGAY (khỏi giật về chỗ cũ trong lúc chờ API), nếu API lỗi thì trả lại giờ cũ.
   */
  updateEventTimes(event: CalendarEvent): void {
    this.markLocalChange();
    const { id, ...rest } = event;
    const previous = this.events();

    // Ghim vị trí vừa kéo trong 2.5s -> mọi reload trong lúc đó vẫn giữ đúng chỗ (không giật)
    this.recentlyMoved.set(id, { start: event.start, end: event.end, until: Date.now() + 2500 });

    // Cập nhật ngay trên giao diện
    this.events.update((list) => list.map((e) => (e.id === id ? event : e)));

    this.api.update(id, rest).subscribe({
      next: ({ event: saved, conflictTitles }) => {
        this.events.update((list) => list.map((e) => (e.id === saved.id ? saved : e)));
        this.lastSavedConflicts.set(conflictTitles);
      },
      error: () => {
        this.recentlyMoved.delete(id);
        this.events.set(previous); // lưu thất bại -> khôi phục giờ cũ
        this.loadError.set('Lưu sự kiện thất bại. Thử lại sau.');
      },
    });
  }

  /** User tự đặt trạng thái tham dự cho 1 event -> cập nhật lại danh sách khách của event đó */
  rsvp(eventId: string, status: AttendeeStatus): void {
    this.markLocalChange();
    this.api.rsvp(eventId, status).subscribe({
      next: (guests) => {
        this.events.update((list) => list.map((e) => (e.id === eventId ? { ...e, guests } : e)));
      },
      error: () => {
        this.loadError.set('Cập nhật trạng thái tham dự thất bại. Thử lại sau.');
      },
    });
  }

  /** Đánh dấu task hoàn thành / chưa (cập nhật lạc quan). */
  setTaskCompleted(id: string, completed: boolean): void {
    this.markLocalChange();
    const previous = this.events();
    this.events.update((list) => list.map((e) => (e.id === id ? { ...e, completed } : e)));
    this.api.setCompleted(id, completed).subscribe({
      next: (saved) => this.events.update((list) => list.map((e) => (e.id === saved.id ? saved : e))),
      error: () => {
        this.events.set(previous);
        this.loadError.set('Cập nhật trạng thái task thất bại. Thử lại sau.');
      },
    });
  }

  deleteEvent(id: string, scope?: 'series'): void {
    this.markLocalChange();
    this.api.delete(id, scope).subscribe({
      next: () => {
        if (scope === 'series') {
          // Xóa cả chuỗi -> nhiều event bị xóa, tải lại danh sách cho chắc
          this.reload();
        } else {
          this.events.update((list) => list.filter((e) => e.id !== id));
        }
        this.selectedEventId.set(null);
      },
      error: () => {
        this.loadError.set('Xóa sự kiện thất bại. Thử lại sau.');
      },
    });
  }

  // ===================== THÙNG RÁC =====================

  /** Mở modal thùng rác và tải danh sách sự kiện đã xóa */
  openTrash(): void {
    this.isTrashOpen.set(true);
    this.loadTrash();
  }

  closeTrash(): void {
    this.isTrashOpen.set(false);
  }

  loadTrash(): void {
    this.isTrashLoading.set(true);
    this.api.listTrash().subscribe({
      next: (list) => {
        this.trashedEvents.set(list);
        this.isTrashLoading.set(false);
      },
      error: () => {
        this.loadError.set('Không tải được thùng rác. Thử lại sau.');
        this.isTrashLoading.set(false);
      },
    });
  }

  /** Khôi phục 1 sự kiện từ thùng rác -> quay lại lịch */
  restoreFromTrash(id: string): void {
    this.markLocalChange();
    this.api.restore(id).subscribe({
      next: () => {
        this.trashedEvents.update((list) => list.filter((e) => e.id !== id));
        this.reload(); // tải lại lịch để thấy sự kiện vừa khôi phục
      },
      error: () => {
        this.loadError.set('Khôi phục thất bại. Thử lại sau.');
      },
    });
  }

  /** Xóa vĩnh viễn 1 sự kiện trong thùng rác (không khôi phục được) */
  purgeFromTrash(id: string): void {
    this.api.purge(id).subscribe({
      next: () => {
        this.trashedEvents.update((list) => list.filter((e) => e.id !== id));
      },
      error: () => {
        this.loadError.set('Xóa vĩnh viễn thất bại. Thử lại sau.');
      },
    });
  }
}
