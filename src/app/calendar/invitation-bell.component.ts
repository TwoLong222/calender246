// Chuông thông báo lời mời — hiện ngay trên header trang lịch.
// - Badge = số lời mời CHƯA trả lời (cập nhật real-time qua CalendarStateService).
// - Bấm chuông mở panel: mỗi lời mời có nút Đồng ý / Từ chối ngay trong app (không cần Gmail).
// - Khi không mở web, người dùng vẫn xác nhận được qua link trong email (tính năng Gmail đã có).

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CalendarStateService } from './calendar-state.service';
import { Invitation } from './events-api.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-invitation-bell',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <button
        type="button"
        (click)="open.set(!open())"
        class="tap relative rounded-full p-1.5 hover:bg-gray-100"
        [title]="tr.t('nav.invitations')"
        [attr.aria-label]="tr.t('nav.invitations')"
      >
        <app-icon name="bell" class="h-5 w-5 text-gray-600" />
        @if (count() > 0) {
          <span
            class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
          >{{ count() > 9 ? '9+' : count() }}</span>
        }
      </button>

      @if (open()) {
        <!-- Bấm ra ngoài để đóng -->
        <div class="fixed inset-0 z-20" (click)="open.set(false)"></div>
        <div class="popup-in absolute right-0 top-full z-30 mt-1 w-80 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <app-icon name="bell" class="h-4 w-4 text-amber-500" />
            <span class="text-sm font-medium text-gray-700">{{ tr.t('invite.title') }}</span>
          </div>

          @if (list().length === 0) {
            <p class="px-3 py-6 text-center text-sm text-gray-400">{{ tr.t('invite.none') }}</p>
          } @else {
            <div class="max-h-96 overflow-y-auto">
              @for (iv of list(); track iv.eventId) {
                <div class="border-b border-gray-50 px-3 py-2.5 last:border-b-0">
                  <div class="flex items-center gap-2">
                    <span class="h-2.5 w-2.5 shrink-0 rounded-full" [class]="dotClass(iv.color)"></span>
                    <p class="truncate text-sm font-medium text-gray-800">{{ iv.title || tr.t('common.untitled') }}</p>
                  </div>
                  <p class="mt-0.5 text-xs text-gray-500">{{ timeLabel(iv) }}</p>
                  @if (iv.creatorEmail) {
                    <p class="truncate text-xs text-gray-400">{{ tr.t('invite.from') }} {{ iv.creatorEmail }}</p>
                  }
                  <div class="mt-2 flex gap-2">
                    <button
                      type="button"
                      (click)="respond(iv, 'accepted')"
                      class="tap rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >{{ tr.t('rsvp.accepted') }}</button>
                    <button
                      type="button"
                      (click)="respond(iv, 'declined')"
                      class="tap rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                    >{{ tr.t('rsvp.declined') }}</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class InvitationBellComponent {
  private readonly state = inject(CalendarStateService);
  private readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);

  protected readonly list = this.state.invitations;
  protected readonly count = computed(() => this.list().length);
  protected readonly open = signal(false);

  protected respond(iv: Invitation, status: 'accepted' | 'declined'): void {
    this.state.respondInvitation(iv.eventId, status);
    // Đóng panel nếu vừa xử lý lời mời cuối.
    if (this.count() <= 1) this.open.set(false);
  }

  protected timeLabel(iv: Invitation): string {
    const s = new Date(iv.startTime);
    if (iv.isAllDay) return this.settings.formatDate(s);
    return `${this.settings.formatDate(s)} · ${this.settings.formatTime(s)} – ${this.settings.formatTime(new Date(iv.endTime))}`;
  }

  protected dotClass(color: string): string {
    const map: Record<string, string> = {
      sky: 'bg-sky-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500',
      rose: 'bg-rose-500', amber: 'bg-amber-500',
    };
    return map[color] ?? 'bg-sky-500';
  }
}
