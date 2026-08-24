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
import { SupabaseService } from '../auth/supabase.service';

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
    <div class="evm-backdrop modal-backdrop-in" (click)="close()">
      <div class="evm-card modal-card-in" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="evm-header">
          <input
            type="text"
            [(ngModel)]="title"
            [placeholder]="tr.t('form.addTitle')"
            class="evm-title-input"
          />
          <button type="button" (click)="close()" class="evm-close" [attr.aria-label]="tr.t('common.close')">
            <app-icon name="x" class="h-4 w-4" />
          </button>
        </div>

        <!-- Segmented tabs -->
        <div class="evm-tabs" role="tablist">
          @for (t of tabs; track t.key) {
            <button
              type="button"
              role="tab"
              (click)="tab.set(t.key)"
              class="evm-tab"
              [class.is-active]="tab() === t.key"
              [attr.aria-selected]="tab() === t.key"
            >
              {{ tr.t('kind.' + t.key) }}
            </button>
          }
        </div>

        <!-- Body -->
        <div class="evm-body">
          @if (tab() === 'event') {
            <!-- Date/time grid -->
            <div class="evm-date-grid">
              <div class="evm-input-wrap">
                <span class="evm-label">Ngày bắt đầu</span>
                <div class="evm-input-inner">
                  <app-icon name="calendar" class="evm-in-icon" />
                  <input type="date" [(ngModel)]="startDate" class="evm-input" [disabled]="!canEditTime()" />
                </div>
              </div>
              <div class="evm-input-wrap">
                <span class="evm-label">Giờ bắt đầu</span>
                <div class="evm-input-inner">
                  <app-icon name="alarm" class="evm-in-icon" />
                  <input type="time" [(ngModel)]="startTime" class="evm-input" [disabled]="isAllDay() || !canEditTime()" />
                </div>
              </div>
              <div class="evm-input-wrap">
                <span class="evm-label">Ngày kết thúc</span>
                <div class="evm-input-inner">
                  <app-icon name="calendar" class="evm-in-icon" />
                  <input type="date" [(ngModel)]="endDate" class="evm-input" [disabled]="!canEditTime()" />
                </div>
              </div>
              <div class="evm-input-wrap">
                <span class="evm-label">Giờ kết thúc</span>
                <div class="evm-input-inner">
                  <app-icon name="alarm" class="evm-in-icon" />
                  <input type="time" [(ngModel)]="endTime" class="evm-input" [disabled]="isAllDay() || !canEditTime()" />
                </div>
              </div>
            </div>

            @if (!canEditTime()) {
              <p class="text-xs" style="color: var(--text-muted)">🔒 Chỉ người tạo sự kiện mới được đổi giờ bắt đầu/kết thúc.</p>
            }

            <!-- All-day (custom checkbox) -->
            <label class="evm-check">
              <input type="checkbox" [(ngModel)]="isAllDay" />
              <span class="evm-check-box"><app-icon name="check" class="h-3 w-3" /></span>
              <span class="evm-check-label">{{ tr.t('common.allDay') }}</span>
            </label>

            <!-- Repeat (chỉ khi tạo mới) -->
            @if (!editing()) {
              <div class="evm-field-row">
                <span class="evm-field-icon"><app-icon name="repeat" class="h-4 w-4" /></span>
                <div class="flex flex-wrap items-center gap-2">
                  <select [(ngModel)]="repeat" class="evm-select">
                    <option value="none">{{ tr.t('form.noRepeat') }}</option>
                    <option value="daily">{{ tr.t('form.daily') }}</option>
                    <option value="weekly">{{ tr.t('form.weekly') }}</option>
                    <option value="monthly">{{ tr.t('form.monthly') }}</option>
                  </select>
                  @if (repeat() !== 'none') {
                    <span class="text-sm" style="color: var(--text-muted)">×</span>
                    <input type="number" min="2" max="52" [(ngModel)]="repeatCount" class="evm-input-alt evm-input--small" />
                    <span class="text-sm" style="color: var(--text-muted)">{{ tr.t('form.times') }}</span>
                  }
                </div>
              </div>
            }

            @if (conflicts().length > 0) {
              <div class="evm-conflict">
                <p class="flex items-center gap-2"><app-icon name="alert" class="h-4 w-4" /> {{ tr.t('form.conflictA') }} {{ conflicts().length }} {{ tr.t('form.conflictB') }}</p>
                <ul>
                  @for (c of conflicts(); track c.id) {
                    <li>{{ c.title || tr.t('common.untitled') }} — {{ formatRange(c) }}</li>
                  }
                </ul>
              </div>
            }

            <!-- Guests -->
            <div class="evm-field-row evm-field-row--top">
              <span class="evm-field-icon"><app-icon name="user" class="h-4 w-4" /></span>
              <div class="evm-field-body">
                <div class="relative">
                  <div class="flex" style="gap: 8px;">
                    <input
                      type="email"
                      [(ngModel)]="guestEmailDraft"
                      (keydown.enter)="addGuest()"
                      [placeholder]="tr.t('form.addGuest')"
                      class="evm-input-alt flex-1"
                    />
                    <button type="button" (click)="addGuest()" class="btn-secondary">{{ tr.t('form.add') }}</button>
                  </div>
                  @if (guestSuggestions().length > 0) {
                    <div class="popup-in evm-suggest">
                      @for (s of guestSuggestions(); track s) {
                        <button type="button" (click)="pickSuggestion(s)" class="truncate">{{ s }}</button>
                      }
                    </div>
                  }
                </div>
                @if (guests().length > 0) {
                  <ul class="evm-guest-list">
                    @for (g of guests(); track g.email) {
                      <li class="evm-guest-chip">
                        <span>{{ g.email }}</span>
                        <button type="button" (click)="removeGuest(g.email)" class="evm-guest-remove" [attr.aria-label]="tr.t('form.removeGuest')">
                          <app-icon name="x" class="h-3.5 w-3.5" />
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>

            <!-- Location -->
            <div class="evm-field-row">
              <span class="evm-field-icon"><app-icon name="map-pin" class="h-4 w-4" /></span>
              <input
                type="text"
                [(ngModel)]="location"
                [placeholder]="tr.t('form.addLocation')"
                class="evm-input-alt flex-1"
              />
            </div>

            <!-- Description -->
            <div class="evm-field-row evm-field-row--top">
              <span class="evm-field-icon"><app-icon name="notes" class="h-4 w-4" /></span>
              <textarea
                [(ngModel)]="description"
                rows="3"
                [placeholder]="tr.t('form.addDesc')"
                class="evm-textarea"
              ></textarea>
            </div>

            <!-- Color -->
            <div class="evm-field-row">
              <span class="evm-field-icon"><app-icon name="palette" class="h-4 w-4" /></span>
              <div class="evm-colors">
                @for (c of colorOptions; track c.name) {
                  <button
                    type="button"
                    (click)="color.set(c.name)"
                    [title]="tr.t('color.' + c.name)"
                    [attr.aria-label]="tr.t('color.' + c.name)"
                    [attr.aria-pressed]="color() === c.name"
                    [attr.data-color]="c.name"
                    class="evm-color"
                    [class.is-active]="color() === c.name"
                  >
                    @if (color() === c.name) {
                      <app-icon name="check" class="h-3.5 w-3.5" />
                    }
                  </button>
                }
              </div>
            </div>

            <!-- Reminder -->
            <div class="evm-field-row">
              <span class="evm-field-icon"><app-icon name="bell" class="h-4 w-4" /></span>
              <select [ngModel]="reminderStr()" (ngModelChange)="setReminder($event)" class="evm-select">
                <option value="none">{{ tr.t('notif.none') }}</option>
                <option value="5">5 {{ tr.t('notif.min') }}</option>
                <option value="10">10 {{ tr.t('notif.min') }}</option>
                <option value="15">15 {{ tr.t('notif.min') }}</option>
                <option value="30">30 {{ tr.t('notif.min') }}</option>
                <option value="60">{{ tr.t('notif.hour') }}</option>
                <option value="1440">{{ tr.t('notif.day') }}</option>
              </select>
            </div>
          }

          <!-- Tab: Việc cần làm -->
          @if (tab() === 'task') {
            <div class="evm-date-grid">
              <div class="evm-input-wrap">
                <span class="evm-label">Hạn ngày</span>
                <div class="evm-input-inner">
                  <app-icon name="calendar" class="evm-in-icon" />
                  <input type="date" [(ngModel)]="startDate" class="evm-input" />
                </div>
              </div>
              <div class="evm-input-wrap">
                <span class="evm-label">Hạn giờ</span>
                <div class="evm-input-inner">
                  <app-icon name="alarm" class="evm-in-icon" />
                  <input type="time" [(ngModel)]="startTime" class="evm-input" />
                </div>
              </div>
            </div>
            <div class="evm-field-row evm-field-row--top">
              <span class="evm-field-icon"><app-icon name="notes" class="h-4 w-4" /></span>
              <textarea [(ngModel)]="description" rows="3" [placeholder]="tr.t('form.addDesc')" class="evm-textarea"></textarea>
            </div>
          }

          <!-- Tab: Lên lịch hẹn -->
          @if (tab() === 'appointment') {
            <div class="evm-note-panel">
              <p>{{ tr.t('form.apptDesc') }}</p>
              <p class="muted">{{ tr.t('form.apptNote') }}</p>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="evm-footer">
          <button type="button" (click)="close()" class="btn-ghost">{{ tr.t('del.cancel') }}</button>
          @if (tab() !== 'appointment') {
            <button type="button" (click)="save()" class="btn-primary">{{ tr.t('form.save') }}</button>
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
  private readonly supabase = inject(SupabaseService);

  /**
   * Chỉ NGƯỜI TẠO mới được đổi giờ bắt đầu/kết thúc. Khi tạo mới -> luôn cho phép.
   * Khi sửa -> so email người tạo với email đang đăng nhập (không xác định được thì cho
   * phép, để backend là nơi quyết định cuối cùng).
   */
  canEditTime = computed(() => {
    if (!this.editing()) return true;
    const creator = this.state.editingEvent()?.creatorEmail;
    const me = this.supabase.user()?.email;
    if (!creator || !me) return true;
    return creator.toLowerCase() === me.toLowerCase();
  });

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
