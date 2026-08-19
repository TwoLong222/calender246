// Hiển thị các toast nhắc lịch ở góc trên phải màn hình.
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from './notification.service';
import { IconComponent } from '../shared/icon.component';
import { TranslateService } from '../i18n/translate.service';

@Component({
  selector: 'app-notification-toasts',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed right-4 top-4 z-50 flex flex-col gap-2">
      @for (t of notify.toasts(); track t.id) {
        <div class="toast-in flex w-72 items-start gap-3 rounded-lg border border-amber-200 bg-white px-4 py-3 shadow-lg">
          <app-icon name="alarm" class="h-6 w-6 shrink-0 text-amber-500" />
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-800">{{ tr.t('toast.upcoming') }}: {{ t.title }}</p>
            <p class="text-xs text-gray-500">{{ tr.t('toast.startsAt') }} {{ t.timeLabel }}</p>
          </div>
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
}
