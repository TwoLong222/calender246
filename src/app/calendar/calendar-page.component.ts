// Trang Calendar chính — lắp ráp header, sidebar, khu vực view chính.
//
// CẬP NHẬT SO VỚI BẢN TRƯỚC: thêm banner nhỏ hiển thị lỗi tải dữ liệu (loadError)
// và cảnh báo trùng lịch do SERVER xác nhận sau khi lưu (lastSavedConflicts).

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CalendarStateService } from './calendar-state.service';
import { MiniCalendarComponent } from './mini-calendar.component';
import { TimeGridViewComponent } from './time-grid-view.component';
import { MonthViewComponent } from './month-view.component';
import { YearViewComponent } from './year-view.component';
import { EventFormModalComponent } from './event-form-modal.component';
import { EventDetailPopoverComponent } from './event-detail-popover.component';
import { TrashModalComponent } from './trash-modal.component';
import { AiAssistantComponent } from '../ai/ai-assistant.component';
import { NotificationToastsComponent } from '../notifications/notification-toasts.component';
import { IconComponent } from '../shared/icon.component';
import { ThemeService } from '../theme.service';
import { IcsService } from './ics.service';
import { CalendarEvent, EventKind, ViewMode } from './calendar.types';
import { MONTH_LABELS, addDays, startOfWeek } from './date-utils';
import { SupabaseService } from '../auth/supabase.service';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    MiniCalendarComponent,
    TimeGridViewComponent,
    MonthViewComponent,
    YearViewComponent,
    EventFormModalComponent,
    EventDetailPopoverComponent,
    TrashModalComponent,
    AiAssistantComponent,
    NotificationToastsComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen flex-col bg-white text-gray-900">
      @if (state.loadError(); as msg) {
        <div class="flex items-center justify-between bg-red-50 px-4 py-2 text-sm text-red-700">
          <span class="flex items-center gap-2"><app-icon name="alert" />{{ msg }}</span>
          <button type="button" (click)="state.reload()" class="rounded border border-red-300 px-2 py-0.5 hover:bg-red-100">
            Thử lại
          </button>
        </div>
      }
      @if (state.lastSavedConflicts().length > 0) {
        <div class="flex items-center justify-between bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span class="flex items-center gap-2">
            <app-icon name="alert" />
            Sự kiện vừa lưu bị trùng lịch với: {{ state.lastSavedConflicts().join(', ') }}
          </span>
          <button type="button" (click)="state.lastSavedConflicts.set([])" class="rounded p-1 hover:bg-amber-100" aria-label="Đóng"><app-icon name="x" class="h-4 w-4" /></button>
        </div>
      }
      @if (importMsg(); as msg) {
        <div class="flex items-center justify-between bg-gray-50 px-4 py-2 text-sm text-gray-700">
          <span class="flex items-center gap-2"><app-icon name="inbox" />{{ msg }}</span>
          <button type="button" (click)="importMsg.set('')" class="rounded p-1 hover:bg-gray-100" aria-label="Đóng"><app-icon name="x" class="h-4 w-4" /></button>
        </div>
      }

      <!-- Top bar -->
      <header class="flex items-center gap-4 border-b border-gray-200 px-4 py-2">
        <span class="flex items-center gap-2 text-lg font-medium text-gray-700">
          <app-icon name="calendar" class="h-6 w-6 text-blue-600" /> Lịch
        </span>

        <button
          type="button"
          (click)="state.goToday()"
          class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Hôm nay
        </button>

        <div class="flex gap-1">
          <button type="button" (click)="state.goPrev()" class="rounded-full p-1.5 hover:bg-gray-100" aria-label="Trước"><app-icon name="chevron-left" /></button>
          <button type="button" (click)="state.goNext()" class="rounded-full p-1.5 hover:bg-gray-100" aria-label="Sau"><app-icon name="chevron-right" /></button>
        </div>

        <h1 class="text-xl text-gray-800">{{ headerLabel() }}</h1>

        @if (state.isLoading()) {
          <span class="text-xs text-gray-400">Đang tải...</span>
        }

        <div class="ml-auto flex items-center gap-3">
          <!-- Ô tìm kiếm sự kiện -->
          <div class="relative">
            <app-icon name="search" class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              (focus)="searchFocused.set(true)"
              (blur)="onSearchBlur()"
              (keydown.escape)="clearSearch()"
              placeholder="Tìm sự kiện..."
              class="w-56 rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-blue-600"
            />
            @if (searchFocused() && searchQuery().trim()) {
              <div class="absolute right-0 top-full z-40 mt-1 max-h-80 w-80 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                @if (searchResults().length === 0) {
                  <p class="px-3 py-2 text-sm text-gray-400">Không tìm thấy sự kiện nào.</p>
                } @else {
                  @for (e of searchResults(); track e.id) {
                    <button
                      type="button"
                      (click)="goToSearchResult(e)"
                      class="block w-full px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <span class="block truncate text-sm font-medium text-gray-800">{{ e.title || '(Không có tiêu đề)' }}</span>
                      <span class="block truncate text-xs text-gray-500">{{ resultDateLabel(e) }}</span>
                    </button>
                  }
                }
              </div>
            }
          </div>

          <button
            type="button"
            (click)="theme.toggle()"
            class="rounded-full p-1.5 hover:bg-gray-100"
            [attr.aria-label]="theme.isDark() ? 'Chế độ sáng' : 'Chế độ tối'"
            [title]="theme.isDark() ? 'Chế độ sáng' : 'Chế độ tối'"
          >
            @if (theme.isDark()) {
              <app-icon name="sun" class="h-5 w-5 text-amber-500" />
            } @else {
              <app-icon name="moon" class="h-5 w-5 text-gray-600" />
            }
          </button>

          <!-- Bánh răng: gom công cụ Xuất/Nhập .ics + Thùng rác -->
          <div class="relative">
            <button
              type="button"
              (click)="settingsMenuOpen.set(!settingsMenuOpen())"
              class="rounded-full p-1.5 hover:bg-gray-100"
              title="Công cụ & cài đặt"
              aria-label="Công cụ & cài đặt"
            >
              <app-icon name="settings" class="h-5 w-5 text-gray-600" />
            </button>
            @if (settingsMenuOpen()) {
              <!-- Lớp nền trong suốt: bấm ra ngoài để đóng menu -->
              <div class="fixed inset-0 z-20" (click)="settingsMenuOpen.set(false)"></div>
              <div class="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button type="button" (click)="onExport(); settingsMenuOpen.set(false)" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="download" class="h-4 w-4 text-gray-600" /> Xuất file .ics
                </button>
                <button type="button" (click)="fileInput.click()" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="upload" class="h-4 w-4 text-gray-600" /> Nhập file .ics
                </button>
                <div class="my-1 border-t border-gray-200"></div>
                <button type="button" (click)="state.openTrash(); settingsMenuOpen.set(false)" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="trash" class="h-4 w-4 text-gray-600" /> Thùng rác
                </button>
              </div>
            }
            <input #fileInput type="file" accept=".ics,text/calendar" class="hidden" (change)="onImportFile($event); settingsMenuOpen.set(false)" />
          </div>

          <select
            class="rounded border border-gray-300 px-2 py-1.5 text-sm"
            [value]="state.viewMode()"
            (change)="onViewModeChange($event)"
          >
            <option value="day">Ngày</option>
            <option value="week">Tuần</option>
            <option value="month">Tháng</option>
            <option value="year">Năm</option>
          </select>

          @if (supabase.user(); as user) {
            <span class="text-sm text-gray-500">{{ user.email }}</span>
          }
          <button type="button" (click)="logout()" class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            Đăng xuất
          </button>
        </div>
      </header>

      <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar -->
        <aside class="w-64 shrink-0 overflow-y-auto border-r border-gray-200 p-4">
          <div class="relative mb-4">
            <button
              type="button"
              (click)="createMenuOpen.set(!createMenuOpen())"
              class="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium shadow-sm hover:shadow"
            >
              <app-icon name="plus" class="h-5 w-5 text-blue-700" /> Tạo
            </button>

            @if (createMenuOpen()) {
              <div class="absolute left-0 top-full z-30 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button type="button" (click)="openCreate('event')" class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                  Sự kiện
                </button>
                <button type="button" (click)="openCreate('task')" class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                  Việc cần làm
                </button>
                <button type="button" (click)="openCreate('appointment')" class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                  Lên lịch hẹn
                </button>
              </div>
            }
          </div>

          <app-mini-calendar [viewedDate]="state.viewedDate()" (dateSelected)="onMiniCalendarPick($event)" />

          <div class="mt-6">
            <p class="mb-2 text-sm font-medium text-gray-700">Hiển thị</p>
            <ul class="space-y-1 text-sm text-gray-700">
              <li class="flex items-center gap-2">
                <input type="checkbox" [checked]="state.visibleKinds().event" (change)="state.toggleKind('event')" class="accent-sky-600" />
                Sự kiện
              </li>
              <li class="flex items-center gap-2">
                <input type="checkbox" [checked]="state.visibleKinds().task" (change)="state.toggleKind('task')" class="accent-emerald-600" />
                Việc cần làm
              </li>
              <li class="flex items-center gap-2">
                <input type="checkbox" [checked]="state.visibleKinds().appointment" (change)="state.toggleKind('appointment')" class="accent-violet-600" />
                Lịch hẹn
              </li>
            </ul>
          </div>

        </aside>

        <!-- Main view -->
        <main class="flex-1 overflow-hidden">
          <!-- Bọc trong @for keyed theo view+ngày: mỗi lần đổi -> DOM tạo lại -> chạy animation .view-fade -->
          @for (key of [transitionKey()]; track key) {
            <div class="view-fade h-full">
              @switch (state.viewMode()) {
                @case ('day') {
                  <app-time-grid-view
                    [dates]="[state.viewedDate()]"
                    [events]="state.visibleEvents()"
                    (slotClicked)="onSlotClicked($event)"
                    (eventClicked)="onEventClicked($event)"
                    (eventTimesChanged)="onEventTimesChanged($event)"
                    (dateSelected)="onDayHeaderClicked($event)"
                  />
                }
                @case ('week') {
                  <app-time-grid-view
                    [dates]="weekDates()"
                    [events]="state.visibleEvents()"
                    (slotClicked)="onSlotClicked($event)"
                    (eventClicked)="onEventClicked($event)"
                    (eventTimesChanged)="onEventTimesChanged($event)"
                    (dateSelected)="onDayHeaderClicked($event)"
                  />
                }
                @case ('month') {
                  <app-month-view
                    [viewedDate]="state.viewedDate()"
                    [events]="state.visibleEvents()"
                    (dateClicked)="onMonthDateClicked($event)"
                    (eventClicked)="onEventClicked($event)"
                  />
                }
                @case ('year') {
                  <app-year-view [viewedDate]="state.viewedDate()" (dateClicked)="onYearDateClicked($event)" />
                }
              }
            </div>
          }
        </main>
      </div>
    </div>

    @if (state.isFormOpen()) {
      <app-event-form-modal />
    }
    @if (state.selectedEventId()) {
      <app-event-detail-popover />
    }
    @if (state.isTrashOpen()) {
      <app-trash-modal />
    }

    <app-ai-assistant />
    <app-notification-toasts />
  `,
})
export class CalendarPageComponent {
  protected readonly state = inject(CalendarStateService);
  protected readonly supabase = inject(SupabaseService);
  protected readonly theme = inject(ThemeService);
  private readonly ics = inject(IcsService);
  private readonly router = inject(Router);
  protected readonly createMenuOpen = signal(false);
  protected readonly settingsMenuOpen = signal(false);
  protected readonly importMsg = signal('');

  onExport(): void {
    this.ics.exportToFile(this.state.events());
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = this.ics.parse(String(reader.result));
        if (imported.length === 0) {
          this.importMsg.set('Không tìm thấy sự kiện nào trong file.');
          return;
        }
        for (const ev of imported) {
          this.state.saveEvent({
            kind: 'event',
            title: ev.title,
            description: ev.description,
            location: ev.location,
            start: ev.start,
            end: ev.end,
            isAllDay: ev.isAllDay,
            guests: [],
            color: 'sky',
          });
        }
        this.importMsg.set(`Đã nhập ${imported.length} sự kiện.`);
      } catch {
        this.importMsg.set('File .ics không hợp lệ.');
      }
      input.value = ''; // cho phép chọn lại cùng file
    };
    reader.readAsText(file);
  }

  // ----- Tìm kiếm sự kiện -----
  protected readonly searchQuery = signal('');
  protected readonly searchFocused = signal(false);

  /** Lọc sự kiện theo tiêu đề / mô tả / địa điểm (không phân biệt hoa thường), gần nhất lên trước */
  protected readonly searchResults = computed<CalendarEvent[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    return this.state
      .events()
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q) ||
          (e.location ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 20);
  });

  onSearchInput(ev: Event): void {
    this.searchQuery.set((ev.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchFocused.set(false);
  }

  /** Đóng dropdown sau khi rời ô input — trễ 1 chút để kịp bắt cú click vào kết quả */
  onSearchBlur(): void {
    setTimeout(() => this.searchFocused.set(false), 150);
  }

  /** Bấm 1 kết quả -> nhảy tới ngày của sự kiện (view Ngày) rồi mở popover chi tiết */
  goToSearchResult(e: CalendarEvent): void {
    this.state.selectDate(e.start, true);
    this.state.selectEvent(e.id);
    this.clearSearch();
  }

  resultDateLabel(e: CalendarEvent): string {
    const date = e.start.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
    if (e.isAllDay) return `${date} · Cả ngày`;
    const time = e.start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  }

  weekDates = computed(() => {
    const start = startOfWeek(this.state.viewedDate());
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  });

  /** Khóa đổi mỗi khi đổi view hoặc đổi ngày đang xem -> kích hoạt lại animation chuyển trang */
  transitionKey = computed(() => `${this.state.viewMode()}:${this.state.viewedDate().getTime()}`);

  headerLabel = computed(() => {
    const d = this.state.viewedDate();
    if (this.state.viewMode() === 'year') return `${d.getFullYear()}`;
    return `${MONTH_LABELS[d.getMonth()]}, ${d.getFullYear()}`;
  });

  onViewModeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ViewMode;
    this.state.setViewMode(value);
  }

  onMiniCalendarPick(date: Date): void {
    this.state.selectDate(date);
  }

  onMonthDateClicked(date: Date): void {
    this.state.selectDate(date, true);
  }

  /** Bấm ngày ở header lưới giờ -> chuyển sang view Ngày của ngày đó */
  onDayHeaderClicked(date: Date): void {
    this.state.selectDate(date, true);
  }

  onYearDateClicked(date: Date): void {
    this.state.selectDate(date, true);
  }

  onSlotClicked(start: Date): void {
    this.state.openCreateForm('event', start);
  }

  onEventClicked(event: CalendarEvent): void {
    this.state.selectEvent(event.id);
  }

  /** Người dùng kéo co giãn 1 sự kiện xong -> lưu giờ mới (optimistic, không giật) */
  onEventTimesChanged(event: CalendarEvent): void {
    this.state.updateEventTimes(event);
  }

  openCreate(kind: EventKind): void {
    this.createMenuOpen.set(false);
    this.state.openCreateForm(kind, this.state.viewedDate());
  }

  async logout(): Promise<void> {
    await this.supabase.signOut();
    this.router.navigateByUrl('/login');
  }
}
