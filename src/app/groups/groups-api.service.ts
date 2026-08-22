// GroupsApiService: cầu nối REST giữa Angular và NestJS cho tính năng nhóm.
// Tái dùng fromApiEvent/toApiPayload/ApiEvent của EventsApiService để map sự kiện nhóm
// (dùng chung bảng events nên cùng định dạng).

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { CalendarEvent } from '../calendar/calendar.types';
import { ApiEvent, fromApiEvent, toApiPayload } from '../calendar/events-api.service';
import { Group, GroupMessage } from './groups.types';

interface MutationResponse {
  event: ApiEvent;
  conflicts: { id: string; title: string }[];
}

interface SaveResult {
  event: CalendarEvent;
  conflictTitles: string[];
}

@Injectable({ providedIn: 'root' })
export class GroupsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/groups`;

  // ---------- Nhóm ----------
  list(): Observable<Group[]> {
    return this.http.get<Group[]>(this.base);
  }

  create(name: string): Observable<Group> {
    return this.http.post<Group>(this.base, { name });
  }

  get(id: string): Observable<Group> {
    return this.http.get<Group>(`${this.base}/${id}`);
  }

  invite(id: string, email: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/${id}/invite`, { email });
  }

  join(code: string): Observable<Group> {
    return this.http.post<Group>(`${this.base}/join`, { code });
  }

  /** Kích hoạt lời mời gửi theo email của user hiện tại (gọi khi mở app) */
  syncInvites(): Observable<{ joined: number }> {
    return this.http.post<{ joined: number }>(`${this.base}/sync-invites`, {});
  }

  removeMember(id: string, email: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}/members`, { params: { email } });
  }

  remove(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }

  // ---------- Sự kiện nhóm ----------
  listEvents(id: string): Observable<CalendarEvent[]> {
    return this.http.get<ApiEvent[]>(`${this.base}/${id}/events`).pipe(map((rows) => rows.map(fromApiEvent)));
  }

  createEvent(id: string, draft: Omit<CalendarEvent, 'id'>): Observable<SaveResult> {
    return this.http.post<MutationResponse>(`${this.base}/${id}/events`, toApiPayload(draft)).pipe(
      map((res) => ({
        event: fromApiEvent(res.event),
        conflictTitles: res.conflicts.map((c) => c.title),
      })),
    );
  }

  updateEvent(id: string, eventId: string, draft: Omit<CalendarEvent, 'id'>): Observable<SaveResult> {
    return this.http.patch<MutationResponse>(`${this.base}/${id}/events/${eventId}`, toApiPayload(draft)).pipe(
      map((res) => ({
        event: fromApiEvent(res.event),
        conflictTitles: res.conflicts.map((c) => c.title),
      })),
    );
  }

  deleteEvent(id: string, eventId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/events/${eventId}`);
  }

  // ---------- Chat nhóm ----------
  /** Lịch sử tin nhắn (cũ -> mới). `before` = ISO timestamp để lấy trang cũ hơn khi cuộn lên. */
  listMessages(id: string, before?: string, limit = 30): Observable<GroupMessage[]> {
    let params = new HttpParams().set('limit', String(limit));
    if (before) params = params.set('before', before);
    return this.http.get<GroupMessage[]>(`${this.base}/${id}/messages`, { params });
  }

  sendMessage(id: string, content: string): Observable<GroupMessage> {
    return this.http.post<GroupMessage>(`${this.base}/${id}/messages`, { content });
  }

  editMessage(id: string, messageId: string, content: string): Observable<GroupMessage> {
    return this.http.patch<GroupMessage>(`${this.base}/${id}/messages/${messageId}`, { content });
  }

  deleteMessage(id: string, messageId: string): Observable<GroupMessage> {
    return this.http.delete<GroupMessage>(`${this.base}/${id}/messages/${messageId}`);
  }

  markRead(id: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/${id}/messages/read`, {});
  }

  /** Số tin chưa đọc theo từng nhóm { groupId: count } */
  unread(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.base}/chat/unread`);
  }
}
