// Hiển thị các toast nhắc lịch ở góc trên phải màn hình.
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from './notification.service';
import { IconComponent } from '../shared/icon.component';
import { TranslateService } from '../i18n/translate.service';
import { CalendarStateService } from '../calendar/calendar-state.service';

@Component({
  selector: 'app-notification-toasts',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed right-4 top-4 z-50 flex flex-col gap-2">
      @for (t of notify.toasts(); track t.id) {
        <div
          class="toast-in flex w-72 items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-lg"
          [class.border-amber-200]="t.kind !== 'chat' && t.kind !== 'invite'"
          [class.border-blue-200]="t.kind === 'chat'"
          [class.border-emerald-200]="t.kind === 'invite'"
        >
          @if (t.kind === 'invite') {
            <app-icon name="bell" class="h-6 w-6 shrink-0 text-emerald-500" />
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-800">{{ tr.t('invite.new') }}: {{ t.title }}</p>
              @if (t.detail) {
                <p class="truncate text-xs text-gray-500">{{ tr.t('invite.from') }} {{ t.detail }}</p>
              }
              <div class="mt-2 flex gap-2">
                <button type="button" (click)="respondInvite(t, 'accepted')"
                  class="tap rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">{{ tr.t('rsvp.accepted') }}</button>
                <button type="button" (click)="respondInvite(t, 'declined')"
                  class="tap rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">{{ tr.t('rsvp.declined') }}</button>
              </div>
            </div>
          } @else if (t.kind === 'chat') {
            <span class="text-xl leading-6">💬</span>
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-800">{{ t.title }}</p>
              <p class="truncate text-xs text-gray-500">{{ t.body }}</p>
            </div>
          } @else if (t.kind === 'file') {
            <app-icon name="notes" class="h-6 w-6 shrink-0 text-amber-500" />
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-800">{{ tr.t('toast.fileOpen') }}: {{ t.title }}</p>
              <p class="text-xs text-gray-500">{{ tr.t('toast.ofEvent') }} {{ t.detail }}</p>
            </div>
          } @else {
            <app-icon name="alarm" class="h-6 w-6 shrink-0 text-amber-500" />
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-800">{{ tr.t('toast.upcoming') }}: {{ t.title }}</p>
              <p class="text-xs text-gray-500">{{ tr.t('toast.startsAt') }} {{ t.detail }}</p>
            </div>
          }
          <button type="button" (click)="notify.dismiss(t.id)" class="rounded-full p-1 text-gray-400 hover:bg-gray-100" [attr.aria-label]="tr.t('common.close')">
            <app-icon name="x" class="h-4 w-4" />
          </button>
        </div>
      }
    </div>
  `,
})
export class NotificationToastsComponent {
  protected readonly notify = inject(NotificationService);
  protected readonly tr = inject(TranslateService);
  private readonly state = inject(CalendarStateService);

  /** Đồng ý/Từ chối lời mời ngay trên toast rồi ẩn toast. */
  protected respondInvite(t: { id: string; eventId?: string }, status: 'accepted' | 'declined'): void {
    if (t.eventId) this.state.respondInvitation(t.eventId, status);
    this.notify.dismiss(t.id);
  }
}
