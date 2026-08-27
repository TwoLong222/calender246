import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AiParseResult {
  intent:
    | 'create_event'
    | 'plan_schedule'
    | 'search_events'
    | 'reschedule_event'
    | 'delete_event'
    | 'invite_guest'
    | 'complete_task'
    | 'create_note'
    | 'search_notes'
    | 'delete_note'
    | 'create_group'
    | 'join_group'
    | 'invite_group_member'
    | 'create_group_event'
    | 'change_setting'
    | 'export_calendar'
    // Mở rộng: lặp / lời mời / thùng rác / nhóm nâng cao
    | 'stop_repeat'
    | 'delete_repeat_range'
    | 'respond_invite'
    | 'respond_group_invite'
    | 'restore_event'
    | 'leave_group'
    | 'delete_group'
    | 'remove_group_member'
    | 'mute_group'
    | 'send_group_message'
    | 'unclear';
  title?: string;
  startTime?: string;
  endTime?: string;
  kind?: 'event' | 'task' | 'appointment';
  withMeet?: boolean;
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
  completed?: boolean;
  noteTitle?: string;
  noteContent?: string;
  groupName?: string;
  groupCode?: string;
  groupQuery?: string;
  settingKey?: string;
  settingValue?: string;
  exportFormat?: 'pdf' | 'ics';
  // Sự kiện lặp
  repeatFrom?: string;
  repeatTo?: string;
  recurrenceFreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceInterval?: number;
  recurrenceCount?: number;
  recurrenceUntil?: string;
  // Lời mời
  rsvpStatus?: 'accepted' | 'declined' | 'tentative';
  // Nhóm nâng cao
  memberEmail?: string;
  muted?: boolean;
  messageText?: string;
  reply: string;
}

export interface ExtractedEventItem {
  title: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  location?: string;
  description?: string;
}

export interface AiExtractResult {
  events: ExtractedEventItem[];
  reply: string;
}

@Injectable({ providedIn: 'root' })
export class AiApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  chat(message: string, history?: { role: 'user' | 'assistant'; text: string }[]): Observable<AiParseResult> {
    return this.http.post<AiParseResult>(`${this.base}/ai/chat`, { message, history });
  }

  /** Nhờ AI tìm sự kiện trong 1 đoạn text (đọc từ file PDF ở phía client bằng pdfjs). */
  extractEvents(text: string): Observable<AiExtractResult> {
    return this.http.post<AiExtractResult>(`${this.base}/ai/extract-events`, { text });
  }
}
