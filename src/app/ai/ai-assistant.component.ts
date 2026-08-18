// Widget trợ lý AI nổi góc phải. Người dùng gõ câu tiếng Việt, backend (Gemini)
// phân tích ra Ý ĐỊNH (tạo/tìm/dời/xóa). Frontend TÌM event thật từ dữ liệu đã tải
// (đúng quyền), hiện PREVIEW, người dùng bấm Xác nhận thì mới thực thi qua các
// service có sẵn (auth + RLS). AI không bao giờ chạm thẳng database.

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiApiService } from './ai-api.service';
import { CalendarStateService } from '../calendar/calendar-state.service';
import { CalendarEvent } from '../calendar/calendar.types';
import { SupabaseService } from '../auth/supabase.service';
import { IconComponent } from '../shared/icon.component';

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
}
type Pending =
  | { kind: 'create'; title: string; start: Date; end: Date }
  | { kind: 'reschedule'; event: CalendarEvent; start: Date; end: Date }
  | { kind: 'delete'; event: CalendarEvent };

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!open()) {
      <button
        type="button"
        (click)="open.set(true)"
        class="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg hover:bg-blue-800"
        aria-label="Trợ lý AI"
      >
        <app-icon name="robot" class="h-7 w-7" />
      </button>
    } @else {
      <div class="popup-in fixed bottom-6 right-6 z-40 flex h-[460px] w-80 flex-col rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span class="flex items-center gap-2 font-medium text-gray-800">
            <app-icon name="robot" class="h-5 w-5 text-blue-700" /> Trợ lý lịch
          </span>
          <button type="button" (click)="open.set(false)" class="rounded-full p-1 text-gray-500 hover:bg-gray-100" aria-label="Đóng">
            <app-icon name="x" class="h-4 w-4" />
          </button>
        </div>

        <div class="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          @for (m of messages(); track $index) {
            <div [class]="m.role === 'user'
              ? 'ml-auto max-w-[85%] rounded-lg bg-blue-600 px-3 py-2 text-sm text-white'
              : 'mr-auto max-w-[90%] whitespace-pre-wrap rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800'">
              {{ m.text }}
            </div>
          }
          @if (loading()) {
            <div class="mr-auto rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-400">Đang nghĩ…</div>
          }
          @if (pending(); as p) {
            <div
              class="mr-auto w-full rounded-lg border px-3 py-2 text-sm"
              [class]="p.kind === 'delete' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'"
            >
              @switch (p.kind) {
                @case ('create') {
                  <p class="mb-1 font-medium text-gray-800">Tạo sự kiện:</p>
                  <p class="text-gray-700">📌 {{ p.title }}</p>
                  <p class="text-gray-700">🕐 {{ rangeLabel(p.start, p.end) }}</p>
                }
                @case ('reschedule') {
                  <p class="mb-1 font-medium text-gray-800">Dời sự kiện:</p>
                  <p class="text-gray-700">📌 {{ p.event.title }}</p>
                  <p class="text-gray-700">🕐 sang {{ rangeLabel(p.start, p.end) }}</p>
                }
                @case ('delete') {
                  <p class="mb-1 font-medium text-red-800">Xóa sự kiện:</p>
                  <p class="text-gray-700">📌 {{ p.event.title }} — {{ eventLabel(p.event) }}</p>
                }
              }
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  (click)="confirm()"
                  class="rounded px-3 py-1 text-xs font-medium text-white"
                  [class]="pending()?.kind === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'"
                >
                  Xác nhận
                </button>
                <button type="button" (click)="cancel()" class="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">Hủy</button>
              </div>
            </div>
          }
        </div>

        <div class="flex gap-2 border-t border-gray-100 p-3">
          <input
            [(ngModel)]="input"
            (keydown.enter)="send()"
            [disabled]="loading()"
            placeholder="VD: dời họp nhóm sang 4h chiều"
            class="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-600"
          />
          <button
            type="button"
            (click)="send()"
            [disabled]="loading() || !input().trim()"
            class="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40"
          >
            Gửi
          </button>
        </div>
      </div>
    }
  `,
})
export class AiAssistantComponent {
  private readonly ai = inject(AiApiService);
  private readonly state = inject(CalendarStateService);
  private readonly supabase = inject(SupabaseService);

  open = signal(false);
  input = signal('');
  loading = signal(false);
  pending = signal<Pending | null>(null);
  messages = signal<ChatMsg[]>([
    {
      role: 'ai',
      text: 'Chào bạn! Mình có thể: tạo, tìm, dời, xóa sự kiện.\nVD: "Mai 3h chiều họp nhóm 1 tiếng", "tuần này có họp gì", "dời họp nhóm sang 4h", "xóa họp nhóm mai".',
    },
  ]);

  private push(text: string): void {
    this.messages.update((m) => [...m, { role: 'ai', text }]);
  }

  /** Tìm event thật từ dữ liệu đã tải (đúng quyền), theo từ khóa + khoảng thời gian */
  private findEvents(query?: string, rangeStart?: string, rangeEnd?: string): CalendarEvent[] {
    const q = (query ?? '').trim().toLowerCase();
    const rs = rangeStart ? new Date(rangeStart).getTime() : null;
    const re = rangeEnd ? new Date(rangeEnd).getTime() : null;
    return this.state
      .events()
      .filter((e) => {
        const matchQ =
          !q ||
          e.title.toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q) ||
          (e.location ?? '').toLowerCase().includes(q);
        const t = e.start.getTime();
        const matchRange = (rs === null || t >= rs) && (re === null || t <= re);
        return matchQ && matchRange;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private listMsg(events: CalendarEvent[]): string {
    return events.slice(0, 8).map((e) => `• ${e.title || '(không tiêu đề)'} — ${this.eventLabel(e)}`).join('\n');
  }

  send(): void {
    const text = this.input().trim();
    if (!text || this.loading()) return;
    this.messages.update((m) => [...m, { role: 'user', text }]);
    this.input.set('');
    this.pending.set(null);
    this.loading.set(true);

    this.ai.chat(text).subscribe({
      next: (res) => {
        this.loading.set(false);

        if (res.intent === 'create_event' && res.title && res.startTime && res.endTime) {
          this.push(res.reply);
          this.pending.set({ kind: 'create', title: res.title, start: new Date(res.startTime), end: new Date(res.endTime) });
          return;
        }

        if (res.intent === 'search_events') {
          const found = this.findEvents(res.query, res.rangeStart, res.rangeEnd);
          this.push(found.length ? `${res.reply}\n${this.listMsg(found)}` : `${res.reply}\n(Không tìm thấy sự kiện nào.)`);
          return;
        }

        if (res.intent === 'reschedule_event' || res.intent === 'delete_event') {
          const found = this.findEvents(res.query);
          if (found.length === 0) {
            this.push(`Không tìm thấy sự kiện "${res.query ?? ''}".`);
            return;
          }
          if (found.length > 1) {
            this.push(`Có ${found.length} sự kiện khớp:\n${this.listMsg(found)}\nBạn nói rõ hơn (ngày nào?) nhé.`);
            return;
          }
          const e = found[0];
          // Chỉ chủ event mới được dời/xóa
          if (e.creatorEmail && e.creatorEmail.toLowerCase() !== this.supabase.user()?.email?.toLowerCase()) {
            this.push('Bạn chỉ có thể dời/xóa sự kiện của chính mình.');
            return;
          }
          if (res.intent === 'reschedule_event') {
            if (!res.newStartTime) {
              this.push('Bạn muốn dời sang lúc nào?');
              return;
            }
            const start = new Date(res.newStartTime);
            const dur = e.end.getTime() - e.start.getTime();
            const end = res.newEndTime ? new Date(res.newEndTime) : new Date(start.getTime() + dur);
            this.push(res.reply);
            this.pending.set({ kind: 'reschedule', event: e, start, end });
          } else {
            this.push(res.reply);
            this.pending.set({ kind: 'delete', event: e });
          }
          return;
        }

        this.push(res.reply);
      },
      error: () => {
        this.loading.set(false);
        this.push('Có lỗi khi gọi trợ lý. Thử lại nhé.');
      },
    });
  }

  confirm(): void {
    const p = this.pending();
    if (!p) return;
    if (p.kind === 'create') {
      this.state.saveEvent({
        kind: 'event',
        title: p.title,
        description: undefined,
        location: undefined,
        start: p.start,
        end: p.end,
        isAllDay: false,
        guests: [],
        color: 'sky',
      });
      this.push(`Đã tạo "${p.title}" ✅`);
    } else if (p.kind === 'reschedule') {
      this.state.updateEventTimes({ ...p.event, start: p.start, end: p.end });
      this.push(`Đã dời "${p.event.title}" ✅`);
    } else {
      this.state.deleteEvent(p.event.id);
      this.push(`Đã xóa "${p.event.title}" ✅`);
    }
    this.pending.set(null);
  }

  cancel(): void {
    this.pending.set(null);
    this.push('Ok, đã hủy.');
  }

  eventLabel(e: CalendarEvent): string {
    return this.rangeLabel(e.start, e.end);
  }

  rangeLabel(start: Date, end: Date): string {
    const date = start.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
    const t = (x: Date) => x.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${t(start)} – ${t(end)}`;
  }
}
