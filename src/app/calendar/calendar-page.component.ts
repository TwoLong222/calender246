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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen flex-col bg-white text-gray-900">
      @if (state.loadError(); as msg) {
        <div class="flex items-center justify-between bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>⚠️ {{ msg }}</span>
          <button type="button" (click)="state.reload()" class="rounded border border-red-300 px-2 py-0.5 hover:bg-red-100">
            Thử lại
          </button>
        </div>
      }
      @if (state.lastSavedConflicts().length > 0) {
        <div class="flex items-center justify-between bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>
            ⚠️ Sự kiện vừa lưu bị trùng lịch với: {{ state.lastSavedConflicts().join(', ') }}
          </span>
          <button type="button" (click)="state.lastSavedConflicts.set([])" class="rounded px-2 py-0.5 hover:bg-amber-100">✕</button>
        </div>
      }

      <!-- Top bar -->
      <header class="flex items-center gap-4 border-b border-gray-200 px-4 py-2">
        <span class="text-lg font-medium text-gray-700">📅 Lịch</span>

        <button
          type="button"
          (click)="state.goToday()"
          class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Hôm nay
        </button>

        <div class="flex gap-1">
          <button type="button" (click)="state.goPrev()" class="rounded-full p-1.5 hover:bg-gray-100" aria-label="Trước">‹</button>
          <button type="button" (click)="state.goNext()" class="rounded-full p-1.5 hover:bg-gray-100" aria-label="Sau">›</button>
        </div>

        <h1 class="text-xl text-gray-800">{{ headerLabel() }}</h1>

        @if (state.isLoading()) {
          <span class="text-xs text-gray-400">Đang tải...</span>
        }

        <div class="ml-auto flex items-center gap-3">
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
              <span class="text-xl leading-none text-blue-700">+</span> Tạo
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
            <p class="mb-2 text-sm font-medium text-gray-700">Lịch của tôi</p>
            <ul class="space-y-1 text-sm text-gray-700">
              <li class="flex items-center gap-2"><input type="checkbox" checked class="accent-sky-600" /> Của tôi</li>
              <li class="flex items-center gap-2"><input type="checkbox" checked class="accent-violet-600" /> Gia đình</li>
              <li class="flex items-center gap-2"><input type="checkbox" checked class="accent-emerald-600" /> Việc cần làm</li>
            </ul>
          </div>
        </aside>

        <!-- Main view -->
        <main class="flex-1 overflow-hidden">
          @switch (state.viewMode()) {
            @case ('day') {
              <app-time-grid-view
                [dates]="[state.viewedDate()]"
                [events]="state.events()"
                (slotClicked)="onSlotClicked($event)"
                (eventClicked)="onEventClicked($event)"
              />
            }
            @case ('week') {
              <app-time-grid-view
                [dates]="weekDates()"
                [events]="state.events()"
                (slotClicked)="onSlotClicked($event)"
                (eventClicked)="onEventClicked($event)"
              />
            }
            @case ('month') {
              <app-month-view
                [viewedDate]="state.viewedDate()"
                [events]="state.events()"
                (dateClicked)="onMonthDateClicked($event)"
                (eventClicked)="onEventClicked($event)"
              />
            }
            @case ('year') {
              <app-year-view [viewedDate]="state.viewedDate()" (dateClicked)="onYearDateClicked($event)" />
            }
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
  `,
})
export class CalendarPageComponent {
  protected readonly state = inject(CalendarStateService);
  protected readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  protected readonly createMenuOpen = signal(false);

  weekDates = computed(() => {
    const start = startOfWeek(this.state.viewedDate());
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  });

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

  onYearDateClicked(date: Date): void {
    this.state.selectDate(date, true);
  }

  onSlotClicked(start: Date): void {
    this.state.openCreateForm('event', start);
  }

  onEventClicked(event: CalendarEvent): void {
    this.state.selectEvent(event.id);
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
