// Chuông thông báo — chia 3 mục: Lời mời / Sự kiện bị sửa / Sự kiện bị hủy.
// - Lời mời: Đồng ý/Từ chối ngay trong app (không cần Gmail).
// - Bị sửa: liệt kê rõ từng thay đổi (ngày giờ bắt đầu, ngày giờ kết thúc, tiêu đề, địa điểm).
// - Bị hủy: sự kiện người tạo đã hủy.
// Tất cả cập nhật real-time qua WebSocket (Supabase Realtime) — không cần F5.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CalendarStateService } from './calendar-state.service';
import { GroupsStateService } from '../groups/groups-state.service';
import { Invitation } from './events-api.service';
import { NotificationService } from '../notifications/notification.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { IconComponent } from '../shared/icon.component';
import { notifBadgeClass, notifCatKey, notifIconName } from '../notifications/notif-kind.util';

@Component({
  selector: 'app-invitation-bell',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drop-anchor relative">
      <button
        type="button"
        (click)="open.set(!open())"
        class="tap relative rounded-full p-2 hover:bg-gray-100"
        [title]="tr.t('nav.invitations')"
        [attr.aria-label]="tr.t('nav.invitations')"
      >
        <app-icon name="bell" class="h-5 w-5 text-gray-600" />
        @if (total() > 0) {
          <span
            class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
          >{{ total() > 9 ? '9+' : total() }}</span>
        }
      </button>

      @if (open()) {
        <div class="fixed inset-0 z-20" (click)="open.set(false)"></div>
        <div class="drop-panel popup-in absolute right-0 top-full z-30 mt-1 max-h-[80vh] w-80 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">

          @if (total() === 0 && notify.recentHistory().length === 0) {
            <p class="px-3 py-6 text-center text-sm text-gray-400">{{ tr.t('notif.empty') }}</p>
          }

          <!-- MỤC: SỰ KIỆN GẦN ĐÂY — 5 thông báo mới nhất (mọi loại) trong 3 ngày qua,
               hiện ĐẦY ĐỦ thông tin (nhãn loại, tiêu đề, chi tiết, giờ nhận — không cắt bớt
               chữ), chỉ để xem lại, không có nút thao tác (khác các mục actionable bên dưới). -->
          @if (notify.recentHistory().length > 0) {
            <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <span class="text-sm font-semibold text-gray-700">{{ tr.t('notif.recentTitle') }}</span>
            </div>
            @for (h of notify.recentHistory(); track h.id) {
              <!-- Có sự kiện liên quan -> bấm cả dòng để nhảy tới sự kiện đó -->
              <div class="w-full border-b border-gray-50 px-3 py-2.5 text-left"
                [class]="(h.eventId || h.groupId) ? 'cursor-pointer hover:bg-gray-50' : ''"
                (click)="openHistoryEntry(h)">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    [class]="notifBadgeClass(h.kind)"
                  >
                    <app-icon [name]="notifIconName(h.kind)" class="h-3 w-3" />
                    {{ tr.t(notifCatKey(h.kind)) }}
                  </span>
                  <span class="shrink-0 text-xs text-gray-400">{{ recentTimeLabel(h.at) }}</span>
                </div>
                <p class="mt-1 break-words text-sm font-medium text-gray-800">{{ h.title }}</p>
                @if (h.detail) { <p class="break-words text-xs text-gray-500">{{ h.detail }}</p> }
                @if (h.body) { <p class="break-words text-xs text-gray-500">{{ h.body }}</p> }
              </div>
            }
          }

          <!-- MỤC 0: NHẮC LỊCH (tới giờ) -->
          @if (reminders().length > 0) {
            <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <app-icon name="bell" class="h-4 w-4 text-blue-500" />
              <span class="text-sm font-semibold text-gray-700">{{ tr.t('notif.secReminders') }}</span>
              <span class="ml-auto text-xs text-gray-400">{{ reminders().length }}</span>
            </div>
            @for (n of reminders(); track n.id) {
              <div class="flex items-start gap-2 border-b border-gray-50 px-3 py-2.5">
                <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400"></span>
                <!-- Bấm -> mở đúng sự kiện được nhắc -->
                <button type="button" (click)="goToEvent(n.eventId)" class="min-w-0 flex-1 text-left" [class.cursor-default]="!n.eventId">
                  <p class="truncate text-sm font-medium text-gray-800">{{ n.title }}</p>
                  @if (n.body) { <p class="text-xs text-gray-500">{{ n.body }}</p> }
                </button>
                <button type="button" (click)="notify.dismissReminder(n.id)"
                  class="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100" [attr.aria-label]="tr.t('common.close')">
                  <app-icon name="x" class="h-3.5 w-3.5" />
                </button>
              </div>
            }
          }

          <!-- MỤC 1: LỜI MỜI -->
          @if (invites().length > 0) {
            <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <app-icon name="mail" class="h-4 w-4 text-amber-500" />
              <span class="text-sm font-semibold text-gray-700">{{ tr.t('notif.secInvites') }}</span>
              <span class="ml-auto text-xs text-gray-400">{{ invites().length }}</span>
            </div>
            @for (iv of invites(); track iv.eventId) {
              <div class="border-b border-gray-50 px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" [class]="dotClass(iv.color)"></span>
                  <p class="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{{ iv.title || tr.t('common.untitled') }}</p>
                </div>
                <p class="mt-0.5 text-xs text-gray-500">{{ timeLabel(iv) }}</p>
                @if (iv.creatorEmail) {
                  <p class="truncate text-xs text-gray-400">{{ tr.t('invite.from') }} {{ iv.creatorEmail }}</p>
                }
                <div class="mt-2 flex gap-2">
                  <button type="button" (click)="respond(iv, 'accepted')"
                    class="tap rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">{{ tr.t('rsvp.accepted') }}</button>
                  <button type="button" (click)="respond(iv, 'declined')"
                    class="tap rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50">{{ tr.t('rsvp.declined') }}</button>
                </div>
              </div>
            }
          }

          <!-- MỤC 2: SỰ KIỆN BỊ SỬA -->
          @if (changed().length > 0) {
            <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <app-icon name="alert" class="h-4 w-4 text-amber-500" />
              <span class="text-sm font-semibold text-gray-700">{{ tr.t('notif.secChanged') }}</span>
              <span class="ml-auto text-xs text-gray-400">{{ changed().length }}</span>
            </div>
            @for (n of changed(); track n.id) {
              <div class="flex items-start gap-2 border-b border-gray-50 px-3 py-2.5">
                <!-- Bấm -> mở đúng sự kiện vừa bị sửa -->
                <button type="button" (click)="goToEvent(n.eventId)" class="min-w-0 flex-1 text-left">
                  <p class="truncate text-sm font-medium text-gray-800">{{ n.title }}</p>
                  <ul class="mt-1 space-y-0.5">
                    @for (c of n.changes; track c) {
                      <li class="break-words text-xs text-gray-600">• {{ c }}</li>
                    }
                  </ul>
                </button>
                <button type="button" (click)="notify.dismissChange(n.id)"
                  class="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100" [attr.aria-label]="tr.t('common.close')">
                  <app-icon name="x" class="h-3.5 w-3.5" />
                </button>
              </div>
            }
          }

          <!-- MỤC 3: SỰ KIỆN BỊ HỦY -->
          @if (cancelled().length > 0) {
            <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <app-icon name="trash" class="h-4 w-4 text-red-500" />
              <span class="text-sm font-semibold text-gray-700">{{ tr.t('notif.secCancelled') }}</span>
              <span class="ml-auto text-xs text-gray-400">{{ cancelled().length }}</span>
            </div>
            @for (n of cancelled(); track n.id) {
              <div class="flex items-center gap-2 border-b border-gray-50 px-3 py-2.5">
                <span class="h-2 w-2 shrink-0 rounded-full bg-red-400"></span>
                <p class="min-w-0 flex-1 truncate text-sm text-gray-700 line-through">{{ n.title }}</p>
                <button type="button" (click)="notify.dismissCancel(n.id)"
                  class="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100" [attr.aria-label]="tr.t('common.close')">
                  <app-icon name="x" class="h-3.5 w-3.5" />
                </button>
              </div>
            }
          }

          <!-- Xóa hết thông báo nhắc/hủy/sửa -->
          @if (reminders().length > 0 || changed().length > 0 || cancelled().length > 0) {
            <div class="px-3 py-2 text-right">
              <button type="button" (click)="clearAll()" class="text-xs text-gray-500 hover:text-gray-700 hover:underline">
                {{ tr.t('notif.clearAll') }}
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class InvitationBellComponent {
  private readonly state = inject(CalendarStateService);
  private readonly groupsState = inject(GroupsStateService);
  protected readonly notify = inject(NotificationService);
  private readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);

  protected readonly invites = this.state.invitations;
  protected readonly changed = this.notify.changeNotices;
  protected readonly cancelled = this.notify.cancelNotices;
  protected readonly reminders = this.notify.reminderNotices;
  protected readonly total = computed(
    () => this.reminders().length + this.invites().length + this.changed().length + this.cancelled().length,
  );
  protected readonly open = signal(false);

  protected readonly notifBadgeClass = notifBadgeClass;
  protected readonly notifIconName = notifIconName;
  protected readonly notifCatKey = notifCatKey;

  /** Nhãn thời gian ngắn gọn cho mục "Sự kiện gần đây": vd "5 phút", "3 giờ", "2 ngày". */
  protected recentTimeLabel(at: number): string {
    const diffMs = Date.now() - at;
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return this.tr.t('notif.justNow');
    if (min < 60) return `${min} ${this.tr.t('notif.minAgo')}`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour} ${this.tr.t('notif.hourAgo')}`;
    const day = Math.floor(hour / 24);
    return `${day} ${this.tr.t('notif.dayAgo')}`;
  }

  /** Xóa hết thông báo đã lưu (nhắc lịch + sửa + hủy). */
  protected clearAll(): void {
    this.notify.clearReminders();
    this.notify.clearNotices();
  }

  /** Bấm 1 thông báo -> nhảy tới đúng sự kiện trên lịch rồi đóng chuông. */
  protected goToEvent(eventId: string | null | undefined): void {
    if (!eventId) return;
    // Sự kiện của NHÓM -> mở panel nhóm (popover chi tiết chỉ dùng cho sự kiện cá nhân).
    const ev = this.state.events().find((e) => e.id === eventId);
    if (ev?.groupId) {
      this.groupsState.openPanel(ev.groupId);
    } else {
      this.state.focusEvent(eventId);
    }
    this.open.set(false);
  }

  /** Bấm 1 dòng trong "Sự kiện gần đây": tin nhắn -> mở chat nhóm; còn lại -> mở sự kiện. */
  protected openHistoryEntry(h: { eventId?: string; groupId?: string }): void {
    if (h.groupId) {
      this.groupsState.openPanel(h.groupId, 'chat');
      this.open.set(false);
      return;
    }
    this.goToEvent(h.eventId);
  }

  protected respond(iv: Invitation, status: 'accepted' | 'declined'): void {
    this.state.respondInvitation(iv.eventId, status);
    if (this.total() <= 1) this.open.set(false);
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
