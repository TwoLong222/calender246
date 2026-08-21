import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EventComment {
  id: string;
  eventId: string;
  userEmail: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ApiComment {
  id: string;
  event_id: string;
  user_email: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

function fromApi(c: ApiComment): EventComment {
  return {
    id: c.id,
    eventId: c.event_id,
    userEmail: c.user_email ?? '(ẩn danh)',
    content: c.content,
    createdAt: new Date(c.created_at),
    updatedAt: new Date(c.updated_at),
  };
}

@Injectable({ providedIn: 'root' })
export class CommentsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  list(eventId: string): Observable<EventComment[]> {
    return this.http
      .get<ApiComment[]>(`${this.base}/events/${eventId}/comments`)
      .pipe(map((rows) => rows.map(fromApi)));
  }

  create(eventId: string, content: string): Observable<EventComment> {
    return this.http.post<ApiComment>(`${this.base}/events/${eventId}/comments`, { content }).pipe(map(fromApi));
  }

  update(id: string, content: string): Observable<EventComment> {
    return this.http.patch<ApiComment>(`${this.base}/comments/${id}`, { content }).pipe(map(fromApi));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/comments/${id}`);
  }
}
