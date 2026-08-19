// Trang Cài đặt: sidebar nhóm bên trái + nội dung bên phải, responsive (mobile: tabs trên).
// Mọi thay đổi persist qua SettingsService (optimistic + PATCH). Theme áp dụng ngay.
// Dùng bảng màu trung tính (bg-white/gray, text-gray-*) nên tự tương thích dark mode của app.

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { IconComponent, IconName } from '../shared/icon.component';
import { SupabaseService } from '../auth/supabase.service';
import { SettingsService } from './settings.service';
import { COMMON_TIMEZONES } from './settings.types';

type Section =
  | 'account'
  | 'general'
  | 'calendar'
  | 'notifications'
  | 'appearance'
  | 'privacy'
  | 'email'
  | 'ai';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [FormsModule, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 text-gray-800">
      <!-- Header -->
      <header class="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <a routerLink="/" class="tap rounded-full p-1.5 hover:bg-gray-100" title="Quay lại lịch" aria-label="Quay lại lịch">
          <app-icon name="arrow-back" class="h-5 w-5 text-gray-600" />
        </a>
        <app-icon name="settings" class="h-5 w-5 text-blue-600" />
        <h1 class="text-lg font-medium">Cài đặt</h1>
        @if (settings.saving()) { <span class="ml-2 text-xs text-gray-400">Đang lưu…</span> }
        @if (settings.error(); as err) { <span class="ml-2 text-xs text-red-600">{{ err }}</span> }
      </header>

      <div class="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:flex-row">
        <!-- Sidebar / tabs -->
        <nav class="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 md:w-56 md:flex-col md:overflow-visible md:p-2">
          @for (s of sections; track s.id) {
            <button
              type="button"
              (click)="section.set(s.id)"
              class="tap flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100"
              [class.bg-blue-50]="section() === s.id"
              [class.text-blue-700]="section() === s.id"
              [class.font-medium]="section() === s.id"
            >
              <app-icon [name]="s.icon" class="h-4 w-4" /> <span class="whitespace-nowrap">{{ s.label }}</span>
            </button>
          }
        </nav>

        <!-- Nội dung -->
        <main class="flex-1 space-y-6">
          @switch (section()) {

            @case ('account') {
              <section class="rounded-lg border border-gray-200 bg-white p-5">
                <h2 class="mb-4 text-base font-semibold">Hồ sơ</h2>
                <label class="mb-1 block text-sm text-gray-600">Tên hiển thị</label>
                <div class="mb-4 flex gap-2">
                  <input [(ngModel)]="displayName" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <button type="button" (click)="saveProfile()" class="tap rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">Lưu</button>
                </div>
                <label class="mb-1 block text-sm text-gray-600">Email</label>
                <input [value]="email()" disabled class="mb-4 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
                <p class="text-xs text-gray-400">Tạo tài khoản: {{ createdAt() }}</p>
                @if (profileMsg(); as m) { <p class="mt-2 text-xs text-green-700">{{ m }}</p> }
              </section>

              @if (isEmailUser()) {
                <section class="rounded-lg border border-gray-200 bg-white p-5">
                  <h2 class="mb-4 text-base font-semibold">Đổi mật khẩu</h2>
                  <input type="password" [(ngModel)]="curPw" placeholder="Mật khẩu hiện tại" class="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <input type="password" [(ngModel)]="newPw" placeholder="Mật khẩu mới (≥ 6 ký tự)" class="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <input type="password" [(ngModel)]="confirmPw" placeholder="Xác nhận mật khẩu mới" class="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <button type="button" (click)="changePassword()" class="tap rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Đổi mật khẩu</button>
                  @if (pwMsg(); as m) { <p class="mt-2 text-xs" [class.text-green-700]="pwOk()" [class.text-red-600]="!pwOk()">{{ m }}</p> }
                </section>
              } @else {
                <section class="rounded-lg border border-gray-200 bg-white p-5">
                  <p class="text-sm text-gray-500">Bạn đăng nhập bằng Google — mật khẩu được quản lý bởi Google, không đổi tại đây.</p>
                </section>
              }

              <section class="rounded-lg border border-red-200 bg-red-50 p-5">
                <h2 class="mb-1 text-base font-semibold text-red-700">Vùng nguy hiểm</h2>
                <p class="mb-3 text-sm text-red-700">Xoá tài khoản sẽ xoá vĩnh viễn toàn bộ lịch, sự kiện và cài đặt của bạn. Không thể hoàn tác.</p>
                <button type="button" (click)="confirmDelete.set(true)" class="tap rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Xoá tài khoản</button>
              </section>
            }

            @case ('general') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                <h2 class="text-base font-semibold">Chung</h2>
                {{ '' }}
                <div>
                  <label class="mb-1 block text-sm text-gray-600">Ngôn ngữ</label>
                  <select [ngModel]="s().language" (ngModelChange)="set({ language: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">Múi giờ</label>
                  <select [ngModel]="s().timezone" (ngModelChange)="set({ timezone: $event })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    @for (tz of timezones; track tz) { <option [value]="tz">{{ tz }}</option> }
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">Định dạng ngày</label>
                  <select [ngModel]="s().date_format" (ngModelChange)="set({ date_format: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                  <p class="mt-1 text-xs text-gray-400">Xem trước: {{ settings.formatDate(now) }}</p>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">Định dạng giờ</label>
                  <select [ngModel]="s().time_format" (ngModelChange)="set({ time_format: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="24h">24 giờ (15:00)</option>
                    <option value="12h">12 giờ (3:00 PM)</option>
                  </select>
                  <p class="mt-1 text-xs text-gray-400">Xem trước: {{ settings.formatTime(now) }}</p>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">Ngày bắt đầu tuần</label>
                  <select [ngModel]="s().start_of_week" (ngModelChange)="set({ start_of_week: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option [ngValue]="1">Thứ Hai</option>
                    <option [ngValue]="0">Chủ Nhật</option>
                  </select>
                </div>
              </section>
            }

            @case ('calendar') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                <h2 class="text-base font-semibold">Lịch</h2>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">Chế độ xem mặc định</label>
                  <select [ngModel]="s().default_calendar_view" (ngModelChange)="set({ default_calendar_view: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="day">Ngày</option>
                    <option value="week">Tuần</option>
                    <option value="month">Tháng</option>
                    <option value="year">Năm</option>
                  </select>
                </div>
                <div>
                  <label class="mb-2 block text-sm text-gray-600">Ngày làm việc</label>
                  <div class="flex flex-wrap gap-2">
                    @for (d of weekdays; track d.value) {
                      <label class="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-sm">
                        <input type="checkbox" [checked]="s().working_days.includes(d.value)" (change)="toggleWorkingDay(d.value)" class="accent-blue-600" /> {{ d.label }}
                      </label>
                    }
                  </div>
                </div>
                <div class="flex gap-3">
                  <div class="flex-1">
                    <label class="mb-1 block text-sm text-gray-600">Bắt đầu làm việc</label>
                    <input type="time" [ngModel]="s().working_start" (ngModelChange)="set({ working_start: $event })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div class="flex-1">
                    <label class="mb-1 block text-sm text-gray-600">Kết thúc làm việc</label>
                    <input type="time" [ngModel]="s().working_end" (ngModelChange)="set({ working_end: $event })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">Độ dài ô thời gian</label>
                  <select [ngModel]="s().time_slot_duration" (ngModelChange)="set({ time_slot_duration: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option [ngValue]="15">15 phút</option>
                    <option [ngValue]="30">30 phút</option>
                    <option [ngValue]="60">60 phút</option>
                  </select>
                </div>
                <div class="space-y-2 border-t border-gray-200 pt-3">
                  <p class="text-sm font-medium text-gray-600">Hiển thị</p>
                  <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="s().show_weekends" (change)="set({ show_weekends: !s().show_weekends })" class="accent-blue-600" /> Hiện cuối tuần</label>
                  <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="s().show_declined_events" (change)="set({ show_declined_events: !s().show_declined_events })" class="accent-blue-600" /> Hiện sự kiện đã từ chối</label>
                  <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="s().show_completed_tasks" (change)="set({ show_completed_tasks: !s().show_completed_tasks })" class="accent-blue-600" /> Hiện task đã hoàn thành</label>
                  <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="s().show_current_time" (change)="set({ show_current_time: !s().show_current_time })" class="accent-blue-600" /> Hiện vạch thời gian hiện tại</label>
                </div>
              </section>
            }

            @case ('notifications') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                <h2 class="text-base font-semibold">Thông báo</h2>
                <label class="flex items-center justify-between text-sm">
                  <span>Thông báo trình duyệt</span>
                  <input type="checkbox" [checked]="s().browser_notifications" (change)="toggleBrowserNotif()" class="accent-blue-600" />
                </label>
                @if (notifMsg(); as m) { <p class="text-xs text-gray-400">{{ m }}</p> }
                <div>
                  <label class="mb-1 block text-sm text-gray-600">Nhắc mặc định cho sự kiện mới</label>
                  <select [ngModel]="reminderValue()" (ngModelChange)="setReminder($event)" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="none">Không</option>
                    <option value="5">5 phút trước</option>
                    <option value="10">10 phút trước</option>
                    <option value="15">15 phút trước</option>
                    <option value="30">30 phút trước</option>
                    <option value="60">1 giờ trước</option>
                    <option value="1440">1 ngày trước</option>
                  </select>
                  <p class="mt-1 text-xs text-gray-400">Áp dụng khi tạo sự kiện mới; không ghi đè nhắc đã đặt riêng.</p>
                </div>
              </section>
            }

            @case ('appearance') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
                <h2 class="text-base font-semibold">Giao diện</h2>
                @for (t of themes; track t.value) {
                  <label class="flex items-center gap-2 text-sm">
                    <input type="radio" name="theme" [checked]="s().theme === t.value" (change)="set({ theme: t.value })" class="accent-blue-600" /> {{ t.label }}
                  </label>
                }
              </section>
            }

            @case ('privacy') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                <h2 class="text-base font-semibold">Quyền riêng tư & Bảo mật</h2>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">Quyền riêng tư mặc định của sự kiện</label>
                  <select [ngModel]="s().event_default_privacy" (ngModelChange)="set({ event_default_privacy: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="private">Riêng tư</option>
                    <option value="public">Hiển thị trên lịch chia sẻ</option>
                  </select>
                </div>
                <div class="flex items-center justify-between border-t border-gray-200 pt-3 text-sm">
                  <div><p class="font-medium">Đặt lịch công khai (Public Booking)</p><p class="text-xs text-gray-400">Trạng thái: Chưa bật</p></div>
                  <span class="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500">Sắp có</span>
                </div>
                <div class="border-t border-gray-200 pt-3 text-sm">
                  <p class="mb-1 font-medium">Phiên đăng nhập</p>
                  <p class="mb-3 text-xs text-gray-400">Phiên hiện tại trên thiết bị này.</p>
                  <button type="button" (click)="logout()" class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Đăng xuất</button>
                  <button type="button" (click)="logoutAll()" class="ml-2 rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Đăng xuất mọi thiết bị</button>
                </div>
              </section>
            }

            @case ('email') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
                <h2 class="text-base font-semibold">Email</h2>
                <p class="text-xs text-gray-400">Backend kiểm tra các tuỳ chọn này trước khi gửi email.</p>
                @for (p of emailPrefs; track p.key) {
                  <label class="flex items-center justify-between text-sm">
                    <span>{{ p.label }}</span>
                    <input type="checkbox" [checked]="s().email_preferences[p.key]" (change)="toggleEmail(p.key)" class="accent-blue-600" />
                  </label>
                }
              </section>
            }

            @case ('ai') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
                <h2 class="text-base font-semibold">Trợ lý AI</h2>
                <label class="flex items-center justify-between text-sm font-medium">
                  <span>Bật Trợ lý AI</span>
                  <input type="checkbox" [checked]="s().ai_settings.enabled" (change)="toggleAi('enabled')" class="accent-blue-600" />
                </label>
                <div class="space-y-2 border-t border-gray-200 pt-3" [class.opacity-40]="!s().ai_settings.enabled" [class.pointer-events-none]="!s().ai_settings.enabled">
                  <p class="text-sm font-medium text-gray-600">Quyền của AI</p>
                  <label class="flex items-center justify-between text-sm"><span>Tìm kiếm lịch</span><input type="checkbox" [checked]="s().ai_settings.allow_search" (change)="toggleAi('allow_search')" class="accent-blue-600" /></label>
                  <label class="flex items-center justify-between text-sm"><span>Tạo sự kiện</span><input type="checkbox" [checked]="s().ai_settings.allow_create" (change)="toggleAi('allow_create')" class="accent-blue-600" /></label>
                  <label class="flex items-center justify-between text-sm"><span>Cập nhật sự kiện</span><input type="checkbox" [checked]="s().ai_settings.allow_update" (change)="toggleAi('allow_update')" class="accent-blue-600" /></label>
                  <label class="flex items-center justify-between text-sm"><span>Xoá sự kiện</span><input type="checkbox" [checked]="s().ai_settings.allow_delete" (change)="toggleAi('allow_delete')" class="accent-blue-600" /></label>
                  <p class="text-xs text-gray-400">Hành động phá huỷ (xoá, dời lịch lớn) luôn cần xác nhận, bất kể cài đặt.</p>
                </div>
              </section>
            }
          }
        </main>
      </div>

      <!-- Modal xác nhận xoá tài khoản -->
      @if (confirmDelete()) {
        <div class="modal-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" (click)="confirmDelete.set(false)">
          <div class="modal-card-in w-full max-w-sm rounded-xl bg-white p-5" (click)="$event.stopPropagation()">
            <h3 class="mb-2 text-base font-semibold text-red-700">Xoá tài khoản?</h3>
            <p class="mb-4 text-sm text-gray-600">Hành động này xoá vĩnh viễn tài khoản và toàn bộ dữ liệu. Không thể hoàn tác. Gõ <b>DELETE</b> để xác nhận.</p>
            <input [(ngModel)]="deleteConfirmText" placeholder="DELETE" class="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <div class="flex justify-end gap-2">
              <button type="button" (click)="confirmDelete.set(false)" class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Huỷ</button>
              <button type="button" [disabled]="deleteConfirmText() !== 'DELETE' || deleting()" (click)="deleteAccount()" class="tap rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{{ deleting() ? 'Đang xoá…' : 'Xoá vĩnh viễn' }}</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SettingsPageComponent {
  protected readonly settings = inject(SettingsService);
  private readonly supabase = inject(SupabaseService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  protected readonly section = signal<Section>('general');
  protected readonly now = new Date();
  protected readonly timezones = COMMON_TIMEZONES;

  protected readonly s = this.settings.settings;

  protected readonly sections: { id: Section; label: string; icon: IconName }[] = [
    { id: 'account', label: 'Tài khoản', icon: 'user' },
    { id: 'general', label: 'Chung', icon: 'world' },
    { id: 'calendar', label: 'Lịch', icon: 'calendar' },
    { id: 'notifications', label: 'Thông báo', icon: 'bell' },
    { id: 'appearance', label: 'Giao diện', icon: 'palette' },
    { id: 'privacy', label: 'Riêng tư & Bảo mật', icon: 'shield' },
    { id: 'email', label: 'Email', icon: 'mail' },
    { id: 'ai', label: 'Trợ lý AI', icon: 'robot' },
  ];

  protected readonly themes = [
    { value: 'light' as const, label: 'Sáng' },
    { value: 'dark' as const, label: 'Tối' },
    { value: 'system' as const, label: 'Theo hệ thống' },
  ];

  protected readonly weekdays = [
    { value: 1, label: 'T2' }, { value: 2, label: 'T3' }, { value: 3, label: 'T4' },
    { value: 4, label: 'T5' }, { value: 5, label: 'T6' }, { value: 6, label: 'T7' },
    { value: 0, label: 'CN' },
  ];

  protected readonly emailPrefs = [
    { key: 'event_invitation' as const, label: 'Lời mời sự kiện' },
    { key: 'event_updated' as const, label: 'Sự kiện được cập nhật' },
    { key: 'event_cancelled' as const, label: 'Sự kiện bị huỷ' },
    { key: 'event_reminder' as const, label: 'Nhắc lịch' },
    { key: 'rsvp_update' as const, label: 'Cập nhật phản hồi (RSVP)' },
    { key: 'booking_confirmation' as const, label: 'Xác nhận đặt lịch' },
    { key: 'booking_notification' as const, label: 'Thông báo đặt lịch mới' },
  ];

  // Account state
  protected readonly displayName = signal(
    (this.supabase.user()?.user_metadata?.['full_name'] as string) ?? '',
  );
  protected readonly profileMsg = signal('');
  protected readonly curPw = signal('');
  protected readonly newPw = signal('');
  protected readonly confirmPw = signal('');
  protected readonly pwMsg = signal('');
  protected readonly pwOk = signal(false);
  protected readonly notifMsg = signal('');
  protected readonly confirmDelete = signal(false);
  protected readonly deleteConfirmText = signal('');
  protected readonly deleting = signal(false);

  protected readonly email = computed(() => this.supabase.user()?.email ?? '');
  protected readonly createdAt = computed(() => {
    const c = this.supabase.user()?.created_at;
    return c ? new Date(c).toLocaleDateString('vi-VN') : '—';
  });
  protected readonly isEmailUser = computed(
    () => (this.supabase.user()?.app_metadata?.['provider'] ?? 'email') === 'email',
  );

  constructor() {
    if (!this.settings.loaded()) void this.settings.load();
  }

  protected set(patch: Parameters<SettingsService['update']>[0]): void {
    void this.settings.update(patch);
  }

  protected reminderValue(): string {
    const r = this.s().default_reminder;
    return r == null ? 'none' : String(r);
  }
  protected setReminder(v: string): void {
    this.set({ default_reminder: v === 'none' ? null : +v });
  }

  protected toggleWorkingDay(day: number): void {
    const days = new Set(this.s().working_days);
    days.has(day) ? days.delete(day) : days.add(day);
    this.set({ working_days: [...days].sort() });
  }

  protected toggleEmail(key: keyof ReturnType<typeof this.s>['email_preferences']): void {
    this.set({ email_preferences: { [key]: !this.s().email_preferences[key] } as any });
  }

  protected toggleAi(key: keyof ReturnType<typeof this.s>['ai_settings']): void {
    this.set({ ai_settings: { [key]: !this.s().ai_settings[key] } as any });
  }

  protected async toggleBrowserNotif(): Promise<void> {
    const next = !this.s().browser_notifications;
    if (next && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          this.notifMsg.set('Trình duyệt đã từ chối quyền thông báo.');
          return;
        }
      } else if (Notification.permission === 'denied') {
        this.notifMsg.set('Quyền thông báo đang bị chặn — mở cài đặt trình duyệt để bật lại.');
        return;
      }
    }
    this.notifMsg.set('');
    this.set({ browser_notifications: next });
  }

  protected async saveProfile(): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({
      data: { full_name: this.displayName() },
    });
    this.profileMsg.set(error ? 'Lưu thất bại: ' + error.message : 'Đã lưu tên hiển thị.');
  }

  protected async changePassword(): Promise<void> {
    if (this.newPw().length < 6) { this.pwOk.set(false); this.pwMsg.set('Mật khẩu mới cần ≥ 6 ký tự.'); return; }
    if (this.newPw() !== this.confirmPw()) { this.pwOk.set(false); this.pwMsg.set('Xác nhận mật khẩu không khớp.'); return; }
    // Xác minh mật khẩu hiện tại bằng cách đăng nhập lại
    const { error: signErr } = await this.supabase.client.auth.signInWithPassword({
      email: this.email(), password: this.curPw(),
    });
    if (signErr) { this.pwOk.set(false); this.pwMsg.set('Mật khẩu hiện tại không đúng.'); return; }
    const { error } = await this.supabase.updatePassword(this.newPw());
    if (error) { this.pwOk.set(false); this.pwMsg.set('Đổi thất bại: ' + error.message); return; }
    this.pwOk.set(true); this.pwMsg.set('Đổi mật khẩu thành công.');
    this.curPw.set(''); this.newPw.set(''); this.confirmPw.set('');
  }

  protected async deleteAccount(): Promise<void> {
    this.deleting.set(true);
    try {
      await firstValueFrom(this.http.delete(`${environment.apiUrl}/account`));
      await this.supabase.signOut();
      this.settings.reset();
      await this.router.navigate(['/login']);
    } catch {
      this.deleting.set(false);
    }
  }

  protected async logout(): Promise<void> {
    await this.supabase.signOut();
    this.settings.reset();
    await this.router.navigate(['/login']);
  }

  protected async logoutAll(): Promise<void> {
    await this.supabase.client.auth.signOut({ scope: 'global' });
    this.settings.reset();
    await this.router.navigate(['/login']);
  }
}
