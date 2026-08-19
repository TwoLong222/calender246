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
interface PlannedSlot {
  start: Date;
  end: Date;
}
interface PlanPreferences {
  startHour: number;
  endHour: number;
  allowedWeekdays?: Set<number>;
}
type Pending =
  | { kind: 'create'; title: string; start: Date; end: Date }
  | { kind: 'plan'; title: string; slots: PlannedSlot[]; requestedCount: number }
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
                @case ('plan') {
                  <p class="mb-1 font-medium text-gray-800">Gợi ý kế hoạch: {{ p.title }}</p>
                  <p class="mb-1 text-xs text-gray-600">Tìm thấy {{ p.slots.length }}/{{ p.requestedCount }} khung giờ trống:</p>
                  @for (slot of p.slots; track slot.start.getTime()) {
                    <p class="text-gray-700">🕐 {{ rangeLabel(slot.start, slot.end) }}</p>
                  }
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

  /** Dự phòng khi AI hiểu câu nhưng trả về thiếu dữ liệu có cấu trúc. */
  private planFromText(text: string): { title: string; count: number; durationMinutes: number } | null {
    const countMatch = text.match(/(?:xếp|sắp xếp|lên kế hoạch)\s+(\d+)\s*(?:buổi|lần|phiên)/i);
    if (!countMatch) return null;

    const durationMatch = text.match(/mỗi\s*(?:buổi|lần|phiên)?\s*(\d+(?:[.,]\d+)?)\s*(tiếng|giờ|phút)/i);
    const durationValue = durationMatch ? Number(durationMatch[1].replace(',', '.')) : 1;
    const durationMinutes = durationMatch?.[2].toLowerCase() === 'phút' ? durationValue : durationValue * 60;
    const title = text
      .replace(/^.*?(?:xếp|sắp xếp|lên kế hoạch)\s+\d+\s*(?:buổi|lần|phiên)\s*/i, '')
      .replace(/(?:,|\s)+(?:mỗi\s*(?:buổi|lần|phiên)?.*|trong\s+tuần.*|tuần\s+(?:này|tới|sau).*|trong\s+tháng.*|tháng\s+này.*)$/i, '')
      .trim();
    return title ? { title, count: Number(countMatch[1]), durationMinutes } : null;
  }

  /** Dùng khung thời gian AI trả về; nếu thiếu thì hiểu các mốc phổ biến trong câu tiếng Việt. */
  private planWindow(text: string, planStart?: string, planEnd?: string): { start?: string; end?: string } {
    if (planStart || planEnd) return { start: planStart, end: planEnd };
    const now = new Date();
    const lower = text.toLowerCase();
    if (lower.includes('tuần này')) {
      const end = new Date(now);
      end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
      end.setHours(21, 0, 0, 0);
      return { start: now.toISOString(), end: end.toISOString() };
    }
    if (lower.includes('tuần tới') || lower.includes('tuần sau')) {
      const start = new Date(now);
      start.setDate(start.getDate() + ((8 - start.getDay()) % 7));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(21, 0, 0, 0);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (lower.includes('tháng này')) {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 21, 0, 0, 0);
      return { start: now.toISOString(), end: end.toISOString() };
    }
    return {};
  }

  /** Kết hợp ràng buộc AI trả về với các cách nói thời gian thông dụng bằng tiếng Việt. */
  private planPreferences(
    text: string,
    aiStartHour?: number,
    aiEndHour?: number,
    aiWeekdays?: number[],
  ): PlanPreferences {
    let startHour = aiStartHour ?? 7;
    let endHour = aiEndHour ?? 21;
    const lower = text.toLowerCase();

    if (lower.includes('buổi sáng')) {
      startHour = Math.max(startHour, 7);
      endHour = Math.min(endHour, 12);
    } else if (lower.includes('buổi chiều')) {
      startHour = Math.max(startHour, 13);
      endHour = Math.min(endHour, 18);
    } else if (lower.includes('buổi tối')) {
      startHour = Math.max(startHour, 18);
      endHour = Math.min(endHour, 21);
    }

    const hourFrom = (match: RegExpMatchArray | null): number | null => {
      if (!match) return null;
      let hour = Number(match[1]);
      if (/(chiều|tối)/.test(match[0]) && hour < 12) hour += 12;
      return hour >= 0 && hour <= 23 ? hour : null;
    };
    const after = hourFrom(lower.match(/sau\s+(\d{1,2})\s*(?:giờ|h)?(?:\s*(?:chiều|tối|sáng))?/));
    const before = hourFrom(lower.match(/trước\s+(\d{1,2})\s*(?:giờ|h)?(?:\s*(?:chiều|tối|sáng))?/));
    if (after !== null) startHour = Math.max(startHour, after);
    if (before !== null) endHour = Math.min(endHour, before);

    let allowedWeekdays = aiWeekdays?.length ? new Set(aiWeekdays.filter((d) => d >= 0 && d <= 6)) : undefined;
    const range = lower.match(/(?:thứ|t)\s*([2-7])\s*(?:đến|-|tới)\s*(?:thứ|t)\s*([2-7])/);
    if (range) {
      allowedWeekdays = new Set<number>();
      for (let d = Number(range[1]) - 1; d <= Number(range[2]) - 1; d++) allowedWeekdays.add(d);
    }
    if (/không\s+(?:xếp\s+)?(?:thứ\s*7|t7).*(?:chủ\s*nhật|cn)|không\s+xếp\s+cuối\s+tuần/.test(lower)) {
      allowedWeekdays ??= new Set([0, 1, 2, 3, 4, 5, 6]);
      allowedWeekdays.delete(6);
      allowedWeekdays.delete(0);
    }
    return { startHour, endHour, allowedWeekdays };
  }

  /** Tìm các khoảng trống 30 phút trong giờ sinh hoạt 07:00–21:00, ưu tiên sớm và không đè lên lịch đã có. */
  private findFreeSlots(
    planStart: string | undefined,
    planEnd: string | undefined,
    count: number,
    durationMinutes: number,
    preferences: PlanPreferences = { startHour: 7, endHour: 21 },
  ): PlannedSlot[] {
    const now = new Date();
    const start = planStart && !Number.isNaN(new Date(planStart).getTime()) ? new Date(planStart) : now;
    const defaultEnd = new Date(start);
    defaultEnd.setDate(defaultEnd.getDate() + 7);
    const end = planEnd && !Number.isNaN(new Date(planEnd).getTime()) ? new Date(planEnd) : defaultEnd;
    if (end <= start) return [];

    const slots: PlannedSlot[] = [];
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    const limit = new Date(end);
    limit.setHours(0, 0, 0, 0);

    while (day <= limit && slots.length < count) {
      if (preferences.allowedWeekdays && !preferences.allowedWeekdays.has(day.getDay())) {
        day.setDate(day.getDate() + 1);
        continue;
      }
      const candidate = new Date(day);
      candidate.setHours(preferences.startHour, 0, 0, 0);
      if (candidate < start) {
        candidate.setTime(start.getTime());
        candidate.setMinutes(Math.ceil(candidate.getMinutes() / 30) * 30, 0, 0);
      }
      const closing = new Date(day);
      closing.setHours(Math.max(preferences.startHour, preferences.endHour), 0, 0, 0);

      while (candidate < closing && slots.length < count) {
        const finish = new Date(candidate.getTime() + durationMinutes * 60_000);
        const collidesWithEvent = this.state.events().some((e) => candidate < e.end && finish > e.start);
        const collidesWithSuggestion = slots.some((s) => candidate < s.end && finish > s.start);
        if (finish <= closing && finish <= end && !collidesWithEvent && !collidesWithSuggestion) {
          slots.push({ start: new Date(candidate), end: finish });
          candidate.setTime(finish.getTime() + 30 * 60_000);
        } else {
          candidate.setMinutes(candidate.getMinutes() + 30);
        }
      }
      day.setDate(day.getDate() + 1);
    }
    return slots;
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

        const fallbackPlan = this.planFromText(text);
        if ((res.intent === 'plan_schedule' && res.title) || fallbackPlan) {
          const title = res.title ?? fallbackPlan!.title;
          const requestedCount = Math.min(Math.max(res.count ?? fallbackPlan!.count, 1), 12);
          const durationMinutes = Math.min(Math.max(res.durationMinutes ?? fallbackPlan!.durationMinutes, 15), 240);
          const window = this.planWindow(text, res.planStart, res.planEnd);
          const preferences = this.planPreferences(text, res.preferredStartHour, res.preferredEndHour, res.allowedWeekdays);
          const slots = this.findFreeSlots(window.start, window.end, requestedCount, durationMinutes, preferences);
          if (slots.length === 0) {
            this.push('Mình chưa tìm được khung giờ trống phù hợp trong khoảng bạn chọn. Bạn thử nới rộng thời gian nhé.');
            return;
          }
          this.push(res.reply || 'Mình đã tìm các khung giờ trống để bạn xem trước.');
          this.pending.set({ kind: 'plan', title, slots, requestedCount });
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
    } else if (p.kind === 'plan') {
      for (const slot of p.slots) {
        this.state.saveEvent({
          kind: 'event',
          title: p.title,
          description: undefined,
          location: undefined,
          start: slot.start,
          end: slot.end,
          isAllDay: false,
          guests: [],
          color: 'emerald',
        });
      }
      this.push(`Đã thêm ${p.slots.length} phiên "${p.title}" vào lịch ✅`);
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
