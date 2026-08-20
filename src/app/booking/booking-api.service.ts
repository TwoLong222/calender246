// Cầu nối Angular <-> API đặt lịch: cấu hình của chủ + luồng công khai.
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BookingPage {
  slug: string;
  title: string;
  duration_minutes: number;
  enabled: boolean;
}
export interface PublicPage {
  slug: string;
  title: string;
  durationMinutes: number;
}
export interface Slots {
  durationMinutes: number;
  slots: string[]; // ISO
}

@Injectable({ providedIn: 'root' })
export class BookingApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getMyPage(): Observable<BookingPage> {
    return this.http.get<BookingPage>(`${this.base}/booking/me`);
  }
  updateMyPage(patch: Partial<BookingPage>): Observable<BookingPage> {
    return this.http.patch<BookingPage>(`${this.base}/booking/me`, patch);
  }

  getPublicPage(slug: string): Observable<PublicPage> {
    return this.http.get<PublicPage>(`${this.base}/public/booking/${slug}`);
  }
  getSlots(slug: string): Observable<Slots> {
    return this.http.get<Slots>(`${this.base}/public/booking/${slug}/slots`);
  }
  book(slug: string, body: { name: string; email: string; startTime: string }) {
    return this.http.post<{ success: boolean }>(`${this.base}/public/booking/${slug}`, body);
  }
}
