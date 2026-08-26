// Cầu nối Angular <-> API feed lịch công khai (.ics).
// Link feed phải là URL TUYỆT ĐỐI trỏ tới BACKEND (Google/Outlook gọi trực tiếp, không qua app).
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CalendarFeed {
  token: string;
  enabled: boolean;
  /** Khoảng ngày được chia sẻ qua link (ISO). null = không giới hạn. */
  feed_from?: string | null;
  feed_until?: string | null;
}

@Injectable({ providedIn: 'root' })
export class FeedApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getMyFeed(): Observable<CalendarFeed> {
    return this.http.get<CalendarFeed>(`${this.base}/feed/me`);
  }
  updateMyFeed(patch: {
    enabled?: boolean;
    rotate?: boolean;
    feedFrom?: string | null;
    feedUntil?: string | null;
  }): Observable<CalendarFeed> {
    return this.http.patch<CalendarFeed>(`${this.base}/feed/me`, patch);
  }

  /** URL công khai .ics để subscribe. Dev: qua origin (proxy); Prod: dùng apiUrl tuyệt đối. */
  feedUrl(token: string): string {
    const origin = this.base.startsWith('http')
      ? this.base
      : `${window.location.origin}${this.base}`;
    return `${origin}/public/calendar/${token}.ics`;
  }
}
