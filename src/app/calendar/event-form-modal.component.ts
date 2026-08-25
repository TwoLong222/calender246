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
import { TimePickerComponent } from '../shared/time-picker.component';
import { DateTimePickerComponent } from '../shared/datetime-picker.component';
import { TranslateService } from '../i18n/translate.service';
import { SettingsService } from '../settings/settings.service';
import { AttachmentsApiService } from './attachments-api.service';
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

// ----- Nhắc lịch linh hoạt: đổi qua lại giữa PHÚT (lưu ở DB) và số + đơn vị (hiển thị) -----
type ReminderUnit = 'minute' | 'hour' | 'day' | 'week';
const UNIT_MIN: Record<ReminderUnit, number> = { minute: 1, hour: 60, day: 1440, week: 10080 };
interface ReminderItem {
  value: number;
  unit: ReminderUnit;
}
/** Đổi tổng số PHÚT -> {số, đơn vị} lớn nhất chia hết (vd 120 -> 2 tiếng, 90 -> 90 phút). */
function minutesToItem(min: number): ReminderItem {
  const m = Math.max(0, Math.round(min));
  if (m > 0 && m % UNIT_MIN.week === 0) return { value: m / UNIT_MIN.week, unit: 'week' };
  if (m > 0 && m % UNIT_MIN.day === 0) return { value: m / UNIT_MIN.day, unit: 'day' };
  if (m > 0 && m % UNIT_MIN.hour === 0) return { value: m / UNIT_MIN.hour, unit: 'hour' };
  return { value: m, unit: 'minute' };
}

