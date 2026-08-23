// NotesApiService: cầu nối Angular <-> NestJS cho ghi chú (kiểu Keep).
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type NoteColor =
  | 'default' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink';

export interface Note {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteDraft {
  title?: string;
  content?: string;
  color?: NoteColor;
  pinned?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notes`;

  list(): Observable<Note[]> {
    return this.http.get<Note[]>(this.base);
  }
  create(draft: NoteDraft): Observable<Note> {
    return this.http.post<Note>(this.base, draft);
  }
  update(id: string, draft: NoteDraft): Observable<Note> {
    return this.http.patch<Note>(`${this.base}/${id}`, draft);
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
