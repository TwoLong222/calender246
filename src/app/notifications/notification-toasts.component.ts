// Hiển thị các toast nhắc lịch ở góc trên phải màn hình.
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService, Toast } from './notification.service';
import { IconComponent, IconName } from '../shared/icon.component';
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
        <div class="toast-in w-72 rounded-lg border bg-white px-4 py-3 shadow-lg" [class]="borderClass(t.kind)">
          <!-- Nhãn phân loại: cho biết ngay đây là loại thông báo gì, tách biệt với nội dung -->
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              [class]="badgeClass(t.kind)"
            >
              <app-icon [name]="iconName(t.kind)" class="h-3 w-3" />
              {{ catLabel(t.kind) }}
            </span>
            <button type="button" (click)="notify.dismiss(t.id)" class="rounded-full p-0.5 text-gray-400 hover:bg-gray-100" [attr.aria-label]="tr.t('common.close')">
              <app-icon name="x" class="h-3.5 w-3.5" />
            </button>
          </div>

          @if (t.kind === 'cancelled') {
            <p class="text-sm font-medium text-gray-800">{{ t.detail }}</p>
          } @else if (t.kind === 'changed') {
            <p class="text-sm font-medium text-gray-800">{{ t.title }}</p>
            <p class="break-words text-xs text-gray-500">{{ t.body }}</p>
          } @else if (t.kind === 'invite') {
            <p class="text-sm font-medium text-gray-800">{{ t.title }}</p>
            @if (t.detail) {
              <p class="truncate text-xs text-gray-500">{{ tr.t('invite.from') }} {{ t.detail }}</p>
            }
            <div class="mt-2 flex gap-2">
              <button type="button" (click)="respondInvite(t, 'accepted')"
                class="tap rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">{{ tr.t('rsvp.accepted') }}</button>
              <button type="button" (click)="respondInvite(t, 'declined')"
                class="tap rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">{{ tr.t('rsvp.declined') }}</button>
            </div>
          } @else if (t.kind === 'chat') {
            <p class="text-sm font-medium text-gray-800">{{ t.title }}</p>
            <p class="truncate text-xs text-gray-500">{{ t.body }}</p>
          } @else if (t.kind === 'file') {
            <p class="text-sm font-medium text-gray-800">{{ t.title }}</p>
            <p class="text-xs text-gray-500">{{ tr.t('toast.ofEvent') }} {{ t.detail }}</p>
          } @else {
            <p class="text-sm font-medium text-gray-800">{{ t.title }}</p>
            <p class="text-xs text-gray-500">{{ tr.t('toast.startsAt') }} {{ t.detail }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class NotificationToastsComponent {
  protected readonly notify = inject(NotificationService);
  protected readonly tr = inject(TranslateService);
  private readonly state = inject(CalendarStateService);

  /** Nhãn phân loại ngắn gọn — hiện trong badge màu ở đầu mỗi toast. */
  protected catLabel(kind: Toast['kind']): string {
    const map: Record<Toast['kind'], string> = {
      event: 'toast.catReminder',
      invite: 'toast.catInvite',
      changed: 'toast.catChanged',
      cancelled: 'toast.catCancelled',
      file: 'toast.catFile',
      chat: 'toast.catChat',
    };
    return this.tr.t(map[kind]);
  }

  /** Icon riêng cho từng loại — khớp với ý nghĩa của badge. */
  protected iconName(kind: Toast['kind']): IconName {
    const map: Record<Toast['kind'], IconName> = {
      event: 'alarm',
      invite: 'mail',
      changed: 'pencil',
      cancelled: 'trash',
      file: 'notes',
      chat: 'message',
    };
    return map[kind];
  }

  /** Màu badge — mỗi loại 1 màu riêng để phân biệt nhanh bằng mắt, không cần đọc chữ. */
  protected badgeClass(kind: Toast['kind']): string {
    const map: Record<Toast['kind'], string> = {
      event: 'bg-sky-50 text-sky-700',
      invite: 'bg-emerald-50 text-emerald-700',
      changed: 'bg-amber-50 text-amber-700',
      cancelled: 'bg-red-50 text-red-700',
      file: 'bg-violet-50 text-violet-700',
      chat: 'bg-indigo-50 text-indigo-700',
    };
    return map[kind];
  }

  /** Viền toast đồng bộ màu với badge (nhạt hơn). */
  protected borderClass(kind: Toast['kind']): string {
    const map: Record<Toast['kind'], string> = {
      event: 'border-sky-200',
      invite: 'border-emerald-200',
      changed: 'border-amber-200',
      cancelled: 'border-red-200',
      file: 'border-violet-200',
      chat: 'border-indigo-200',
    };
    return map[kind];
  }

  /** Đồng ý/Từ chối lời mời ngay trên toast rồi ẩn toast. */
  protected respondInvite(t: { id: string; eventId?: string }, status: 'accepted' | 'declined'): void {
    if (t.eventId) this.state.respondInvitation(t.eventId, status);
    this.notify.dismiss(t.id);
  }
}
