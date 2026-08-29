// Cầu nối Angular <-> API tài liệu đính kèm sự kiện.
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Giới hạn dung lượng 1 file đính kèm — PHẢI khớp với backend (Multer + AttachmentsService.MAX_BYTES). */
export const MAX_ATTACHMENT_MB = 10;
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

export type AttachmentStatus = 'available' | 'scheduled' | 'expired';

export interface EventAttachment {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  /** Khoảng cho phép xem (ISO) — null = không giới hạn. */
  available_from?: string | null;
  available_until?: string | null;
  /** Trạng thái xem: available (mở), scheduled (chưa tới giờ), expired (hết hạn). */
  status?: AttachmentStatus;
  url: string | null;
}

/** Tuỳ chọn hẹn giờ khi upload. ISO string hoặc null. */
export interface UploadSchedule {
  availableFrom?: string | null;
  availableUntil?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AttachmentsApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(eventId: string): Observable<EventAttachment[]> {
    return this.http.get<EventAttachment[]>(`${this.base}/events/${eventId}/attachments`);
  }
  upload(eventId: string, file: File, schedule?: UploadSchedule): Observable<EventAttachment> {
    const fd = new FormData();
    fd.append('file', file);
    if (schedule?.availableFrom) fd.append('availableFrom', schedule.availableFrom);
    if (schedule?.availableUntil) fd.append('availableUntil', schedule.availableUntil);
    return this.http.post<EventAttachment>(`${this.base}/events/${eventId}/attachments`, fd);
  }
  remove(eventId: string, attId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/events/${eventId}/attachments/${attId}`);
  }
  /** Tài liệu vừa tới giờ mở trong 24h qua (cho thông báo trong app). */
  recentAvailable(): Observable<RecentAttachment[]> {
    return this.http.get<RecentAttachment[]>(`${this.base}/attachments/recent-available`);
  }
  /** Tất cả tài liệu của mình, gom nhóm theo sự kiện (cho mục Cài đặt > Tệp đính kèm). */
  listAllGrouped(): Observable<EventFileGroup[]> {
    return this.http.get<EventFileGroup[]>(`${this.base}/attachments/by-event`);
  }
}

/** 1 nhóm file thuộc cùng 1 sự kiện. */
export interface EventFileGroup {
  event_id: string;
  event_title: string;
  event_start: string | null;
  files: (EventAttachment & { event_id: string })[];
}

export interface RecentAttachment {
  id: string;
  file_name: string;
  event_id: string;
  event_title: string;
  available_from: string;
}
