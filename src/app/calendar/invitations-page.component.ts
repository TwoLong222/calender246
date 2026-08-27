// Trang "Lời mời" — sự kiện được mời mà user CHƯA đồng ý. Bấm Đồng ý để đưa vào
// lịch (và mở được tài liệu); Từ chối để ẩn. Sau phase9, event chưa đồng ý bị RLS
// ẩn khỏi lịch nên đây là nơi khách xử lý lời mời.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CalendarStateService } from './calendar-state.service';
import { EventsApiService, Invitation } from './events-api.service';
import { eventColorClass, eventColorStyle } from './event-color';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-invitations-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view-fade min-h-screen bg-gray-50 text-gray-800">
      <header class="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <a routerLink="/" class="tap flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          <app-icon name="arrow-back" class="h-5 w-5" /> {{ tr.t('settings.back') }}
        </a>
        <app-icon name="mail" class="h-5 w-5 text-amber-500" />
        <h1 class="text-lg font-medium">{{ tr.t('invite.title') }}</h1>
      </header>

      <div class="mx-auto max-w-2xl space-y-3 p-4">
        @if (loading()) {
          <p class="py-10 text-center text-sm text-gray-400">…</p>
        } @else if (list().length === 0) {
          <p class="py-10 text-center text-sm text-gray-400">{{ tr.t('invite.none') }}</p>
        } @else {
          @for (iv of list(); track iv.eventId) {
            <div class="rounded-xl border border-gray-200 bg-white p-4">
              <div class="flex items-center gap-2">
                <span class="h-3 w-3 rounded-full" [class]="dotClass(iv.color)" [style.background-color]="dotStyle(iv.color)"></span>
                <p class="min-w-0 break-words font-medium">{{ iv.title || tr.t('common.untitled') }}</p>
              </div>
              <p class="mt-1 text-sm text-gray-500">{{ timeLabel(iv) }}</p>
              @if (iv.creatorEmail) {
                <p class="mt-0.5 break-all text-xs text-gray-400">{{ tr.t('invite.from') }} {{ iv.creatorEmail }}</p>
              }
              <div class="mt-3 flex gap-2">
                <button type="button" (click)="respond(iv, 'accepted')" [disabled]="busy() === iv.eventId"
                  class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">
                  {{ tr.t('rsvp.accepted') }}
                </button>
                <button type="button" (click)="respond(iv, 'declined')" [disabled]="busy() === iv.eventId"
                  class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">
                  {{ tr.t('rsvp.declined') }}
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class InvitationsPageComponent {
  private readonly api = inject(EventsApiService);
  private readonly state = inject(CalendarStateService);
  private readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);
  private readonly router = inject(Router);

  protected readonly list = signal<Invitation[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.api.listInvitations().subscribe({
      next: (l) => { this.list.set(l); this.loading.set(false); },
      error: () => { this.list.set([]); this.loading.set(false); },
    });
  }

  protected respond(iv: Invitation, status: 'accepted' | 'declined'): void {
    this.busy.set(iv.eventId);
    this.api.rsvp(iv.eventId, status as any).subscribe({
      next: () => {
        this.list.update((l) => l.filter((x) => x.eventId !== iv.eventId));
        this.busy.set(null);
        // Đồng ý -> tải lại lịch để thấy sự kiện vừa nhận.
        if (status === 'accepted') this.state.reload();
      },
      error: () => this.busy.set(null),
    });
  }

  protected timeLabel(iv: Invitation): string {
    const s = new Date(iv.startTime);
    if (iv.isAllDay) return this.settings.formatDate(s);
    return `${this.settings.formatDate(s)} · ${this.settings.formatTime(s)} – ${this.settings.formatTime(new Date(iv.endTime))}`;
  }

  protected dotClass(color: string): string {
    return eventColorClass(color);
  }

  /** Màu nền cho chấm khi người dùng tự chọn mã hex (rỗng nếu dùng màu dựng sẵn). */
  protected dotStyle(color: string): string {
    return eventColorStyle(color);
  }
}
