// Cầu nối Angular <-> API chia sẻ lịch.
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CalendarMember {
  member_email: string;
  role: 'viewer' | 'editor';
  created_at?: string;
}
export interface SharedCalendar {
  role: 'viewer' | 'editor';
  calendar: { id: string; name: string; color: string } | null;
}

@Injectable({ providedIn: 'root' })
export class SharingApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/sharing`;

  getMembers(): Observable<CalendarMember[]> {
    return this.http.get<CalendarMember[]>(`${this.base}/members`);
  }
  addMember(email: string, role: 'viewer' | 'editor'): Observable<CalendarMember> {
    return this.http.post<CalendarMember>(`${this.base}/members`, { email, role });
  }
  removeMember(email: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/members/${encodeURIComponent(email)}`);
  }
  sharedWithMe(): Observable<SharedCalendar[]> {
    return this.http.get<SharedCalendar[]>(`${this.base}/shared-with-me`);
  }
}
