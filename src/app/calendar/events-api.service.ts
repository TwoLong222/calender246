// EventsApiService: cầu nối duy nhất giữa Angular và NestJS cho dữ liệu sự kiện.
// Chuyển đổi định dạng 2 chiều:
//   - Gửi đi: CalendarEvent (Date object, camelCase) -> payload (ISO string, camelCase khớp DTO backend)
//   - Nhận về: hàng dữ liệu từ Postgres (snake_case) -> CalendarEvent (Date object, camelCase)

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AttendeeStatus, CalendarEvent, EventKind, Guest } from './calendar.types';

interface ApiAttendee {
  id: string;
  email: string;
  status: AttendeeStatus;
}

interface ApiEvent {
  id: string;
  calendar_id?: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  kind: EventKind;
  color: string;
  series_id: string | null;
  creator_email?: string | null;
  reminder_minutes?: number | null;
  completed?: boolean;
  deleted_at?: string | null;
  attendees?: ApiAttendee[];
}

interface MutationResponse {
  event: ApiEvent;
  conflicts: { id: string; title: string; start_time: string; end_time: string }[];
}

interface SaveResult {
  event: CalendarEvent;
  /** Tiêu đề các sự kiện bị trùng lịch, do SERVER xác nhận lại (nguồn sự thật cuối cùng) */
  conflictTitles: string[];
}

function toApiPayload(e: Omit<CalendarEvent, 'id'>) {
  return {
    title: e.title,
    description: e.description,
    location: e.location,
    startTime: e.start.toISOString(),
    endTime: e.end.toISOString(),
    isAllDay: e.isAllDay,
    // "Lên lịch hẹn" (appointment) chưa có bảng riêng ở backend -> tạm lưu như "event" thường
    kind: (e.kind === 'appointment' ? 'event' : e.kind) as 'event' | 'task',
    color: e.color,
    reminderMinutes: e.reminderMinutes ?? null,
    guestEmails: e.guests.map((g) => g.email),
  };
}

function fromApiEvent(row: ApiEvent): CalendarEvent {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    start: new Date(row.start_time),
    end: new Date(row.end_time),
    isAllDay: row.is_all_day,
    // Người tạo có thể được backend tự thêm vào bảng khách mời để nhận email nhắc.
    // Không hiển thị chính mình như một "khách mời" -> lọc bỏ theo creator_email.
    guests: (row.attendees ?? [])
      .filter((a) => a.email.toLowerCase() !== (row.creator_email ?? '').toLowerCase())
      .map((a) => ({ email: a.email, status: a.status })),
    color: row.color ?? 'sky',
    seriesId: row.series_id ?? null,
    creatorEmail: row.creator_email ?? undefined,
    calendarId: row.calendar_id ?? undefined,
    reminderMinutes: row.reminder_minutes ?? null,
    completed: row.completed ?? false,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

/** Lời mời chưa trả lời (trang Lời mời). */
export interface Invitation {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location: string | null;
  color: string;
  creatorEmail: string | null;
  myStatus: string;
}

/** Tùy chọn lặp lại khi tạo event mới (materialized: backend tạo `count` event thật) */
export interface RecurrenceOptions {
  repeat: 'daily' | 'weekly' | 'monthly';
  count: number;
  /** Lặp mỗi N đơn vị (mặc định 1). */
  interval?: number;
}

@Injectable({ providedIn: 'root' })
export class EventsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/events`;

  list(): Observable<CalendarEvent[]> {
    return this.http.get<ApiEvent[]>(this.base).pipe(map((rows) => rows.map(fromApiEvent)));
  }

  create(draft: Omit<CalendarEvent, 'id'>, recurrence?: RecurrenceOptions): Observable<SaveResult> {
    const payload = recurrence
      ? { ...toApiPayload(draft), repeat: recurrence.repeat, repeatCount: recurrence.count, repeatInterval: recurrence.interval ?? 1 }
      : toApiPayload(draft);
    return this.http.post<MutationResponse>(this.base, payload).pipe(
      map((res) => ({
        event: fromApiEvent(res.event),
        conflictTitles: res.conflicts.map((c) => c.title),
      })),
    );
  }

  update(id: string, draft: Omit<CalendarEvent, 'id'>): Observable<SaveResult> {
    return this.http.patch<MutationResponse>(`${this.base}/${id}`, toApiPayload(draft)).pipe(
      map((res) => ({
        event: fromApiEvent(res.event),
        conflictTitles: res.conflicts.map((c) => c.title),
      })),
    );
  }

  /** PATCH gọn chỉ đổi trạng thái hoàn thành của task. */
  setCompleted(id: string, completed: boolean): Observable<CalendarEvent> {
    return this.http
      .patch<MutationResponse>(`${this.base}/${id}`, { completed })
      .pipe(map((res) => fromApiEvent(res.event)));
  }

  delete(id: string, scope?: 'series'): Observable<void> {
    const url = scope === 'series' ? `${this.base}/${id}?scope=series` : `${this.base}/${id}`;
    return this.http.delete<void>(url);
  }

  /** Lấy danh sách sự kiện trong thùng rác */
  listTrash(): Observable<CalendarEvent[]> {
    return this.http.get<ApiEvent[]>(`${this.base}/trash`).pipe(map((rows) => rows.map(fromApiEvent)));
  }

  /** Khôi phục 1 sự kiện từ thùng rác */
  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/restore`, {});
  }

  /** Xóa vĩnh viễn 1 sự kiện trong thùng rác */
  purge(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/purge`);
  }

  /** Lời mời chưa trả lời của user (để bấm Đồng ý/Từ chối ở trang Lời mời) */
  listInvitations(): Observable<Invitation[]> {
    return this.http.get<Invitation[]>(`${this.base}/invitations`);
  }

  /** User tự đặt trạng thái tham dự -> trả về danh sách khách mời mới (đã cập nhật) */
  rsvp(id: string, status: AttendeeStatus): Observable<Guest[]> {
    return this.http
      .post<{ attendees: ApiAttendee[] }>(`${this.base}/${id}/rsvp`, { status })
      .pipe(map((res) => (res.attendees ?? []).map((a) => ({ email: a.email, status: a.status }))));
  }
}
