// EventsApiService: cầu nối duy nhất giữa Angular và NestJS cho dữ liệu sự kiện.
// Chuyển đổi định dạng 2 chiều:
//   - Gửi đi: CalendarEvent (Date object, camelCase) -> payload (ISO string, camelCase khớp DTO backend)
//   - Nhận về: hàng dữ liệu từ Postgres (snake_case) -> CalendarEvent (Date object, camelCase)

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AttendeeStatus, CalendarEvent, EventKind } from './calendar.types';

interface ApiAttendee {
  id: string;
  email: string;
  status: AttendeeStatus;
}

interface ApiEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  kind: EventKind;
  color: string;
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
    guests: (row.attendees ?? []).map((a) => ({ email: a.email, status: a.status })),
    color: row.color ?? 'sky',
  };
}

@Injectable({ providedIn: 'root' })
export class EventsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/events`;

  list(): Observable<CalendarEvent[]> {
    return this.http.get<ApiEvent[]>(this.base).pipe(map((rows) => rows.map(fromApiEvent)));
  }

  create(draft: Omit<CalendarEvent, 'id'>): Observable<SaveResult> {
    return this.http.post<MutationResponse>(this.base, toApiPayload(draft)).pipe(
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

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
