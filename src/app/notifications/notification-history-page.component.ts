// Trang "Lịch sử thông báo" — xem lại MỌI thông báo từng bắn ra (nhắc lịch, lời mời,
// sự kiện sửa/hủy, tài liệu, tin nhắn), kể cả đã đọc/đã tắt toast. Lưu trên trình duyệt
// (localStorage), tự động xóa các dòng quá 3 ngày (xem NotificationService.pushHistory).

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationService } from './notification.service';
import { IconComponent } from '../shared/icon.component';
import { TranslateService } from '../i18n/translate.service';
import { SettingsService } from '../settings/settings.service';
import { notifBadgeClass, notifCatKey, notifIconName } from './notif-kind.util';

@Component({
  selector: 'app-notification-history-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view-fade min-h-screen bg-gray-50 text-gray-800">
      <header class="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <a routerLink="/" class="tap flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          <app-icon name="arrow-back" class="h-5 w-5" /> {{ tr.t('settings.back') }}
        </a>
        <app-icon name="bell" class="h-5 w-5 text-gray-500" />
        <h1 class="text-lg font-medium">{{ tr.t('notif.historyTitle') }}</h1>
        @if (notify.history().length > 0) {
          <button type="button" (click)="notify.clearHistory()" class="tap ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
            {{ tr.t('notif.clearAll') }}
          </button>
        }
      </header>

      <div class="mx-auto max-w-2xl space-y-2 p-4">
        <p class="pb-1 text-xs text-gray-400">{{ tr.t('notif.historyNote') }}</p>

        @if (notify.history().length === 0) {
          <p class="py-10 text-center text-sm text-gray-400">{{ tr.t('notif.historyEmpty') }}</p>
        } @else {
          @for (h of notify.history(); track h.id) {
            <div class="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div class="flex items-center justify-between gap-2">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  [class]="notifBadgeClass(h.kind)"
                >
                  <app-icon [name]="notifIconName(h.kind)" class="h-3 w-3" />
                  {{ tr.t(notifCatKey(h.kind)) }}
                </span>
                <span class="shrink-0 text-xs text-gray-400">{{ timeLabel(h.at) }}</span>
              </div>
              <p class="mt-1.5 text-sm font-medium text-gray-800">{{ h.title }}</p>
              @if (h.detail) { <p class="text-xs text-gray-500">{{ h.detail }}</p> }
              @if (h.body) { <p class="break-words text-xs text-gray-500">{{ h.body }}</p> }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class NotificationHistoryPageComponent {
  protected readonly notify = inject(NotificationService);
  protected readonly tr = inject(TranslateService);
  private readonly settings = inject(SettingsService);

  protected readonly notifBadgeClass = notifBadgeClass;
  protected readonly notifIconName = notifIconName;
  protected readonly notifCatKey = notifCatKey;

  protected timeLabel(at: number): string {
    const d = new Date(at);
    return `${this.settings.formatDate(d)} · ${this.settings.formatTime(d)}`;
  }
}
