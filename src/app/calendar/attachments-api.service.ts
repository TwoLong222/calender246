// Cầu nối Angular <-> API tài liệu đính kèm sự kiện.
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EventAttachment {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  url: string | null;
}

@Injectable({ providedIn: 'root' })
export class AttachmentsApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(eventId: string): Observable<EventAttachment[]> {
    return this.http.get<EventAttachment[]>(`${this.base}/events/${eventId}/attachments`);
  }
  upload(eventId: string, file: File): Observable<EventAttachment> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<EventAttachment>(`${this.base}/events/${eventId}/attachments`, fd);
  }
  remove(eventId: string, attId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/events/${eventId}/attachments/${attId}`);
  }
}
