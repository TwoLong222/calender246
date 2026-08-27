// GroupsApiService — Nơi gọi máy chủ cho tính năng nhóm.
// Gửi và nhận dữ liệu: tạo/tham gia/mời nhóm, sự kiện nhóm và tin nhắn.

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { CalendarEvent } from '../calendar/calendar.types';
import { ApiEvent, fromApiEvent, toApiPayload } from '../calendar/events-api.service';
import { Group, GroupMessage, PendingGroupInvite, SendMessagePayload } from './groups.types';

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

  /** Gắn tài khoản vào các lời mời gửi theo email của user (gọi khi mở app). Không tự vào nhóm. */
  syncInvites(): Observable<{ pending: number }> {
    return this.http.post<{ pending: number }>(`${this.base}/sync-invites`, {});
  }

  /** Danh sách lời mời nhóm đang chờ mình đồng ý. */
  listPendingInvites(): Observable<PendingGroupInvite[]> {
    return this.http.get<PendingGroupInvite[]>(`${this.base}/invites/pending`);
  }

  /** Đồng ý vào nhóm. */
  acceptInvite(groupId: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/${groupId}/accept`, {});
  }

  /** Từ chối lời mời nhóm. */
  declineInvite(groupId: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/${groupId}/decline`, {});
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

  /** Lưu link Google Meet cho 1 sự kiện nhóm (backend phát cập nhật real-time). */
  setMeetLink(id: string, eventId: string, meetLink: string): Observable<CalendarEvent> {
    return this.http
      .post<ApiEvent>(`${this.base}/${id}/events/${eventId}/meet`, { meetLink })
      .pipe(map(fromApiEvent));
  }

  /** Gỡ link Google Meet khỏi 1 sự kiện nhóm. */
  removeMeetLink(id: string, eventId: string): Observable<CalendarEvent> {
    return this.http.delete<ApiEvent>(`${this.base}/${id}/events/${eventId}/meet`).pipe(map(fromApiEvent));
  }

  // ---------- Chat nhóm ----------
  /** Lịch sử tin nhắn (cũ -> mới). `before` = ISO timestamp để lấy trang cũ hơn khi cuộn lên. */
  listMessages(id: string, before?: string, limit = 30): Observable<GroupMessage[]> {
    let params = new HttpParams().set('limit', String(limit));
    if (before) params = params.set('before', before);
    return this.http.get<GroupMessage[]>(`${this.base}/${id}/messages`, { params });
  }

  sendMessage(id: string, payload: SendMessagePayload): Observable<GroupMessage> {
    return this.http.post<GroupMessage>(`${this.base}/${id}/messages`, payload);
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
