// Modal tạo mới / chỉnh sửa sự kiện — khớp bố cục 3 tab trong hình 4-6 người dùng gửi:
// "Sự kiện" | "Việc cần làm" | "Lên lịch hẹn".
//
// Cảnh báo trùng lịch: mỗi khi start/end thay đổi ở tab "Sự kiện", tính lại `conflicts`
// dựa trên CalendarStateService.findConflicts(). Đây là cảnh báo MỀM (không chặn lưu),
// đúng hành vi Google Calendar thật.
//
// GIAI ĐOẠN 2: nút "Lưu" sẽ gọi HTTP POST/PATCH tới NestJS thay vì state.saveEvent() cục bộ;
// việc thêm khách theo email sẽ tạo record thật trong bảng event_attendees và trigger
// gửi email mời (xem README-tich-hop-calendar.md).

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarEvent, EventKind, Guest } from './calendar.types';
import { CalendarStateService } from './calendar-state.service';
import { IconComponent } from '../shared/icon.component';
import { TranslateService } from '../i18n/translate.service';
import { SettingsService } from '../settings/settings.service';

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

@Component({
  selector: 'app-event-form-modal',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop-in fixed inset-0 z-40 flex items-start justify-center bg-black/30 pt-20" (click)="close()">
      <div class="modal-card-in w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
        <div class="mb-3 flex items-start justify-between gap-4">
          <input
            type="text"
            [(ngModel)]="title"
            [placeholder]="tr.t('form.addTitle')"
            class="flex-1 border-b border-gray-300 pb-1 text-xl outline-none focus:border-blue-600"
          />
          <button type="button" (click)="close()" class="rounded-full p-1 text-gray-500 hover:bg-gray-100" [attr.aria-label]="tr.t('common.close')"><app-icon name="x" class="h-4 w-4" /></button>
        </div>

        <!-- Tabs: Sự kiện / Việc cần làm / Lên lịch hẹn -->
        <div class="mb-4 flex gap-2">
          @for (t of tabs; track t.key) {
            <button
              type="button"
              (click)="tab.set(t.key)"
              class="rounded-full px-3 py-1 text-sm"
              [class.bg-blue-100]="tab() === t.key"
              [class.text-blue-800]="tab() === t.key"
              [class.text-gray-600]="tab() !== t.key"
            >
              {{ tr.t('kind.' + t.key) }}
            </button>
          }
        </div>

        <!-- Tab: Sự kiện -->
        @if (tab() === 'event') {
          <div class="space-y-4">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="w-5 text-center">🕐</span>
              <input type="date" [(ngModel)]="startDate" class="rounded border border-gray-300 px-2 py-1" />
              <input type="time" [(ngModel)]="startTime" class="rounded border border-gray-300 px-2 py-1" [disabled]="isAllDay()" />
              <span>–</span>
              <input type="date" [(ngModel)]="endDate" class="rounded border border-gray-300 px-2 py-1" />
              <input type="time" [(ngModel)]="endTime" class="rounded border border-gray-300 px-2 py-1" [disabled]="isAllDay()" />
            </div>
            <label class="flex items-center gap-2 pl-7 text-sm text-gray-600">
              <input type="checkbox" [(ngModel)]="isAllDay" />{{ tr.t('common.allDay') }}
            </label>

            <!-- Lặp lại: chỉ cho tạo mới (sửa 1 event trong chuỗi lặp phức tạp -> để sau) -->
            @if (!editing()) {
              <div class="flex flex-wrap items-center gap-2 pl-7 text-sm text-gray-600">
                <span>🔁</span>
                <select [(ngModel)]="repeat" class="rounded border border-gray-300 px-2 py-1">
                  <option value="none">{{ tr.t('form.noRepeat') }}</option>
                  <option value="daily">{{ tr.t('form.daily') }}</option>
                  <option value="weekly">{{ tr.t('form.weekly') }}</option>
                  <option value="monthly">{{ tr.t('form.monthly') }}</option>
                </select>
                @if (repeat() !== 'none') {
                  <span>×</span>
                  <input type="number" min="2" max="52" [(ngModel)]="repeatCount" class="w-16 rounded border border-gray-300 px-2 py-1" />
                  <span>{{ tr.t('form.times') }}</span>
                }
              </div>
            }

            @if (conflicts().length > 0) {
              <div class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p class="flex items-center gap-2"><app-icon name="alert" class="h-4 w-4" /> {{ tr.t('form.conflictA') }} {{ conflicts().length }} {{ tr.t('form.conflictB') }}</p>
                <ul class="mt-1 list-disc pl-5">
                  @for (c of conflicts(); track c.id) {
                    <li>{{ c.title || tr.t('common.untitled') }} — {{ formatRange(c) }}</li>
                  }
                </ul>
              </div>
            }

            <div class="flex items-start gap-2 text-sm">
              <span class="w-5 pt-1.5 text-center">👤</span>
              <div class="flex-1">
                <div class="relative">
                  <div class="flex gap-2">
                    <input
                      type="email"
                      [(ngModel)]="guestEmailDraft"
                      (keydown.enter)="addGuest()"
                      [placeholder]="tr.t('form.addGuest')"
                      class="flex-1 rounded border border-gray-300 px-2 py-1"
                    />
                    <button type="button" (click)="addGuest()" class="rounded bg-gray-100 px-3 py-1 hover:bg-gray-200">{{ tr.t('form.add') }}</button>
                  </div>
                  <!-- Gợi ý các email đã từng mời (autocomplete) -->
                  @if (guestSuggestions().length > 0) {
                    <div class="popup-in absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                      @for (s of guestSuggestions(); track s) {
                        <button
                          type="button"
                          (click)="pickSuggestion(s)"
                          class="block w-full truncate px-3 py-1.5 text-left hover:bg-gray-50"
                        >
                          {{ s }}
                        </button>
                      }
                    </div>
                  }
                </div>
                @if (guests().length > 0) {
                  <ul class="mt-2 space-y-1">
                    @for (g of guests(); track g.email) {
                      <li class="flex items-center justify-between rounded bg-gray-50 px-2 py-1">
                        <span>{{ g.email }}</span>
                        <button type="button" (click)="removeGuest(g.email)" class="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700" [attr.aria-label]="tr.t('form.removeGuest')"><app-icon name="x" class="h-3.5 w-3.5" /></button>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>

            <div class="flex items-center gap-2 text-sm">
              <span class="w-5 text-center">📍</span>
              <input type="text" [(ngModel)]="location" [placeholder]="tr.t('form.addLocation')" class="flex-1 rounded border border-gray-300 px-2 py-1" />
            </div>

            <div class="flex items-start gap-2 text-sm">
              <app-icon name="notes" class="mt-1 h-4 w-4 text-gray-500" />
              <textarea [(ngModel)]="description" rows="3" [placeholder]="tr.t('form.addDesc')" class="min-h-[3rem] flex-1 resize-y rounded border border-gray-300 px-2 py-1"></textarea>
            </div>

            <!-- Chọn màu cho sự kiện -->
            <div class="flex items-center gap-2 text-sm">
              <app-icon name="palette" class="h-4 w-4 text-gray-500" />
              <div class="flex gap-2">
                @for (c of colorOptions; track c.name) {
                  <button
                    type="button"
                    (click)="color.set(c.name)"
                    [title]="tr.t('color.' + c.name)"
                    [attr.aria-label]="tr.t('color.' + c.name)"
                    [class]="c.class + ' h-6 w-6 rounded-full ' + (color() === c.name ? 'ring-2 ring-gray-800 ring-offset-1' : '')"
                  ></button>
                }
              </div>
            </div>

            <!-- Nhắc trước giờ bắt đầu -->
            <div class="flex items-center gap-2 text-sm">
              <app-icon name="bell" class="h-4 w-4 text-gray-500" />
              <select [ngModel]="reminderStr()" (ngModelChange)="setReminder($event)" class="rounded border border-gray-300 px-2 py-1">
                <option value="none">{{ tr.t('notif.none') }}</option>
                <option value="5">5 {{ tr.t('notif.min') }}</option>
                <option value="10">10 {{ tr.t('notif.min') }}</option>
                <option value="15">15 {{ tr.t('notif.min') }}</option>
                <option value="30">30 {{ tr.t('notif.min') }}</option>
                <option value="60">{{ tr.t('notif.hour') }}</option>
                <option value="1440">{{ tr.t('notif.day') }}</option>
              </select>
            </div>
          </div>
        }

        <!-- Tab: Việc cần làm -->
        @if (tab() === 'task') {
          <div class="space-y-4">
            <div class="flex items-center gap-2 text-sm">
              <app-icon name="target" class="h-4 w-4 text-gray-500" />
              <input type="date" [(ngModel)]="startDate" class="rounded border border-gray-300 px-2 py-1" />
              <input type="time" [(ngModel)]="startTime" class="rounded border border-gray-300 px-2 py-1" />
            </div>
            <div class="flex items-start gap-2 text-sm">
              <app-icon name="notes" class="mt-1 h-4 w-4 text-gray-500" />
              <textarea [(ngModel)]="description" rows="3" [placeholder]="tr.t('form.addDesc')" class="min-h-[3rem] flex-1 resize-y rounded border border-gray-300 px-2 py-1"></textarea>
            </div>
          </div>
        }

        <!-- Tab: Lên lịch hẹn (stub — cần trang đặt lịch công khai riêng, để Giai đoạn 2) -->
        @if (tab() === 'appointment') {
          <div class="rounded-md bg-gray-50 p-4 text-sm text-gray-600">
            {{ tr.t('form.apptDesc') }}
            <p class="mt-2 text-xs text-gray-400">
              {{ tr.t('form.apptNote') }}
            </p>
          </div>
        }

        <div class="mt-6 flex justify-end gap-2">
          <button type="button" (click)="close()" class="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">{{ tr.t('del.cancel') }}</button>
          @if (tab() !== 'appointment') {
            <button
              type="button"
              (click)="save()"
              class="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >{{ tr.t('form.save') }}</button>
          }
        </div>
      </div>
    </div>
  `,
})
export class EventFormModalComponent {
  protected readonly state = inject(CalendarStateService);
  protected readonly tr = inject(TranslateService);
  private readonly settings = inject(SettingsService);

  reminderMinutes = signal<number | null>(null);
  reminderStr(): string {
    const r = this.reminderMinutes();
    return r == null ? 'none' : String(r);
  }
  setReminder(v: string): void {
    this.reminderMinutes.set(v === 'none' ? null : +v);
  }

  readonly tabs: { key: EventKind; label: string }[] = [
    { key: 'event', label: 'Sự kiện' },
    { key: 'task', label: 'Việc cần làm' },
    { key: 'appointment', label: 'Lên lịch hẹn' },
  ];

  tab = signal<EventKind>('event');
  title = signal('');
  startDate = signal('');
  startTime = signal('');
  endDate = signal('');
  endTime = signal('');
  isAllDay = signal(false);
  location = signal('');
  description = signal('');
  guests = signal<Guest[]>([]);
  guestEmailDraft = signal('');
  color = signal('sky');
  repeat = signal<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  repeatCount = signal(4);
  /** true khi đang SỬA event có sẵn -> ẩn tùy chọn lặp (chỉ cho lặp khi tạo mới) */
  editing = signal(false);

  readonly colorOptions = [
    { name: 'sky', label: 'Xanh dương', class: 'bg-sky-600' },
    { name: 'violet', label: 'Tím', class: 'bg-violet-600' },
    { name: 'emerald', label: 'Xanh lá', class: 'bg-emerald-600' },
    { name: 'rose', label: 'Hồng', class: 'bg-rose-600' },
    { name: 'amber', label: 'Vàng', class: 'bg-amber-600' },
  ];

  private editingId: string | null = null;

  constructor() {
    // Mỗi khi modal được mở, nạp lại dữ liệu: nếu đang sửa -> điền dữ liệu event cũ,
    // nếu tạo mới -> điền giờ mặc định (giờ được click trên lưới, +1 tiếng cho giờ kết thúc)
    effect(() => {
      if (!this.state.isFormOpen()) return;
      const editing = this.state.editingEvent();
      this.editingId = editing?.id ?? null;
      this.editing.set(!!editing);

      if (editing) {
        this.tab.set(editing.kind);
        this.title.set(editing.title);
        this.startDate.set(toDateInputValue(editing.start));
        this.startTime.set(toTimeInputValue(editing.start));
        this.endDate.set(toDateInputValue(editing.end));
        this.endTime.set(toTimeInputValue(editing.end));
        this.isAllDay.set(editing.isAllDay);
        this.location.set(editing.location ?? '');
        this.description.set(editing.description ?? '');
        this.guests.set(editing.guests);
        this.color.set(editing.color ?? 'sky');
        this.reminderMinutes.set(editing.reminderMinutes ?? null);
      } else {
        const start = this.state.formInitialStart();
        const end = new Date(start.getTime() + 60 * 60_000);
        this.tab.set(this.state.formInitialKind());
        this.title.set('');
        this.startDate.set(toDateInputValue(start));
        this.startTime.set(toTimeInputValue(start));
        this.endDate.set(toDateInputValue(end));
        this.endTime.set(toTimeInputValue(end));
        this.isAllDay.set(false);
        this.location.set('');
        this.description.set('');
        this.guests.set([]);
        this.color.set('sky');
        this.repeat.set('none');
        this.repeatCount.set(4);
        // Nhắc mặc định lấy từ Cài đặt (default_reminder) khi tạo mới.
        this.reminderMinutes.set(this.settings.settings().default_reminder);
      }
      this.guestEmailDraft.set('');
    });
  }

  private computedStart = computed(() => new Date(`${this.startDate()}T${this.startTime() || '00:00'}`));
  private computedEnd = computed(() => new Date(`${this.endDate()}T${this.endTime() || '00:00'}`));

  conflicts = computed<CalendarEvent[]>(() => {
    if (this.tab() !== 'event' || this.isAllDay()) return [];
    const start = this.computedStart();
    const end = this.computedEnd();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    return this.state.findConflicts(start, end, this.editingId ?? undefined);
  });

  formatRange(e: CalendarEvent): string {
    const fmt = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${fmt(e.start)} – ${fmt(e.end)}`;
  }

  /** Gợi ý các email ĐÃ TỪNG mời (gom từ mọi event), khớp với chữ đang gõ, chưa nằm trong danh sách hiện tại */
  guestSuggestions = computed<string[]>(() => {
    const q = this.guestEmailDraft().trim().toLowerCase();
    if (!q) return [];
    const alreadyAdded = new Set(this.guests().map((g) => g.email.toLowerCase()));
    const seen = new Set<string>();
    const result: string[] = [];
    for (const ev of this.state.events()) {
      for (const g of ev.guests) {
        const key = g.email.toLowerCase();
        if (seen.has(key) || alreadyAdded.has(key)) continue;
        if (!key.includes(q)) continue;
        seen.add(key);
        result.push(g.email);
        if (result.length >= 6) return result;
      }
    }
    return result;
  });

  pickSuggestion(email: string): void {
    this.guestEmailDraft.set(email);
    this.addGuest();
  }

  addGuest(): void {
    const email = this.guestEmailDraft().trim();
    if (!email || !email.includes('@')) return;
    if (this.guests().some((g) => g.email.toLowerCase() === email.toLowerCase())) return;
    this.guests.update((list) => [...list, { email, status: 'needsAction' }]);
    this.guestEmailDraft.set('');
  }

  removeGuest(email: string): void {
    this.guests.update((list) => list.filter((g) => g.email !== email));
  }

  close(): void {
    this.state.closeForm();
  }

  save(): void {
    const start = this.isAllDay() ? new Date(`${this.startDate()}T00:00`) : this.computedStart();
    const end = this.isAllDay() ? new Date(`${this.endDate()}T23:59`) : this.computedEnd();

    // Chỉ cho lặp khi TẠO MỚI và có chọn kiểu lặp
    const repeat = this.repeat();
    const recurrence =
      !this.editingId && repeat !== 'none'
        ? { repeat, count: Math.min(Math.max(this.repeatCount() || 1, 1), 52) }
        : undefined;

    this.state.saveEvent(
      {
        id: this.editingId ?? undefined,
        kind: this.tab(),
        title: this.title().trim(),
        description: this.description() || undefined,
        location: this.location() || undefined,
        start,
        end,
        isAllDay: this.isAllDay(),
        guests: this.guests(),
        color: this.color(),
        reminderMinutes: this.reminderMinutes(),
      },
      recurrence,
    );
  }
}
