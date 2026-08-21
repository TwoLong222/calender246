// Trang Cài đặt: sidebar nhóm bên trái + nội dung bên phải, responsive (mobile: tabs trên).
// Mọi thay đổi persist qua SettingsService (optimistic + PATCH). Theme áp dụng ngay.
// Chuỗi hiển thị đi qua TranslateService (vi/en) nên đổi ngôn ngữ là đổi ngay.

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
import { TranslateService } from '../i18n/translate.service';
import { BookingApiService, BookingPage } from '../booking/booking-api.service';
import { SharingApiService, CalendarMember } from '../sharing/sharing-api.service';
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
      <header class="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <a routerLink="/" class="tap flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100" [title]="tr.t('settings.back')">
          <app-icon name="arrow-back" class="h-5 w-5" /> {{ tr.t('settings.back') }}
        </a>
        <h1 class="text-lg font-medium">{{ tr.t('settings.title') }}</h1>
        @if (settings.saving()) { <span class="ml-2 text-xs text-gray-400">{{ tr.t('settings.saving') }}</span> }
        @if (settings.error(); as err) { <span class="ml-2 text-xs text-red-600">{{ err }}</span> }
      </header>

      <div class="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:flex-row">
        <nav class="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 md:w-56 md:flex-col md:overflow-visible md:p-2">
          @for (sec of sections; track sec.id) {
            <button
              type="button"
              (click)="section.set(sec.id)"
              class="tap flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100"
              [class.bg-blue-50]="section() === sec.id"
              [class.text-blue-700]="section() === sec.id"
              [class.font-medium]="section() === sec.id"
            >
              <app-icon [name]="sec.icon" class="h-4 w-4" /> <span class="whitespace-nowrap">{{ tr.t('sec.' + sec.id) }}</span>
            </button>
          }
        </nav>

        <main class="flex-1 space-y-6">
          @switch (section()) {

            @case ('account') {
              <section class="rounded-lg border border-gray-200 bg-white p-5">
                <h2 class="mb-4 text-base font-semibold">{{ tr.t('acc.profile') }}</h2>
                <label class="mb-1 block text-sm text-gray-600">{{ tr.t('acc.displayName') }}</label>
                <div class="mb-4 flex gap-2">
                  <input [(ngModel)]="displayName" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <button type="button" (click)="saveProfile()" class="tap rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">{{ tr.t('acc.save') }}</button>
                </div>
                <label class="mb-1 block text-sm text-gray-600">{{ tr.t('acc.email') }}</label>
                <input [value]="email()" disabled class="mb-4 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
                <p class="text-xs text-gray-400">{{ tr.t('acc.created') }}: {{ createdAt() }}</p>
                @if (profileMsg(); as m) { <p class="mt-2 text-xs text-green-700">{{ m }}</p> }
              </section>

              @if (isEmailUser()) {
                <section class="rounded-lg border border-gray-200 bg-white p-5">
                  <h2 class="mb-4 text-base font-semibold">{{ tr.t('acc.changePw') }}</h2>
                  <input type="password" [(ngModel)]="curPw" [placeholder]="tr.t('acc.curPw')" class="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <input type="password" [(ngModel)]="newPw" [placeholder]="tr.t('acc.newPw')" class="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <input type="password" [(ngModel)]="confirmPw" [placeholder]="tr.t('acc.confirmPw')" class="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <button type="button" (click)="changePassword()" class="tap rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">{{ tr.t('acc.changePw') }}</button>
                  @if (pwMsg(); as m) { <p class="mt-2 text-xs" [class.text-green-700]="pwOk()" [class.text-red-600]="!pwOk()">{{ m }}</p> }
                </section>
              } @else {
                <section class="rounded-lg border border-gray-200 bg-white p-5">
                  <p class="text-sm text-gray-500">{{ tr.t('acc.googleNote') }}</p>
                </section>
              }

              <section class="rounded-lg border border-red-200 bg-red-50 p-5">
                <h2 class="mb-1 text-base font-semibold text-red-700">{{ tr.t('acc.danger') }}</h2>
                <p class="mb-3 text-sm text-red-700">{{ tr.t('acc.deleteWarn') }}</p>
                <button type="button" (click)="confirmDelete.set(true)" class="tap rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">{{ tr.t('acc.deleteBtn') }}</button>
              </section>
            }

            @case ('general') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                <h2 class="text-base font-semibold">{{ tr.t('sec.general') }}</h2>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">{{ tr.t('gen.language') }}</label>
                  <select [ngModel]="s().language" (ngModelChange)="set({ language: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">{{ tr.t('gen.timezone') }}</label>
                  <select [ngModel]="s().timezone" (ngModelChange)="set({ timezone: $event })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    @for (tz of timezones; track tz) { <option [value]="tz">{{ tz }}</option> }
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">{{ tr.t('gen.dateFormat') }}</label>
                  <select [ngModel]="s().date_format" (ngModelChange)="set({ date_format: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                  <p class="mt-1 text-xs text-gray-400">{{ tr.t('common.preview') }}: {{ settings.formatDate(now) }}</p>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">{{ tr.t('gen.timeFormat') }}</label>
                  <select [ngModel]="s().time_format" (ngModelChange)="set({ time_format: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="24h">{{ tr.t('gen.time24') }}</option>
                    <option value="12h">{{ tr.t('gen.time12') }}</option>
                  </select>
                  <p class="mt-1 text-xs text-gray-400">{{ tr.t('common.preview') }}: {{ settings.formatTime(now) }}</p>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">{{ tr.t('gen.startWeek') }}</label>
                  <select [ngModel]="s().start_of_week" (ngModelChange)="set({ start_of_week: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option [ngValue]="1">{{ tr.t('gen.monday') }}</option>
                    <option [ngValue]="0">{{ tr.t('gen.sunday') }}</option>
                  </select>
                </div>
              </section>
            }

            @case ('calendar') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                <h2 class="text-base font-semibold">{{ tr.t('sec.calendar') }}</h2>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">{{ tr.t('cal.defaultView') }}</label>
                  <select [ngModel]="s().default_calendar_view" (ngModelChange)="set({ default_calendar_view: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="day">{{ tr.t('view.day') }}</option>
                    <option value="week">{{ tr.t('view.week') }}</option>
                    <option value="month">{{ tr.t('view.month') }}</option>
                    <option value="year">{{ tr.t('view.year') }}</option>
                  </select>
                </div>
                <div>
                  <label class="mb-2 block text-sm text-gray-600">{{ tr.t('cal.workingDays') }}</label>
                  <div class="flex flex-wrap gap-2">
                    @for (d of weekdays; track d) {
                      <label class="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-sm">
                        <input type="checkbox" [checked]="s().working_days.includes(d)" (change)="toggleWorkingDay(d)" class="accent-blue-600" /> {{ tr.t('wd.' + d) }}
                      </label>
                    }
                  </div>
                </div>
                <div class="flex gap-3">
                  <div class="flex-1">
                    <label class="mb-1 block text-sm text-gray-600">{{ tr.t('cal.workStart') }}</label>
                    <input type="time" [ngModel]="s().working_start" (ngModelChange)="set({ working_start: $event })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div class="flex-1">
                    <label class="mb-1 block text-sm text-gray-600">{{ tr.t('cal.workEnd') }}</label>
                    <input type="time" [ngModel]="s().working_end" (ngModelChange)="set({ working_end: $event })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">{{ tr.t('cal.slot') }}</label>
                  <select [ngModel]="s().time_slot_duration" (ngModelChange)="set({ time_slot_duration: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option [ngValue]="15">15 {{ tr.t('cal.min') }}</option>
                    <option [ngValue]="30">30 {{ tr.t('cal.min') }}</option>
                    <option [ngValue]="60">60 {{ tr.t('cal.min') }}</option>
                  </select>
                </div>
                <div class="space-y-2 border-t border-gray-200 pt-3">
                  <p class="text-sm font-medium text-gray-600">{{ tr.t('cal.display') }}</p>
                  <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="s().show_weekends" (change)="set({ show_weekends: !s().show_weekends })" class="accent-blue-600" /> {{ tr.t('cal.showWeekends') }}</label>
                  <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="s().show_declined_events" (change)="set({ show_declined_events: !s().show_declined_events })" class="accent-blue-600" /> {{ tr.t('cal.showDeclined') }}</label>
                  <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="s().show_completed_tasks" (change)="set({ show_completed_tasks: !s().show_completed_tasks })" class="accent-blue-600" /> {{ tr.t('cal.showCompleted') }}</label>
                  <label class="flex items-center gap-2 text-sm"><input type="checkbox" [checked]="s().show_current_time" (change)="set({ show_current_time: !s().show_current_time })" class="accent-blue-600" /> {{ tr.t('cal.showCurrentTime') }}</label>
                </div>
              </section>
            }

            @case ('notifications') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                <h2 class="text-base font-semibold">{{ tr.t('sec.notifications') }}</h2>
                <label class="flex items-center justify-between text-sm">
                  <span>{{ tr.t('notif.browser') }}</span>
                  <input type="checkbox" [checked]="s().browser_notifications" (change)="toggleBrowserNotif()" class="accent-blue-600" />
                </label>
                @if (notifMsg(); as m) { <p class="text-xs text-gray-400">{{ m }}</p> }
                <div>
                  <label class="mb-1 block text-sm text-gray-600">{{ tr.t('notif.defaultReminder') }}</label>
                  <select [ngModel]="reminderValue()" (ngModelChange)="setReminder($event)" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="none">{{ tr.t('notif.none') }}</option>
                    <option value="5">5 {{ tr.t('notif.min') }}</option>
                    <option value="10">10 {{ tr.t('notif.min') }}</option>
                    <option value="15">15 {{ tr.t('notif.min') }}</option>
                    <option value="30">30 {{ tr.t('notif.min') }}</option>
                    <option value="60">{{ tr.t('notif.hour') }}</option>
                    <option value="1440">{{ tr.t('notif.day') }}</option>
                  </select>
                  <p class="mt-1 text-xs text-gray-400">{{ tr.t('notif.reminderNote') }}</p>
                </div>
              </section>
            }

            @case ('appearance') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
                <h2 class="text-base font-semibold">{{ tr.t('sec.appearance') }}</h2>
                @for (th of themes; track th) {
                  <label class="flex items-center gap-2 text-sm">
                    <input type="radio" name="theme" [checked]="s().theme === th" (change)="set({ theme: th })" class="accent-blue-600" /> {{ tr.t('theme.' + th) }}
                  </label>
                }
              </section>
            }

            @case ('privacy') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                <h2 class="text-base font-semibold">{{ tr.t('sec.privacy') }}</h2>
                <div>
                  <label class="mb-1 block text-sm text-gray-600">{{ tr.t('priv.eventDefault') }}</label>
                  <select [ngModel]="s().event_default_privacy" (ngModelChange)="set({ event_default_privacy: $any($event) })" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="private">{{ tr.t('priv.private') }}</option>
                    <option value="public">{{ tr.t('priv.public') }}</option>
                  </select>
                </div>
                <div class="space-y-3 border-t border-gray-200 pt-3 text-sm">
                  <label class="flex items-center justify-between">
                    <span class="font-medium">{{ tr.t('booking.enable') }}</span>
                    <input type="checkbox" [checked]="bookingPage()?.enabled" (change)="setBooking({ enabled: !bookingPage()?.enabled })" class="accent-blue-600" />
                  </label>
                  @if (bookingPage()?.enabled) {
                    <div>
                      <label class="mb-1 block text-gray-600">{{ tr.t('booking.duration') }}</label>
                      <select [ngModel]="bookingPage()?.duration_minutes" (ngModelChange)="setBooking({ duration_minutes: +$event })" class="w-full rounded-md border border-gray-300 px-3 py-2">
                        <option [ngValue]="15">15 {{ tr.t('booking.min') }}</option>
                        <option [ngValue]="30">30 {{ tr.t('booking.min') }}</option>
                        <option [ngValue]="60">60 {{ tr.t('booking.min') }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="mb-1 block text-gray-600">{{ tr.t('booking.link') }}</label>
                      <div class="flex gap-2">
                        <input [value]="bookingLink()" readonly class="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600" />
                        <button type="button" (click)="copyBookingLink()" class="tap rounded-md border border-gray-300 px-3 text-sm hover:bg-gray-50">{{ bookingCopied() ? tr.t('booking.copied') : tr.t('booking.copy') }}</button>
                        <a [href]="bookingLink()" target="_blank" class="tap rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">{{ tr.t('booking.open') }}</a>
                      </div>
                    </div>
                  }
                </div>
                <div class="border-t border-gray-200 pt-3 text-sm">
                  <p class="mb-1 font-medium">{{ tr.t('priv.sessions') }}</p>
                  <p class="mb-3 text-xs text-gray-400">{{ tr.t('priv.currentSession') }}</p>
                  <button type="button" (click)="logout()" class="tap rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">{{ tr.t('priv.logout') }}</button>
                  <button type="button" (click)="logoutAll()" class="tap ml-2 rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">{{ tr.t('priv.logoutAll') }}</button>
                </div>

                <!-- Chia sẻ lịch -->
                <div class="border-t border-gray-200 pt-3 text-sm">
                  <p class="mb-1 font-medium">{{ tr.t('share.title') }}</p>
                  <p class="mb-3 text-xs text-gray-400">{{ tr.t('share.desc') }}</p>
                  <div class="flex flex-wrap gap-2">
                    <input type="email" [ngModel]="shareEmail()" (ngModelChange)="shareEmail.set($event)" [placeholder]="tr.t('share.email')" class="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2" />
                    <select [ngModel]="shareRole()" (ngModelChange)="shareRole.set($event)" class="rounded-md border border-gray-300 px-2 py-2">
                      <option value="viewer">{{ tr.t('share.viewer') }}</option>
                      <option value="editor">{{ tr.t('share.editor') }}</option>
                    </select>
                    <button type="button" (click)="addMember()" class="tap rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">{{ tr.t('share.add') }}</button>
                  </div>
                  @if (shareError()) { <p class="mt-1 text-xs text-red-600">{{ shareError() }}</p> }
                  <ul class="mt-3 space-y-1">
                    @for (m of members(); track m.member_email) {
                      <li class="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5">
                        <span class="truncate">{{ m.member_email }} <span class="ml-1 text-xs text-gray-400">· {{ m.role === 'editor' ? tr.t('share.editor') : tr.t('share.viewer') }}</span></span>
                        <button type="button" (click)="removeMember(m.member_email)" class="tap rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" [attr.aria-label]="tr.t('common.close')"><app-icon name="x" class="h-4 w-4" /></button>
                      </li>
                    } @empty {
                      <li class="text-xs text-gray-400">{{ tr.t('share.none') }}</li>
                    }
                  </ul>
                </div>
              </section>
            }

            @case ('email') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
                <h2 class="text-base font-semibold">{{ tr.t('sec.email') }}</h2>
                <p class="text-xs text-gray-400">{{ tr.t('email.note') }}</p>
                @for (key of emailKeys; track key) {
                  <label class="flex items-center justify-between text-sm">
                    <span>{{ tr.t('email.' + key) }}</span>
                    <input type="checkbox" [checked]="s().email_preferences[key]" (change)="toggleEmail(key)" class="accent-blue-600" />
                  </label>
                }
              </section>
            }

            @case ('ai') {
              <section class="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
                <h2 class="text-base font-semibold">{{ tr.t('sec.ai') }}</h2>
                <label class="flex items-center justify-between text-sm font-medium">
                  <span>{{ tr.t('ai.enable') }}</span>
                  <input type="checkbox" [checked]="s().ai_settings.enabled" (change)="toggleAi('enabled')" class="accent-blue-600" />
                </label>
                <div class="space-y-2 border-t border-gray-200 pt-3" [class.opacity-40]="!s().ai_settings.enabled" [class.pointer-events-none]="!s().ai_settings.enabled">
                  <p class="text-sm font-medium text-gray-600">{{ tr.t('ai.permissions') }}</p>
                  <label class="flex items-center justify-between text-sm"><span>{{ tr.t('ai.search') }}</span><input type="checkbox" [checked]="s().ai_settings.allow_search" (change)="toggleAi('allow_search')" class="accent-blue-600" /></label>
                  <label class="flex items-center justify-between text-sm"><span>{{ tr.t('ai.create') }}</span><input type="checkbox" [checked]="s().ai_settings.allow_create" (change)="toggleAi('allow_create')" class="accent-blue-600" /></label>
                  <label class="flex items-center justify-between text-sm"><span>{{ tr.t('ai.update') }}</span><input type="checkbox" [checked]="s().ai_settings.allow_update" (change)="toggleAi('allow_update')" class="accent-blue-600" /></label>
                  <label class="flex items-center justify-between text-sm"><span>{{ tr.t('ai.delete') }}</span><input type="checkbox" [checked]="s().ai_settings.allow_delete" (change)="toggleAi('allow_delete')" class="accent-blue-600" /></label>
                  <p class="text-xs text-gray-400">{{ tr.t('ai.note') }}</p>
                </div>
              </section>
            }
          }
        </main>
      </div>

      @if (confirmDelete()) {
        <div class="modal-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" (click)="confirmDelete.set(false)">
          <div class="modal-card-in w-full max-w-sm rounded-xl bg-white p-5" (click)="$event.stopPropagation()">
            <h3 class="mb-2 text-base font-semibold text-red-700">{{ tr.t('del.title') }}</h3>
            <p class="mb-4 text-sm text-gray-600">{{ tr.t('del.body') }} <b>DELETE</b> {{ tr.t('del.bodyEnd') }}</p>
            <input [(ngModel)]="deleteConfirmText" placeholder="DELETE" class="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <div class="flex justify-end gap-2">
              <button type="button" (click)="confirmDelete.set(false)" class="tap rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">{{ tr.t('del.cancel') }}</button>
              <button type="button" [disabled]="deleteConfirmText() !== 'DELETE' || deleting()" (click)="deleteAccount()" class="tap rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{{ deleting() ? tr.t('del.deleting') : tr.t('del.confirm') }}</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SettingsPageComponent {
  protected readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);
  private readonly supabase = inject(SupabaseService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly bookingApi = inject(BookingApiService);

  protected readonly bookingPage = signal<BookingPage | null>(null);
  protected readonly bookingCopied = signal(false);
  protected bookingLink(): string {
    const p = this.bookingPage();
    return p ? `${window.location.origin}/book/${p.slug}` : '';
  }
  protected setBooking(patch: Partial<BookingPage>): void {
    const prev = this.bookingPage();
    if (prev) this.bookingPage.set({ ...prev, ...patch });
    this.bookingApi.updateMyPage(patch).subscribe({
      next: (p) => this.bookingPage.set(p),
      error: () => { if (prev) this.bookingPage.set(prev); },
    });
  }
  protected copyBookingLink(): void {
    navigator.clipboard?.writeText(this.bookingLink());
    this.bookingCopied.set(true);
    setTimeout(() => this.bookingCopied.set(false), 1500);
  }

  // ---- Chia sẻ lịch ----
  private readonly sharingApi = inject(SharingApiService);
  protected readonly members = signal<CalendarMember[]>([]);
  protected readonly shareEmail = signal('');
  protected readonly shareRole = signal<'viewer' | 'editor'>('viewer');
  protected readonly shareError = signal('');

  private loadMembers(): void {
    this.sharingApi.getMembers().subscribe({ next: (m) => this.members.set(m), error: () => {} });
  }
  protected addMember(): void {
    const email = this.shareEmail().trim();
    if (!email) return;
    this.shareError.set('');
    this.sharingApi.addMember(email, this.shareRole()).subscribe({
      next: () => { this.shareEmail.set(''); this.loadMembers(); },
      error: (e) => this.shareError.set(e?.error?.message ?? 'Chia sẻ thất bại.'),
    });
  }
  protected removeMember(email: string): void {
    this.sharingApi.removeMember(email).subscribe({ next: () => this.loadMembers(), error: () => {} });
  }

  protected readonly section = signal<Section>('general');
  protected readonly now = new Date();
  protected readonly timezones = COMMON_TIMEZONES;

  protected readonly s = this.settings.settings;

  protected readonly sections: { id: Section; icon: IconName }[] = [
    { id: 'account', icon: 'user' },
    { id: 'general', icon: 'world' },
    { id: 'calendar', icon: 'calendar' },
    { id: 'notifications', icon: 'bell' },
    { id: 'appearance', icon: 'palette' },
    { id: 'privacy', icon: 'shield' },
    { id: 'email', icon: 'mail' },
    { id: 'ai', icon: 'robot' },
  ];

  protected readonly themes = ['light', 'dark', 'system'] as const;
  protected readonly weekdays = [1, 2, 3, 4, 5, 6, 0];
  protected readonly emailKeys = [
    'event_invitation', 'event_updated', 'event_cancelled', 'event_reminder',
    'rsvp_update', 'booking_confirmation', 'booking_notification',
  ] as const;

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
    return c ? new Date(c).toLocaleDateString(this.tr.lang() === 'en' ? 'en-GB' : 'vi-VN') : '—';
  });
  protected readonly isEmailUser = computed(
    () => (this.supabase.user()?.app_metadata?.['provider'] ?? 'email') === 'email',
  );

  constructor() {
    if (!this.settings.loaded()) void this.settings.load();
    this.bookingApi.getMyPage().subscribe({
      next: (p) => this.bookingPage.set(p),
      error: () => {},
    });
    this.loadMembers();
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
          this.notifMsg.set(this.tr.t('notif.denied'));
          return;
        }
      } else if (Notification.permission === 'denied') {
        this.notifMsg.set(this.tr.t('notif.blocked'));
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
    this.profileMsg.set(error ? error.message : this.tr.t('acc.nameSaved'));
  }

  protected async changePassword(): Promise<void> {
    if (this.newPw().length < 6) { this.pwOk.set(false); this.pwMsg.set(this.tr.t('acc.pwShort')); return; }
    if (this.newPw() !== this.confirmPw()) { this.pwOk.set(false); this.pwMsg.set(this.tr.t('acc.pwMismatch')); return; }
    const { error: signErr } = await this.supabase.client.auth.signInWithPassword({
      email: this.email(), password: this.curPw(),
    });
    if (signErr) { this.pwOk.set(false); this.pwMsg.set(this.tr.t('acc.pwWrong')); return; }
    const { error } = await this.supabase.updatePassword(this.newPw());
    if (error) { this.pwOk.set(false); this.pwMsg.set(error.message); return; }
    this.pwOk.set(true); this.pwMsg.set(this.tr.t('acc.pwOk'));
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
