import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AiParseResult {
  intent: 'create_event' | 'plan_schedule' | 'search_events' | 'reschedule_event' | 'delete_event' | 'invite_guest' | 'unclear';
  title?: string;
  startTime?: string;
  endTime?: string;
  query?: string;
  guestEmails?: string[];
  rangeStart?: string;
  rangeEnd?: string;
  newStartTime?: string;
  newEndTime?: string;
  count?: number;
  durationMinutes?: number;
  planStart?: string;
  planEnd?: string;
  preferredStartHour?: number;
  preferredEndHour?: number;
  allowedWeekdays?: number[];
  reply: string;
}

@Injectable({ providedIn: 'root' })
export class AiApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  chat(message: string, history?: { role: 'user' | 'assistant'; text: string }[]): Observable<AiParseResult> {
    return this.http.post<AiParseResult>(`${this.base}/ai/chat`, { message, history });
  }
}
