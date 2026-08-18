// Widget trợ lý AI nổi góc phải màn hình. Người dùng gõ câu tiếng Việt,
// backend (Gemini) phân tích -> hiện PREVIEW -> người dùng bấm Xác nhận thì mới
// tạo event thật (qua CalendarStateService.saveEvent có sẵn -> đúng auth + RLS).

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiApiService } from './ai-api.service';
import { CalendarStateService } from '../calendar/calendar-state.service';

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
}
interface PendingCreate {
  title: string;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!open()) {
      <button
        type="button"
        (click)="open.set(true)"
        class="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-2xl shadow-lg hover:bg-blue-800"
        aria-label="Trợ lý AI"
      >
        🤖
      </button>
    } @else {
      <div class="fixed bottom-6 right-6 z-40 flex h-[460px] w-80 flex-col rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span class="font-medium text-gray-800">🤖 Trợ lý lịch</span>
          <button type="button" (click)="open.set(false)" class="rounded-full p-1 text-gray-400 hover:bg-gray-100">✕</button>
        </div>

        <div class="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          @for (m of messages(); track $index) {
            <div [class]="m.role === 'user'
              ? 'ml-auto max-w-[85%] rounded-lg bg-blue-600 px-3 py-2 text-sm text-white'
              : 'mr-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800'">
              {{ m.text }}
            </div>
          }
          @if (loading()) {
            <div class="mr-auto rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-400">Đang nghĩ…</div>
          }
          @if (pending(); as p) {
            <div class="mr-auto w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
              <p class="mb-1 font-medium text-gray-800">Tạo sự kiện:</p>
              <p class="text-gray-700">📌 {{ p.title }}</p>
              <p class="text-gray-700">🕐 {{ previewTime(p) }}</p>
              <div class="mt-2 flex gap-2">
                <button type="button" (click)="confirmCreate()" class="rounded bg-blue-700 px-3 py-1 text-xs font-medium text-white hover:bg-blue-800">Xác nhận</button>
                <button type="button" (click)="cancelCreate()" class="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">Hủy</button>
              </div>
            </div>
          }
        </div>

        <div class="flex gap-2 border-t border-gray-100 p-3">
          <input
            [(ngModel)]="input"
            (keydown.enter)="send()"
            [disabled]="loading()"
            placeholder='VD: Mai 3h chiều họp nhóm 1 tiếng'
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

  open = signal(false);
  input = signal('');
  loading = signal(false);
  pending = signal<PendingCreate | null>(null);
  messages = signal<ChatMsg[]>([
    { role: 'ai', text: 'Chào bạn! Gõ kiểu "Mai 3h chiều họp nhóm 1 tiếng" để mình tạo sự kiện nhé.' },
  ]);

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
        this.messages.update((m) => [...m, { role: 'ai', text: res.reply }]);
        if (res.intent === 'create_event' && res.title && res.startTime && res.endTime) {
          this.pending.set({ title: res.title, startTime: res.startTime, endTime: res.endTime });
        }
      },
      error: () => {
        this.loading.set(false);
        this.messages.update((m) => [...m, { role: 'ai', text: 'Có lỗi khi gọi trợ lý. Thử lại nhé.' }]);
      },
    });
  }

  confirmCreate(): void {
    const p = this.pending();
    if (!p) return;
    this.state.saveEvent({
      kind: 'event',
      title: p.title,
      description: undefined,
      location: undefined,
      start: new Date(p.startTime),
      end: new Date(p.endTime),
      isAllDay: false,
      guests: [],
      color: 'sky',
    });
    this.pending.set(null);
    this.messages.update((m) => [...m, { role: 'ai', text: `Đã tạo sự kiện "${p.title}" ✅` }]);
  }

  cancelCreate(): void {
    this.pending.set(null);
    this.messages.update((m) => [...m, { role: 'ai', text: 'Ok, đã hủy.' }]);
  }

  previewTime(p: PendingCreate): string {
    const s = new Date(p.startTime);
    const e = new Date(p.endTime);
    const date = s.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
    const t = (x: Date) => x.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${t(s)} – ${t(e)}`;
  }
}
