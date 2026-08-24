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
import { ThemeService } from '../theme.service';
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
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-shell flex h-screen">
      <!-- Sidebar (full-height, trái) -->
      <aside class="app-sidebar" [class.is-collapsed]="!sidebarOpen()">
        <div class="brand-row">
          <span class="brand-mark">
            <app-icon name="calendar" class="h-4 w-4" />
          </span>
          <span class="text-[14px] font-semibold tracking-tight" style="color: var(--text-primary)">
            {{ tr.t('nav.calendar') }}
          </span>
        </div>

        <!-- Nút Tạo -->
        <div class="relative">
          <button type="button" (click)="createMenuOpen.set(!createMenuOpen())" class="btn-create">
            <app-icon name="plus" class="h-4 w-4" />
            <span>{{ tr.t('nav.create') }}</span>
          </button>

          @if (createMenuOpen()) {
            <div class="fixed inset-0 z-20" (click)="createMenuOpen.set(false)"></div>
            <div class="popup-in menu-panel absolute left-0 right-0 top-full z-30 mt-1.5">
              <button type="button" (click)="openCreate('event')" class="menu-item">
                <span class="filter-dot dot-sky"></span> {{ tr.t('kind.event') }}
              </button>
              <button type="button" (click)="openCreate('task')" class="menu-item">
                <span class="filter-dot dot-emerald"></span> {{ tr.t('kind.task') }}
              </button>
              <button type="button" (click)="openCreate('appointment')" class="menu-item">
                <span class="filter-dot dot-violet"></span> {{ tr.t('kind.appointment') }}
              </button>
            </div>
          }
        </div>

        <!-- Mini calendar -->
        <app-mini-calendar [viewedDate]="state.viewedDate()" (dateSelected)="onMiniCalendarPick($event)" />

        <!-- Bộ lọc lịch -->
        <div class="flex flex-col gap-2">
          <p class="section-label">{{ tr.t('nav.show') }}</p>
          <ul class="filter-list">
            <li>
              <button
                type="button"
                (click)="state.toggleKind('event')"
                class="filter-pill"
                [class.is-on]="state.visibleKinds().event"
                [class.is-off]="!state.visibleKinds().event"
                [attr.aria-pressed]="state.visibleKinds().event"
              >
                <span class="filter-dot dot-sky"></span>
                <span>{{ tr.t('kind.event') }}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                (click)="state.toggleKind('task')"
                class="filter-pill"
                [class.is-on]="state.visibleKinds().task"
                [class.is-off]="!state.visibleKinds().task"
                [attr.aria-pressed]="state.visibleKinds().task"
              >
                <span class="filter-dot dot-emerald"></span>
                <span>{{ tr.t('kind.task') }}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                (click)="state.toggleKind('appointment')"
                class="filter-pill"
                [class.is-on]="state.visibleKinds().appointment"
                [class.is-off]="!state.visibleKinds().appointment"
                [attr.aria-pressed]="state.visibleKinds().appointment"
              >
                <span class="filter-dot dot-violet"></span>
                <span>{{ tr.t('kind.appointment') }}</span>
              </button>
            </li>
          </ul>
        </div>

        <!-- Nhóm -->
        <div class="flex flex-col gap-2">
          <p class="section-label">Nhóm</p>
          <ul class="filter-list">
            @for (g of groupsState.groups(); track g.id) {
              <li class="filter-pill is-on">
                <input type="checkbox" [checked]="groupsState.isVisible(g.id)" (change)="groupsState.toggleVisible(g.id)" [class]="groupAccent(g.id)" />
                <span [class]="'h-2 w-2 shrink-0 rounded-full ' + groupDot(g.id)"></span>
                <button type="button" (click)="groupsState.openPanel(g.id)" class="flex-1 truncate text-left">{{ g.name }}</button>
                @if (groupsState.onlineCount(g.id) > 0) {
                  <span class="shrink-0 text-[10px]" style="color: var(--text-muted)" title="Đang online">● {{ groupsState.onlineCount(g.id) }}</span>
                }
                <button
                  type="button"
                  (click)="groupsState.openPanel(g.id, 'chat')"
                  class="icon-btn relative shrink-0"
                  style="width: 26px; height: 26px;"
                  title="Mở trò chuyện"
                  aria-label="Mở trò chuyện"
                >
                  <app-icon name="message" class="h-3.5 w-3.5" />
                  @if (chat.unreadOf(g.id) > 0) {
                    <span class="absolute -right-1 -top-1 min-w-[1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-medium leading-4 text-white">{{ chat.unreadOf(g.id) }}</span>
                  }
                </button>
              </li>
            } @empty {
              <li class="px-2 text-xs" style="color: var(--text-muted)">Chưa có nhóm nào.</li>
            }
          </ul>

          <div class="flex gap-1 px-1">
            <input #gname type="text" placeholder="Tên nhóm mới" class="min-w-0 flex-1 rounded-md border px-2 py-1 text-xs" style="border-color: var(--border-subtle); background: var(--surface-sunken); color: var(--text-primary);" (keydown.enter)="createGroup(gname.value); gname.value=''" />
            <button type="button" (click)="createGroup(gname.value); gname.value=''" class="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-white" style="background: var(--accent-strong);">Tạo</button>
          </div>
          <div class="flex gap-1 px-1">
            <input #gcode type="text" placeholder="Nhập mã tham gia" class="min-w-0 flex-1 rounded-md border px-2 py-1 text-xs" style="border-color: var(--border-subtle); background: var(--surface-sunken); color: var(--text-primary);" (keydown.enter)="joinGroup(gcode.value); gcode.value=''" />
            <button type="button" (click)="joinGroup(gcode.value); gcode.value=''" class="icon-btn shrink-0" style="width: auto; padding: 0 10px; font-size: 12px;">Vào</button>
          </div>
          @if (groupsState.error(); as err) {
            <p class="px-1 text-xs text-red-500">{{ err }}</p>
          }
        </div>
      </aside>

      <!-- Cột chính -->
      <div class="flex flex-1 flex-col overflow-hidden">
        @if (state.loadError(); as msg) {
          <div class="alert-bar alert-bar--err">
            <span class="flex items-center gap-2"><app-icon name="alert" class="h-4 w-4" />{{ msg }}</span>
            <button type="button" (click)="state.reload()" class="alert-btn">Thử lại</button>
          </div>
        }
        @if (state.lastSavedConflicts().length > 0) {
          <div class="alert-bar alert-bar--warn">
            <span class="flex items-center gap-2">
              <app-icon name="alert" class="h-4 w-4" />
              Sự kiện vừa lưu bị trùng lịch với: {{ state.lastSavedConflicts().join(', ') }}
            </span>
            <button type="button" (click)="state.lastSavedConflicts.set([])" class="icon-btn" aria-label="Đóng">
              <app-icon name="x" class="h-4 w-4" />
            </button>
          </div>
        }
        @if (importMsg(); as msg) {
          <div class="alert-bar alert-bar--info">
            <span class="flex items-center gap-2"><app-icon name="inbox" class="h-4 w-4" />{{ msg }}</span>
            <button type="button" (click)="importMsg.set('')" class="icon-btn" aria-label="Đóng">
              <app-icon name="x" class="h-4 w-4" />
            </button>
          </div>
        }

        <!-- Top bar -->
        <header class="topbar">
          <div class="topbar-left">
            <button
              type="button"
              (click)="sidebarOpen.set(!sidebarOpen())"
              class="icon-btn"
              aria-label="Ẩn/hiện thanh bên"
              title="Ẩn/hiện thanh bên"
            >
              <app-icon name="menu" class="h-5 w-5" />
            </button>

            <button type="button" (click)="state.goToday()" class="btn-today">
              {{ tr.t('nav.today') }}
            </button>

            <div class="nav-arrows">
              <button type="button" (click)="state.goPrev()" class="icon-btn" aria-label="Trước">
                <app-icon name="chevron-left" class="h-4 w-4" />
              </button>
              <button type="button" (click)="state.goNext()" class="icon-btn" aria-label="Sau">
                <app-icon name="chevron-right" class="h-4 w-4" />
              </button>
            </div>

            <h1 class="page-title">{{ headerLabel() }}</h1>

            @if (state.isLoading()) {
              <span class="loading-hint">{{ tr.t('nav.loading') }}</span>
            }
          </div>

          <div class="topbar-right">
            <!-- Ô tìm kiếm sự kiện -->
            <div class="search-wrap">
              <app-icon name="search" class="search-icon" />
              <input
                type="text"
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
                (focus)="searchFocused.set(true)"
                (blur)="onSearchBlur()"
                (keydown.escape)="clearSearch()"
                [placeholder]="tr.t('nav.search')"
                class="search-input"
              />
              @if (searchFocused() && searchQuery().trim()) {
                <div class="popup-in search-panel">
                  @if (searchResults().length === 0) {
                    <p class="search-empty">Không tìm thấy sự kiện nào.</p>
                  } @else {
                    @for (e of searchResults(); track e.id) {
                      <button type="button" (click)="goToSearchResult(e)" class="search-result">
                        <span class="search-result-title">{{ e.title || '(Không có tiêu đề)' }}</span>
                        <span class="search-result-meta">{{ resultDateLabel(e) }}</span>
                      </button>
                    }
                  }
                </div>
              }
            </div>

            <!-- Segmented view switcher -->
            <div class="segmented" role="tablist" aria-label="Chế độ xem">
              <button type="button" role="tab" class="segment" [class.is-active]="state.viewMode() === 'day'"   (click)="state.setViewMode('day')">{{ tr.t('view.day') }}</button>
              <button type="button" role="tab" class="segment" [class.is-active]="state.viewMode() === 'week'"  (click)="state.setViewMode('week')">{{ tr.t('view.week') }}</button>
              <button type="button" role="tab" class="segment" [class.is-active]="state.viewMode() === 'month'" (click)="state.setViewMode('month')">{{ tr.t('view.month') }}</button>
              <button type="button" role="tab" class="segment" [class.is-active]="state.viewMode() === 'year'"  (click)="state.setViewMode('year')">{{ tr.t('view.year') }}</button>
            </div>

            <button
              type="button"
              (click)="theme.toggle()"
              class="theme-toggle"
              [attr.aria-label]="theme.isDark() ? 'Chuyển sang Light Mode' : 'Chuyển sang Dark Mode'"
              [title]="theme.isDark() ? 'Chuyển sang Light Mode' : 'Chuyển sang Dark Mode'"
              [attr.aria-pressed]="theme.isDark()"
            >
              @if (theme.isDark()) {
                <app-icon name="sun" />
              } @else {
                <app-icon name="moon" />
              }
            </button>

            <!-- Menu công cụ -->
            <div class="relative">
              <button
                type="button"
                (click)="settingsMenuOpen.set(!settingsMenuOpen())"
                class="icon-btn"
                title="Công cụ & cài đặt"
                aria-label="Công cụ & cài đặt"
              >
                <app-icon name="dots" class="h-5 w-5" />
              </button>
              @if (settingsMenuOpen()) {
                <div class="fixed inset-0 z-20" (click)="settingsMenuOpen.set(false)"></div>
                <div class="popup-in menu-panel absolute right-0 top-full z-30 mt-1.5 w-56">
                  <button type="button" (click)="onExport(); settingsMenuOpen.set(false)" class="menu-item">
                    <app-icon name="download" class="h-4 w-4" /> {{ tr.t('nav.export') }}
                  </button>
                  <button type="button" (click)="fileInput.click()" class="menu-item">
                    <app-icon name="upload" class="h-4 w-4" /> {{ tr.t('nav.import') }}
                  </button>
                  <div class="menu-sep"></div>
                  <button type="button" (click)="state.openTrash(); settingsMenuOpen.set(false)" class="menu-item">
                    <app-icon name="trash" class="h-4 w-4" /> {{ tr.t('nav.trash') }}
                  </button>
                  <a routerLink="/settings" (click)="settingsMenuOpen.set(false)" class="menu-item">
                    <app-icon name="settings" class="h-4 w-4" /> {{ tr.t('nav.settings') }}
                  </a>
                </div>
              }
              <input #fileInput type="file" accept=".ics,text/calendar" class="hidden" (change)="onImportFile($event); settingsMenuOpen.set(false)" />
            </div>

            @if (supabase.user(); as user) {
              <div class="relative">
                <button
                  type="button"
                  (click)="userMenuOpen.set(!userMenuOpen())"
                  class="user-avatar-btn"
                  [title]="user.email"
                  [attr.aria-label]="user.email"
                  [attr.aria-expanded]="userMenuOpen()"
                >
                  <span class="user-avatar">{{ (user.email || '?').charAt(0).toUpperCase() }}</span>
                </button>
                @if (userMenuOpen()) {
                  <div class="fixed inset-0 z-20" (click)="userMenuOpen.set(false)"></div>
                  <div class="popup-in user-popover">
                    <div class="user-popover-head">
                      <span class="user-avatar">{{ (user.email || '?').charAt(0).toUpperCase() }}</span>
                      <div class="user-popover-name">
                        <span class="user-popover-label">Đã đăng nhập</span>
                        <span class="user-popover-email">{{ user.email }}</span>
                      </div>
                    </div>
                    <button type="button" (click)="logout(); userMenuOpen.set(false)" class="menu-item">
                      <app-icon name="logout" class="h-4 w-4" /> {{ tr.t('priv.logout') }}
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        </header>

        <!-- Vùng lịch chính -->
        <main class="calendar-area flex-1 overflow-hidden">
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
  protected readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);
  private readonly ics = inject(IcsService);
  private readonly router = inject(Router);
  protected readonly createMenuOpen = signal(false);
  protected readonly sidebarOpen = signal(true);
  protected readonly settingsMenuOpen = signal(false);
  protected readonly userMenuOpen = signal(false);
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