@Component({
  selector: 'app-event-form-modal',
  standalone: true,
  imports: [FormsModule, IconComponent, TimePickerComponent, DateTimePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop-in fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 pt-10 sm:pt-20" (click)="close()">
      <div class="modal-card-in flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
        <div class="mb-3 flex items-start justify-between gap-4">
          <input
            type="text"
            [(ngModel)]="title"
            maxlength="200"
            [placeholder]="tr.t('form.addTitle')"
            class="min-w-0 flex-1 border-b border-gray-300 pb-1 text-xl outline-none focus:border-blue-600"
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

        <!-- Vùng nội dung CUỘN được (tiêu đề + tabs + nút Lưu/Huỷ vẫn cố định) -->
        <div class="-mx-6 flex-1 overflow-y-auto px-6">

        <!-- Tab: Sự kiện -->
        @if (tab() === 'event') {
          <div class="space-y-4">
            <div class="space-y-2 text-sm">
              <!-- Bắt đầu -->
              <div class="flex flex-wrap items-center gap-2">
                <span class="w-5 text-center">🕐</span>
                <span class="w-16 shrink-0 font-medium text-gray-600">{{ tr.t('form.start') }}</span>
                <input type="date" [(ngModel)]="startDate" class="rounded border border-gray-300 px-2 py-1 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400" [disabled]="!canEditTime()" />
                <app-time-picker [(ngModel)]="startTime" [disabled]="isAllDay() || !canEditTime()" />
              </div>
              <!-- Kết thúc — NGÀY khóa theo ngày bắt đầu (sự kiện gói gọn trong 1 ngày) -->
              <div class="flex flex-wrap items-center gap-2">
                <span class="w-5 text-center"></span>
                <span class="w-16 shrink-0 font-medium text-gray-600">{{ tr.t('form.end') }}</span>
                <input type="date" [ngModel]="startDate()" [disabled]="true" [title]="tr.t('form.sameDayHint')" class="rounded border border-gray-300 px-2 py-1 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400" />
                <app-time-picker [(ngModel)]="endTime" [disabled]="isAllDay() || !canEditTime()" />
              </div>
              <p class="pl-[5.75rem] text-xs text-gray-400">{{ tr.t('form.sameDayHint') }}</p>
            </div>
            @if (!canEditTime()) {
              <p class="pl-7 text-xs text-gray-500">🔒 Chỉ người tạo sự kiện mới được đổi giờ bắt đầu/kết thúc.</p>
            }
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
                  <span>{{ tr.t('form.every') }}</span>
                  <input type="number" min="1" max="30" [(ngModel)]="repeatInterval" class="w-14 rounded border border-gray-300 px-2 py-1" />
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
                      maxlength="254"
                      [placeholder]="tr.t('form.addGuest')"
                      class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
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
                      <li class="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1">
                        <span class="min-w-0 break-all">{{ g.email }}</span>
                        <button type="button" (click)="removeGuest(g.email)" class="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700" [attr.aria-label]="tr.t('form.removeGuest')"><app-icon name="x" class="h-3.5 w-3.5" /></button>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>

            <div class="flex items-center gap-2 text-sm">
              <span class="w-5 text-center">📍</span>
              <input type="text" [(ngModel)]="location" maxlength="200" [placeholder]="tr.t('form.addLocation')" class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1" />
            </div>

            <div class="flex items-start gap-2 text-sm">
              <app-icon name="notes" class="mt-1 h-4 w-4 text-gray-500" />
              <textarea [(ngModel)]="description" rows="3" maxlength="2000" [placeholder]="tr.t('form.addDesc')" class="min-h-[3rem] max-h-48 flex-1 resize-none overflow-y-auto whitespace-pre-wrap break-words rounded border border-gray-300 px-2 py-1 [field-sizing:content]"></textarea>
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

            <!-- Nhắc trước giờ bắt đầu: nhiều mốc (số + đơn vị) + nội dung tùy chỉnh -->
            <div class="space-y-2 text-sm">
              <div class="flex items-center gap-2 text-gray-500">
                <app-icon name="bell" class="h-4 w-4" />
                <span>{{ tr.t('notif.remindersLabel') }}</span>
              </div>
              @for (r of reminders(); track $index) {
                <div class="flex flex-wrap items-center gap-2 pl-6">
                  <input
                    type="number" min="0" max="200" step="1"
                    [ngModel]="r.value" (ngModelChange)="setReminderValue($index, $event)"
                    class="w-20 rounded border border-gray-300 px-2 py-1"
                  />
                  <select [ngModel]="r.unit" (ngModelChange)="setReminderUnit($index, $event)" class="rounded border border-gray-300 px-2 py-1">
                    <option value="minute">{{ tr.t('unit.minute') }}</option>
                    <option value="hour">{{ tr.t('unit.hour') }}</option>
                    <option value="day">{{ tr.t('unit.day') }}</option>
                    <option value="week">{{ tr.t('unit.week') }}</option>
                  </select>
                  <span class="text-gray-500">{{ tr.t('notif.before') }}</span>
                  <button type="button" (click)="removeReminder($index)" class="tap ml-auto rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600" [attr.aria-label]="tr.t('notif.removeReminder')">
                    <app-icon name="x" class="h-3.5 w-3.5" />
                  </button>
                </div>
              }
              @if (reminders().length === 0) {
                <p class="pl-6 text-xs text-gray-400">{{ tr.t('notif.none') }}</p>
              }
              <button type="button" (click)="addReminder()" class="tap ml-6 rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                + {{ tr.t('notif.addReminder') }}
              </button>
              @if (reminders().length > 0) {
                <input
                  type="text" [(ngModel)]="reminderMessage" maxlength="300"
                  [placeholder]="tr.t('notif.messagePlaceholder')"
                  class="ml-6 block w-[calc(100%-1.5rem)] rounded border border-gray-300 px-2 py-1"
                />
              }
            </div>

            <!-- Đính kèm tài liệu ngay lúc tạo (có thể hẹn giờ mở/đóng) -->
            <div class="space-y-2 text-sm">
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-2 text-gray-500"><app-icon name="notes" class="h-4 w-4" /> {{ tr.t('attach.title') }}</span>
                <label class="tap cursor-pointer rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50">
                  {{ tr.t('attach.add') }}
                  <input type="file" class="hidden" (change)="onStageFile($event)" />
                </label>
              </div>
              <div class="grid grid-cols-2 gap-2 rounded bg-gray-50 p-2 text-xs">
                <label class="flex flex-col gap-0.5 text-gray-500">{{ tr.t('attach.from') }}
                  <app-datetime-picker [(ngModel)]="stageFrom" />
                </label>
                <label class="flex flex-col gap-0.5 text-gray-500">{{ tr.t('attach.until') }}
                  <app-datetime-picker [(ngModel)]="stageUntil" />
                </label>
                <p class="col-span-2 text-[11px] text-gray-400">{{ tr.t('attach.scheduleHint') }}</p>
              </div>
              @for (s of stagedFiles(); track $index) {
                <div class="flex items-center gap-2 rounded bg-gray-50 px-2 py-1 text-xs">
                  <span class="min-w-0 flex-1 truncate">📎 {{ s.file.name }}</span>
                  @if (s.from) { <span class="shrink-0 text-amber-600">🔒 {{ s.from }}</span> }
                  <button type="button" (click)="removeStaged($index)" class="tap shrink-0 rounded p-0.5 text-gray-400 hover:text-red-600"><app-icon name="x" class="h-3.5 w-3.5" /></button>
                </div>
              }
            </div>
          </div>
        }

        <!-- Tab: Việc cần làm -->
        @if (tab() === 'task') {
          <div class="space-y-4">
            <div class="flex items-center gap-2 text-sm">
              <app-icon name="target" class="h-4 w-4 text-gray-500" />
              <input type="date" [(ngModel)]="startDate" class="rounded border border-gray-300 px-2 py-1" />
              <app-time-picker [(ngModel)]="startTime" />
            </div>
            <div class="flex items-start gap-2 text-sm">
              <app-icon name="notes" class="mt-1 h-4 w-4 text-gray-500" />
              <textarea [(ngModel)]="description" rows="3" maxlength="2000" [placeholder]="tr.t('form.addDesc')" class="min-h-[3rem] max-h-48 flex-1 resize-none overflow-y-auto whitespace-pre-wrap break-words rounded border border-gray-300 px-2 py-1 [field-sizing:content]"></textarea>
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

        </div>
        <!-- /Vùng cuộn -->

        @if (formError()) {
          <p class="mt-3 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <app-icon name="alert" class="h-4 w-4 shrink-0" /> {{ formError() }}
          </p>
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
  private readonly attachmentsApi = inject(AttachmentsApiService);
  private readonly supabase = inject(SupabaseService);

  // ----- Tài liệu đính kèm ngay lúc tạo (xếp hàng, upload sau khi lưu) -----
  protected readonly stagedFiles = signal<{ file: File; from: string; until: string }[]>([]);
  protected readonly stageFrom = signal('');
  protected readonly stageUntil = signal('');
  protected onStageFile(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.stagedFiles.update((l) => [...l, { file, from: this.stageFrom(), until: this.stageUntil() }]);
    this.stageFrom.set('');
    this.stageUntil.set('');
    input.value = '';
  }
  protected removeStaged(i: number): void {
    this.stagedFiles.update((l) => l.filter((_, idx) => idx !== i));
  }
  /** Upload các file đã xếp hàng vào event vừa tạo. */
  private uploadStaged(eventId: string): void {
    for (const s of this.stagedFiles()) {
      this.attachmentsApi
        .upload(eventId, s.file, {
          availableFrom: s.from ? new Date(s.from).toISOString() : null,
          availableUntil: s.until ? new Date(s.until).toISOString() : null,
        })
        .subscribe({ error: () => {} });
    }
    this.stagedFiles.set([]);
  }

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

  // ----- Nhắc lịch: danh sách mốc (số + đơn vị) + nội dung tùy chỉnh -----
  readonly reminders = signal<ReminderItem[]>([]);
  readonly reminderMessage = signal('');

  addReminder(): void {
    this.reminders.update((l) => [...l, { value: 10, unit: 'minute' }]);
  }
  removeReminder(i: number): void {
    this.reminders.update((l) => l.filter((_, idx) => idx !== i));
  }
  setReminderValue(i: number, v: number | string): void {
    // Chặn [0, 200] và làm tròn số nguyên (bỏ ký tự lạ / số âm).
    const n = Math.min(Math.max(Math.round(Number(v) || 0), 0), 200);
    this.reminders.update((l) => l.map((r, idx) => (idx === i ? { ...r, value: n } : r)));
  }
  setReminderUnit(i: number, u: ReminderUnit): void {
    this.reminders.update((l) => l.map((r, idx) => (idx === i ? { ...r, unit: u } : r)));
  }
  /** Đổi danh sách hiển thị -> mảng PHÚT (khử trùng) để gửi backend. */
  private reminderMinutesList(): number[] {
    const set = new Set<number>();
    for (const r of this.reminders()) {
      const v = Math.min(Math.max(Math.round(r.value || 0), 0), 200);
      set.add(v * UNIT_MIN[r.unit]);
    }
    return [...set].sort((a, b) => a - b);
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
  /** Thông báo lỗi trong form (vd giờ kết thúc trước giờ bắt đầu). */
  protected readonly formError = signal('');
  isAllDay = signal(false);
  location = signal('');
  description = signal('');
  guests = signal<Guest[]>([]);
  guestEmailDraft = signal('');
  color = signal('sky');
  repeat = signal<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  repeatCount = signal(4);
  repeatInterval = signal(1);
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
        // Nhắc: ưu tiên mảng mới; sự kiện CŨ chỉ có reminderMinutes -> chuyển thành 1 mốc.
        const mins =
          editing.reminders && editing.reminders.length
            ? editing.reminders
            : editing.reminderMinutes != null
              ? [editing.reminderMinutes]
              : [];
        this.reminders.set(mins.map(minutesToItem));
        this.reminderMessage.set(editing.reminderMessage ?? '');
      } else {
        const start = this.state.formInitialStart();
        let end = new Date(start.getTime() + 60 * 60_000);
        // Sự kiện gói gọn trong 1 ngày: nếu +1 tiếng tràn sang ngày sau -> kẹp về 23:59 cùng ngày.
        if (end.getDate() !== start.getDate() || end.getMonth() !== start.getMonth() || end.getFullYear() !== start.getFullYear()) {
          end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59);
        }
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
        this.repeatInterval.set(1);
        // Nhắc mặc định lấy từ Cài đặt (default_reminder) khi tạo mới; null = không có mốc nào.
        const def = this.settings.settings().default_reminder;
        this.reminders.set(def != null ? [minutesToItem(def)] : []);
        this.reminderMessage.set('');
      }
      this.guestEmailDraft.set('');
    });
  }

  private computedStart = computed(() => new Date(`${this.startDate()}T${this.startTime() || '00:00'}`));
  // Ngày kết thúc LUÔN bằng ngày bắt đầu — sự kiện gói gọn trong 1 ngày (chỉ chọn GIỜ kết thúc).
  private computedEnd = computed(() => new Date(`${this.startDate()}T${this.endTime() || '00:00'}`));

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
    // Kết thúc cùng NGÀY với bắt đầu (không cho sự kiện kéo dài qua ngày).
    const end = this.isAllDay() ? new Date(`${this.startDate()}T23:59`) : this.computedEnd();

    // Chặn giờ kết thúc TRƯỚC giờ bắt đầu: DB lưu bằng khoảng thời gian nên sẽ lỗi (500).
    // Báo rõ cho người dùng thay vì để "Lưu thất bại" khó hiểu.
    if (!this.isAllDay() && end.getTime() < start.getTime()) {
      this.formError.set(this.tr.t('form.endBeforeStart'));
      return;
    }
    this.formError.set('');

    // Chỉ cho lặp khi TẠO MỚI và có chọn kiểu lặp
    const repeat = this.repeat();
    const recurrence =
      !this.editingId && repeat !== 'none'
        ? {
            repeat,
            count: Math.min(Math.max(this.repeatCount() || 1, 1), 52),
            interval: Math.min(Math.max(this.repeatInterval() || 1, 1), 30),
          }
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
        reminders: this.reminderMinutesList(),
        reminderMessage: this.reminderMessage().trim() || null,
      },
      recurrence,
      // Sau khi lưu xong (có id) -> upload các file đã đính kèm trong form.
      (event) => {
        if (this.stagedFiles().length > 0) this.uploadStaged(event.id);
      },
    );
  }
}
