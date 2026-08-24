// Trang Calendar chính — lắp ráp header, sidebar, khu vực view chính.
//
// CẬP NHẬT SO VỚI BẢN TRƯỚC: thêm banner nhỏ hiển thị lỗi tải dữ liệu (loadError)
// và cảnh báo trùng lịch do SERVER xác nhận sau khi lưu (lastSavedConflicts).

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CalendarStateService } from './calendar-state.service';
import { GroupsStateService } from '../groups/groups-state.service';
import { GroupChatService } from '../groups/chat.service';
import { GroupPanelComponent } from '../groups/group-panel.component';
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
import { InvitationBellComponent } from './invitation-bell.component';
import { ThemeService } from '../theme.service';
import { SeasonalThemeService } from '../theme/seasonal-theme.service';
import { IcsService } from './ics.service';
import { CalendarEvent, EventKind, ViewMode } from './calendar.types';
import { addDays, startOfWeek } from './date-utils';
import { SupabaseService } from '../auth/supabase.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';

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
    GroupPanelComponent,
    InvitationBellComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen flex-col bg-gray-50 text-gray-900">
      @if (state.loadError(); as msg) {
        <div class="flex items-center justify-between bg-red-50 px-4 py-2 text-sm text-red-700">
          <span class="flex items-center gap-2"><app-icon name="alert" />{{ msg }}</span>
          <button type="button" (click)="state.reload()" class="rounded border border-red-300 px-2 py-0.5 hover:bg-red-100">{{ tr.t('nav.retry') }}</button>
        </div>
      }
      @if (state.lastSavedConflicts().length > 0) {
        <div class="flex items-center justify-between bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span class="flex items-center gap-2">
            <app-icon name="alert" />
            {{ tr.t('nav.conflictWarn') }} {{ state.lastSavedConflicts().join(', ') }}
          </span>
          <button type="button" (click)="state.lastSavedConflicts.set([])" class="rounded p-1 hover:bg-amber-100" [attr.aria-label]="tr.t('common.close')"><app-icon name="x" class="h-4 w-4" /></button>
        </div>
      }
      @if (importMsg(); as msg) {
        <div class="flex items-center justify-between bg-gray-50 px-4 py-2 text-sm text-gray-700">
          <span class="flex items-center gap-2"><app-icon name="inbox" />{{ msg }}</span>
          <button type="button" (click)="importMsg.set('')" class="rounded p-1 hover:bg-gray-100" [attr.aria-label]="tr.t('common.close')"><app-icon name="x" class="h-4 w-4" /></button>
        </div>
      }

      <!-- Top bar -->
      <header class="flex items-center gap-4 border-b border-gray-200 px-4 py-2">
        <button
          type="button"
          (click)="sidebarOpen.set(!sidebarOpen())"
          class="tap rounded-full p-1.5 hover:bg-gray-100"
          [attr.aria-label]="tr.t('nav.toggleSidebar')"
          [title]="tr.t('nav.toggleSidebar')"
        >
          <app-icon name="menu" class="h-5 w-5 text-gray-600" />
        </button>
        <span class="flex items-center gap-2 text-lg font-medium text-gray-700">
          <svg viewBox="0 0 32 32" class="h-7 w-7" aria-hidden="true">
            <rect x="9.2" y="3" width="2.6" height="6" rx="1.3" fill="var(--accent-600)"/>
            <rect x="20.2" y="3" width="2.6" height="6" rx="1.3" fill="var(--accent-600)"/>
            <rect x="3.5" y="6.5" width="25" height="22" rx="6" fill="var(--accent-600)"/>
            <rect x="3.5" y="6.5" width="25" height="6.5" rx="6" fill="var(--accent-500)"/>
            <g fill="#fff" opacity=".9">
              <rect x="7" y="16.4" width="3.6" height="3.6" rx="1.1"/>
              <rect x="14.2" y="16.4" width="3.6" height="3.6" rx="1.1"/>
              <rect x="21.4" y="16.4" width="3.6" height="3.6" rx="1.1"/>
              <rect x="7" y="21.8" width="3.6" height="3.6" rx="1.1"/>
              <rect x="21.4" y="21.8" width="3.6" height="3.6" rx="1.1"/>
            </g>
            <rect x="14.2" y="21.8" width="3.6" height="3.6" rx="1.1" fill="#dc2626"/>
          </svg>
          {{ tr.t('nav.calendar') }}
        </span>

        <button
          type="button"
          (click)="state.goToday()"
          class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >{{ tr.t('nav.today') }}</button>

        <div class="flex gap-1">
          <button type="button" (click)="state.goPrev()" class="tap rounded-full p-1.5 hover:bg-gray-100" [attr.aria-label]="tr.t('nav.prev')"><app-icon name="chevron-left" /></button>
          <button type="button" (click)="state.goNext()" class="tap rounded-full p-1.5 hover:bg-gray-100" [attr.aria-label]="tr.t('nav.next')"><app-icon name="chevron-right" /></button>
        </div>

        <h1 class="text-xl text-gray-800">{{ headerLabel() }}</h1>

        @if (seasonal.effectiveSeason(); as season) {
          <span class="hidden items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 sm:inline-flex" [title]="season.when">
            {{ season.emoji }} {{ season.name }}
          </span>
        }

        @if (state.isLoading()) {
          <span class="text-xs text-gray-400">{{ tr.t('nav.loading') }}</span>
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
              [placeholder]="tr.t('nav.search')"
              class="w-56 rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-blue-600"
            />
            @if (searchFocused() && searchQuery().trim()) {
              <div class="popup-in absolute right-0 top-full z-40 mt-1 max-h-80 w-80 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                @if (searchResults().length === 0) {
                  <p class="px-3 py-2 text-sm text-gray-400">{{ tr.t('nav.searchNone') }}</p>
                } @else {
                  @for (e of searchResults(); track e.id) {
                    <button
                      type="button"
                      (click)="goToSearchResult(e)"
                      class="block w-full px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <span class="block truncate text-sm font-medium text-gray-800">{{ e.title || tr.t('common.untitled') }}</span>
                      <span class="block truncate text-xs text-gray-500">{{ resultDateLabel(e) }}</span>
                    </button>
                  }
                }
              </div>
            }
          </div>

          <!-- Chuông thông báo lời mời (Đồng ý/Từ chối ngay trong app) -->
          <app-invitation-bell />

          <button
            type="button"
            (click)="theme.toggle()"
            class="tap rounded-full p-1.5 hover:bg-gray-100"
            [attr.aria-label]="theme.isDark() ? tr.t('nav.lightMode') : tr.t('nav.darkMode')"
            [title]="theme.isDark() ? tr.t('nav.lightMode') : tr.t('nav.darkMode')"
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
              class="tap rounded-full p-1.5 hover:bg-gray-100"
              [title]="tr.t('nav.tools')"
              [attr.aria-label]="tr.t('nav.tools')"
            >
              <app-icon name="dots" class="h-5 w-5 text-gray-600" />
            </button>
            @if (settingsMenuOpen()) {
              <!-- Lớp nền trong suốt: bấm ra ngoài để đóng menu -->
              <div class="fixed inset-0 z-20" (click)="settingsMenuOpen.set(false)"></div>
              <div class="popup-in absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button type="button" (click)="onExport(); settingsMenuOpen.set(false)" class="tap flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="download" class="h-4 w-4 text-gray-600" /> {{ tr.t('nav.export') }}
                </button>
                <button type="button" (click)="fileInput.click()" class="tap flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="upload" class="h-4 w-4 text-gray-600" /> {{ tr.t('nav.import') }}
                </button>
                <div class="my-1 border-t border-gray-200"></div>
                <button type="button" (click)="state.openTrash(); settingsMenuOpen.set(false)" class="tap flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="trash" class="h-4 w-4 text-gray-600" /> {{ tr.t('nav.trash') }}
                </button>
                <a routerLink="/tasks" (click)="settingsMenuOpen.set(false)" class="tap flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="check" class="h-4 w-4 text-gray-600" /> {{ tr.t('nav.tasks') }}
                </a>
                <a routerLink="/am-lich" (click)="settingsMenuOpen.set(false)" class="tap flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="moon" class="h-4 w-4 text-gray-600" /> {{ tr.t('nav.lunar') }}
                </a>
                <a routerLink="/notes" (click)="settingsMenuOpen.set(false)" class="tap flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="notes" class="h-4 w-4 text-gray-600" /> {{ tr.t('nav.notes') }}
                </a>
                <a routerLink="/invitations" (click)="settingsMenuOpen.set(false)" class="tap flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="mail" class="h-4 w-4 text-gray-600" /> {{ tr.t('nav.invitations') }}
                </a>
                <a routerLink="/settings" (click)="settingsMenuOpen.set(false)" class="tap flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                  <app-icon name="settings" class="h-4 w-4 text-gray-600" /> {{ tr.t('nav.settings') }}
                </a>
              </div>
            }
            <input #fileInput type="file" accept=".ics,text/calendar" class="hidden" (change)="onImportFile($event); settingsMenuOpen.set(false)" />
          </div>

          <select
            class="rounded border border-gray-300 px-2 py-1.5 text-sm"
            [value]="state.viewMode()"
            (change)="onViewModeChange($event)"
          >
            <option value="day">{{ tr.t('view.day') }}</option>
            <option value="week">{{ tr.t('view.week') }}</option>
            <option value="month">{{ tr.t('view.month') }}</option>
            <option value="year">{{ tr.t('view.year') }}</option>
          </select>

          @if (supabase.user(); as user) {
            <span class="text-sm text-gray-500">{{ user.email }}</span>
          }
          <button type="button" (click)="logout()" class="tap rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            {{ tr.t('priv.logout') }}
          </button>
        </div>
      </header>

      <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar (trượt mượt khi ẩn/hiện bằng nút 3 gạch ở header) -->
        <aside
          class="sidebar-panel shrink-0 overflow-y-auto border-r border-gray-200"
          [class.sidebar-collapsed]="!sidebarOpen()"
        >
          <div class="relative mb-4">
            <button
              type="button"
              (click)="createMenuOpen.set(!createMenuOpen())"
              class="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium shadow-sm hover:shadow"
            >
              <app-icon name="plus" class="h-5 w-5 text-blue-700" /> {{ tr.t('nav.create') }}
            </button>

            @if (createMenuOpen()) {
              <div class="popup-in absolute left-0 top-full z-30 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button type="button" (click)="openCreate('event')" class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                  {{ tr.t('kind.event') }}
                </button>
                <button type="button" (click)="openCreate('task')" class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                  {{ tr.t('kind.task') }}
                </button>
                <button type="button" (click)="openCreate('appointment')" class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                  {{ tr.t('kind.appointment') }}
                </button>
              </div>
            }
          </div>

          <app-mini-calendar [viewedDate]="state.viewedDate()" (dateSelected)="onMiniCalendarPick($event)" />

          <div class="mt-6">
            <p class="mb-2 text-sm font-medium text-gray-700">{{ tr.t('nav.show') }}</p>
            <ul class="space-y-1 text-sm text-gray-700">
              <li class="flex items-center gap-2">
                <input type="checkbox" [checked]="state.visibleKinds().event" (change)="state.toggleKind('event')" class="accent-sky-600" />
                {{ tr.t('kind.event') }}
              </li>
              <li class="flex items-center gap-2">
                <input type="checkbox" [checked]="state.visibleKinds().task" (change)="state.toggleKind('task')" class="accent-emerald-600" />
                {{ tr.t('kind.task') }}
              </li>
              <li class="flex items-center gap-2">
                <input type="checkbox" [checked]="state.visibleKinds().appointment" (change)="state.toggleKind('appointment')" class="accent-violet-600" />
                {{ tr.t('kind.appointment') }}
              </li>
            </ul>
          </div>

          <!-- Nhóm lên lịch cùng nhau -->
          <div class="mt-6">
            <p class="mb-2 text-sm font-medium text-gray-700">Nhóm</p>

            <ul class="space-y-1 text-sm text-gray-700">
              @for (g of groupsState.groups(); track g.id) {
                <li class="flex items-center gap-2">
                  <input type="checkbox" [checked]="groupsState.isVisible(g.id)" (change)="groupsState.toggleVisible(g.id)" [class]="groupAccent(g.id)" />
                  <button type="button" (click)="groupsState.openPanel(g.id)" class="flex-1 truncate text-left hover:underline">{{ g.name }}</button>
                  @if (groupsState.onlineCount(g.id) > 0) {
                    <span class="shrink-0 text-xs text-emerald-600" title="Đang online">● {{ groupsState.onlineCount(g.id) }}</span>
                  }
                  <button
                    type="button"
                    (click)="groupsState.openPanel(g.id, 'chat')"
                    class="relative shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-blue-700"
                    title="Mở trò chuyện"
                  >
                    💬
                    @if (chat.unreadOf(g.id) > 0) {
                      <span class="absolute -right-1 -top-1 min-w-[1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-medium leading-4 text-white">{{ chat.unreadOf(g.id) }}</span>
                    }
                  </button>
                </li>
              } @empty {
                <li class="text-xs text-gray-400">Chưa có nhóm nào.</li>
              }
            </ul>

            <!-- Tạo nhóm -->
            <div class="mt-2 flex gap-1">
              <input #gname type="text" placeholder="Tên nhóm mới" class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm" (keydown.enter)="createGroup(gname.value); gname.value=''" />
              <button type="button" (click)="createGroup(gname.value); gname.value=''" class="shrink-0 rounded bg-blue-700 px-2 py-1 text-sm text-white hover:bg-blue-800">Tạo</button>
            </div>
            <!-- Tham gia bằng mã -->
            <div class="mt-1 flex gap-1">
              <input #gcode type="text" placeholder="Nhập mã tham gia" class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm" (keydown.enter)="joinGroup(gcode.value); gcode.value=''" />
              <button type="button" (click)="joinGroup(gcode.value); gcode.value=''" class="shrink-0 rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">Vào</button>
            </div>
            @if (groupsState.error(); as err) {
              <p class="mt-1 text-xs text-red-600">{{ err }}</p>
            }
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
                    [events]="mergedEvents()"
                    (slotClicked)="onSlotClicked($event)"
                    (eventClicked)="onEventClicked($event)"
                    (eventTimesChanged)="onEventTimesChanged($event)"
                    (dateSelected)="onDayHeaderClicked($event)"
                  />
                }
                @case ('week') {
                  <app-time-grid-view
                    [dates]="weekDates()"
                    [events]="mergedEvents()"
                    (slotClicked)="onSlotClicked($event)"
                    (eventClicked)="onEventClicked($event)"
                    (eventTimesChanged)="onEventTimesChanged($event)"
                    (dateSelected)="onDayHeaderClicked($event)"
                  />
                }
                @case ('month') {
                  <app-month-view
                    [viewedDate]="state.viewedDate()"
                    [events]="mergedEvents()"
                    (dateClicked)="onMonthDateClicked($event)"
                    (eventClicked)="onEventClicked($event)"
                  />
                }
                @case ('year') {
                  <app-year-view [viewedDate]="state.viewedDate()" [events]="mergedEvents()" (dateClicked)="onYearDateClicked($event)" />
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

    @if (settings.settings().ai_settings.enabled) {
      <app-ai-assistant />
    }
    <app-notification-toasts />

    @if (groupsState.panelGroupId()) {
      <app-group-panel />
    }
    @if (groupsState.flash(); as msg) {
      <div class="popup-in fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
        <span>👥</span> {{ msg }}
      </div>
    }
  `,
})
export class CalendarPageComponent implements OnInit {
  protected readonly state = inject(CalendarStateService);
  protected readonly groupsState = inject(GroupsStateService);
  protected readonly chat = inject(GroupChatService);
  protected readonly supabase = inject(SupabaseService);
  protected readonly theme = inject(ThemeService);
  protected readonly seasonal = inject(SeasonalThemeService);
  protected readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);
  private readonly ics = inject(IcsService);
  private readonly router = inject(Router);
  protected readonly createMenuOpen = signal(false);
  protected readonly sidebarOpen = signal(true);
  protected readonly settingsMenuOpen = signal(false);
  protected readonly importMsg = signal('');

  /** Sự kiện hiển thị trên lịch = sự kiện cá nhân (đã lọc) + sự kiện của các nhóm đang hiện */
  protected readonly mergedEvents = computed<CalendarEvent[]>(() => [
    ...this.state.visibleEvents(),
    ...this.groupsState.visibleGroupEvents(),
  ]);

  ngOnInit(): void {
    // Khởi động tính năng nhóm: đồng bộ lời mời, tải nhóm, kết nối WebSocket.
    this.groupsState.start();
    // Nạp số tin nhắn chưa đọc để hiện badge ở sidebar.
    this.chat.loadUnread();
    // Nếu mở bằng link mời (?join=CODE) -> tự tham gia nhóm rồi dọn URL.
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code) {
      this.groupsState.joinByCode(code);
      history.replaceState(null, '', window.location.pathname);
    }
  }

  /** Tên class màu cho chấm tròn của nhóm ở sidebar */
  groupDot(groupId: string): string {
    const map: Record<string, string> = {
      violet: 'bg-violet-600',
      emerald: 'bg-emerald-600',
      rose: 'bg-rose-600',
      amber: 'bg-amber-600',
      sky: 'bg-sky-600',
    };
    return map[this.groupsState.colorFor(groupId)] ?? 'bg-violet-600';
  }

  /** Màu cho checkbox của nhóm — để đồng bộ với phần "Hiển thị" (checkbox có màu). */
  groupAccent(groupId: string): string {
    const map: Record<string, string> = {
      violet: 'accent-violet-600',
      emerald: 'accent-emerald-600',
      rose: 'accent-rose-600',
      amber: 'accent-amber-600',
      sky: 'accent-sky-600',
    };
    return map[this.groupsState.colorFor(groupId)] ?? 'accent-violet-600';
  }

  createGroup(name: string): void {
    const n = name.trim();
    if (n) this.groupsState.createGroup(n);
  }

  joinGroup(code: string): void {
    const c = code.trim();
    if (c) this.groupsState.joinByCode(c);
  }

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
    const start = startOfWeek(this.state.viewedDate(), this.settings.weekStartsOn());
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    // Ẩn cuối tuần trong view Tuần nếu người dùng tắt "Hiện cuối tuần".
    return this.settings.settings().show_weekends
      ? days
      : days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
  });

  /** Khóa đổi mỗi khi đổi view hoặc đổi ngày đang xem -> kích hoạt lại animation chuyển trang */
  transitionKey = computed(() => `${this.state.viewMode()}:${this.state.viewedDate().getTime()}`);

  headerLabel = computed(() => {
    const d = this.state.viewedDate();
    if (this.state.viewMode() === 'year') return `${d.getFullYear()}`;
    return `${this.tr.monthLong(d.getMonth())}, ${d.getFullYear()}`;
  });

  onViewModeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ViewMode;
    this.state.setViewMode(value);
  }

  onMiniCalendarPick(date: Date): void {
    this.state.selectDate(date, true);
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
    // Sự kiện nhóm -> mở panel nhóm; sự kiện cá nhân -> popover chi tiết như cũ
    if (event.groupId) {
      this.groupsState.openPanel(event.groupId);
    } else {
      this.state.selectEvent(event.id);
    }
  }

  /** Người dùng kéo co giãn 1 sự kiện xong -> lưu giờ mới (optimistic, không giật) */
  onEventTimesChanged(event: CalendarEvent): void {
    if (event.groupId) {
      this.groupsState.updateGroupEventTimes(event);
    } else {
      this.state.updateEventTimes(event);
    }
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
