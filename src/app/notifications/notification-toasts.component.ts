// Hiển thị các toast nhắc lịch ở góc trên phải màn hình.
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService, Toast } from './notification.service';
import { IconComponent } from '../shared/icon.component';
import { TranslateService } from '../i18n/translate.service';
import { CalendarStateService } from '../calendar/calendar-state.service';
import { GroupsStateService } from '../groups/groups-state.service';
import { notifBadgeClass, notifBorderClass, notifCatKey, notifIconName } from './notif-kind.util';

@Component({
  selector: 'app-notification-toasts',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
      @for (t of notify.toasts(); track t.id) {
        <!-- Có eventId (nhắc lịch / sự kiện bị sửa...) -> bấm vào toast nhảy tới đúng sự kiện -->
        <div
          class="toast-in w-72 max-w-full rounded-lg border bg-white px-4 py-3 shadow-lg"
          [class]="borderClass(t.kind) + ((t.eventId || t.groupId) && t.kind !== 'invite' && t.kind !== 'groupInvite' ? ' cursor-pointer hover:shadow-xl' : '')"
          (click)="onToastClick(t)"
        >
          <!-- Nhãn phân loại: cho biết ngay đây là loại thông báo gì, tách biệt với nội dung -->
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              [class]="badgeClass(t.kind)"
            >
              <app-icon [name]="iconName(t.kind)" class="h-3 w-3" />
              {{ catLabel(t.kind) }}
            </span>
            <button type="button" (click)="notify.dismiss(t.id)" class="btn-icon !p-0.5 text-gray-400" [attr.aria-label]="tr.t('common.close')">
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
          } @else if (t.kind === 'groupInvite') {
            <p class="text-sm font-medium text-gray-800">{{ t.title }}</p>
            <p class="text-xs text-gray-500">{{ tr.t('toast.groupInviteBody') }}</p>
            <div class="mt-2 flex gap-2">
              <button type="button" (click)="respondGroupInvite(t, true)"
                class="tap rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">{{ tr.t('rsvp.accepted') }}</button>
              <button type="button" (click)="respondGroupInvite(t, false)"
                class="tap rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">{{ tr.t('rsvp.declined') }}</button>
            </div>
          } @else if (t.kind === 'chat') {
            <p class="text-sm font-medium text-gray-800">{{ t.title }}</p>
            <p class="truncate text-xs text-gray-500">{{ t.body }}</p>
          } @else if (t.kind === 'file') {
            <p class="text-sm font-medium text-gray-800">{{ t.title }}</p>
            <p class="text-xs text-gray-500">{{ tr.t('toast.ofEvent') }} {{ t.detail }}</p>
          } @else if (t.kind === 'shared') {
            <p class="text-sm font-medium text-gray-800">{{ t.detail }}</p>
            <p class="text-xs text-gray-500">{{ tr.t('toast.sharedBody') }}</p>
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
  private readonly groupsState = inject(GroupsStateService);

  /** Nhãn phân loại ngắn gọn — hiện trong badge màu ở đầu mỗi toast. */
  protected catLabel(kind: Toast['kind']): string {
    return this.tr.t(notifCatKey(kind));
  }
  protected iconName = notifIconName;
  protected badgeClass = notifBadgeClass;
  protected borderClass = notifBorderClass;

  /** Đồng ý/Từ chối lời mời VÀO NHÓM ngay trên toast rồi ẩn toast. */
  protected respondGroupInvite(t: { id: string; groupId?: string }, accept: boolean): void {
    if (t.groupId) {
      if (accept) this.groupsState.acceptInvite(t.groupId);
      else this.groupsState.declineInvite(t.groupId);
    }
    this.notify.dismiss(t.id);
  }

  /** Đồng ý/Từ chối lời mời ngay trên toast rồi ẩn toast. */
  protected respondInvite(t: { id: string; eventId?: string }, status: 'accepted' | 'declined'): void {
    if (t.eventId) this.state.respondInvitation(t.eventId, status);
    this.notify.dismiss(t.id);
  }

  /**
   * Bấm vào toast -> mở đúng thứ liên quan:
   *  - Tin nhắn nhóm: mở cuộc trò chuyện của nhóm đó.
   *  - Sự kiện: nhảy tới sự kiện trên lịch.
   *  - Lời mời: bỏ qua (đã có nút Đồng ý/Từ chối riêng trên toast).
   */
  protected onToastClick(t: Toast): void {
    if (t.kind === 'invite' || t.kind === 'groupInvite') return;
    if (t.groupId) {
      this.groupsState.openPanel(t.groupId, 'chat');
      this.notify.dismiss(t.id);
      return;
    }
    if (!t.eventId) return;
    this.state.focusEvent(t.eventId);
    this.notify.dismiss(t.id);
  }
}
