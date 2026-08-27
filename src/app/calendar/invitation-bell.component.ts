// Chuông thông báo — chia 3 mục: Lời mời / Sự kiện bị sửa / Sự kiện bị hủy.
// - Lời mời: Đồng ý/Từ chối ngay trong app (không cần Gmail).
// - Bị sửa: liệt kê rõ từng thay đổi (ngày giờ bắt đầu, ngày giờ kết thúc, tiêu đề, địa điểm).
// - Bị hủy: sự kiện người tạo đã hủy.
// Tất cả cập nhật real-time qua WebSocket (Supabase Realtime) — không cần F5.

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarStateService } from './calendar-state.service';
import { GroupsStateService } from '../groups/groups-state.service';
import { Invitation } from './events-api.service';
import { eventColorClass, eventColorStyle } from './event-color';
import { NotificationService } from '../notifications/notification.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { IconComponent } from '../shared/icon.component';
import { notifBadgeClass, notifCatKey, notifIconName } from '../notifications/notif-kind.util';

@Component({
  selector: 'app-invitation-bell',
  standalone: true,
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drop-anchor relative">
      <button
        type="button"
        (click)="toggleOpen()"
        class="btn-icon relative"
        [title]="tr.t('nav.invitations')"
        [attr.aria-label]="tr.t('nav.invitations')"
      >
        <app-icon name="bell" class="h-5 w-5 text-gray-600" />
        @if (unread() > 0) {
          <span
            class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
          >{{ unread() > 9 ? '9+' : unread() }}</span>
        }
      </button>

      @if (open()) {
        <div class="fixed inset-0 z-20" (click)="open.set(false)"></div>
        <div class="drop-panel surface-panel popup-in absolute right-0 top-full z-30 mt-1.5 max-h-[80vh] w-80 overflow-y-auto py-1">

          @if (total() === 0) {
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
              <!-- Có sự kiện liên quan -> bấm cả dòng để nhảy tới sự kiện đó. Nút X ở góc để tự xóa dòng. -->
              <div class="group relative w-full border-b border-gray-50 px-3 py-2.5 text-left"
                [class]="canOpenHistory(h) ? 'cursor-pointer hover:bg-gray-50' : ''"
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
                <p class="mt-1 break-words pr-6 text-sm font-medium text-gray-800">{{ h.title }}</p>
                @if (h.detail) { <p class="break-words pr-6 text-xs text-gray-500">{{ h.detail }}</p> }
                @if (h.body) { <p class="break-words pr-6 text-xs text-gray-500">{{ h.body }}</p> }
                <button type="button" (click)="removeRecent($event, h.id)"
                  class="absolute bottom-2 right-2 rounded-full p-1 text-gray-400 opacity-0 hover:bg-gray-200 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                  [attr.aria-label]="tr.t('detail.delete')">
                  <app-icon name="trash" class="h-3.5 w-3.5" />
                </button>
              </div>
            }
            <!-- Mục "gần đây" chỉ hiện tối đa 5 (RECENT_MAX_ITEMS) — muốn xem cũ hơn thì qua
                 trang Lịch sử thông báo (lưu vĩnh viễn, không giới hạn số lượng/3 ngày). -->
            <a routerLink="/notification-history" (click)="open.set(false)" class="tap block border-b border-gray-100 px-3 py-2 text-center text-xs font-medium text-blue-600 hover:bg-gray-50">
              {{ tr.t('notif.viewAllHistory') }}
            </a>
          }

          <!-- MỤC 0: NHẮC LỊCH (tới giờ) -->
          @if (reminders().length > 0) {
            <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <app-icon name="bell" class="h-4 w-4 text-blue-500" />
              <span class="text-sm font-semibold text-gray-700">{{ tr.t('notif.secReminders') }}</span>
              <span class="ml-auto text-xs text-gray-400">{{ reminders().length }}</span>
            </div>
            @for (n of remindersVisible(); track n.id) {
              <div class="flex items-start gap-2 border-b border-gray-50 px-3 py-2.5">
                <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400"></span>
                <!-- Bấm -> mở sự kiện được nhắc VÀ đánh dấu đã đọc (chấm đỏ tự mất, không cần bấm X) -->
                <button type="button" (click)="openReminder(n)" class="min-w-0 flex-1 text-left">
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

          <!-- MỤC 1: LỜI MỜI — chỉ hiện tối đa 5, còn lại xem ở trang Lời mời riêng. -->
          @if (invites().length > 0) {
            <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <app-icon name="mail" class="h-4 w-4 text-amber-500" />
              <span class="text-sm font-semibold text-gray-700">{{ tr.t('notif.secInvites') }}</span>
              <span class="ml-auto text-xs text-gray-400">{{ invites().length }}</span>
            </div>
            @for (iv of invitesVisible(); track iv.eventId) {
              <div class="border-b border-gray-50 px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" [class]="dotClass(iv.color)" [style.background-color]="dotStyle(iv.color)"></span>
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
            @if (invites().length > 5) {
              <a routerLink="/invitations" (click)="open.set(false)" class="tap block border-b border-gray-100 px-3 py-2 text-center text-xs font-medium text-blue-600 hover:bg-gray-50">
                {{ tr.t('notif.viewAllInvites') }}
              </a>
            }
          }

          <!-- Bỏ 2 mục riêng "Sự kiện bị sửa" / "Sự kiện bị hủy" — trùng nội dung với mục
               "Sự kiện gần đây" ở trên (notify.recentHistory() đã tự gộp sẵn invite/sửa/hủy,
               tối đa 5, sắp theo thời gian). Theo yêu cầu: chuông chỉ còn 3 khối — Nhắc lịch,
               Lời mời (2 mục còn giữ vì có nút thao tác riêng: dismiss / Đồng ý-Từ chối), và
               Sự kiện gần đây (thông tin thuần, không thao tác). -->

          <!-- Xóa hết thông báo nhắc (mục sửa/hủy không còn hiện riêng nên bỏ khỏi điều kiện) -->
          @if (reminders().length > 0) {
            <div class="px-3 py-2 text-right">
              <button type="button" (click)="clearAll()" class="text-xs text-gray-500 hover:text-gray-700">
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
  /** Chỉ hiện tối đa 5 mục trong dropdown — xem hết ở trang Lời mời riêng khi nhiều hơn 5. */
  protected readonly invitesVisible = computed(() => this.invites().slice(0, 5));
  protected readonly reminders = this.notify.reminderNotices;
  protected readonly remindersVisible = computed(() => this.reminders().slice(0, 5));
  /** Badge trên chuông: nhắc lịch + lời mời + TOÀN BỘ lịch sử (notify.history — không giới
   *  hạn 5 như recentHistory hiển thị trong dropdown). Bắt buộc phải dùng history() thay vì
   *  recentHistory(): recentHistory bị chặn ở tối đa 5 phần tử để HIỂN THỊ, nên một khi đã
   *  đủ 5, có thêm sự kiện mới nó vẫn giữ nguyên độ dài 5 (chỉ đẩy phần tử cũ nhất ra) —
   *  dùng số đó để tính "có gì mới" sẽ bị đứng yên mãi, chuông không bao giờ hiện số nữa dù
   *  liên tục có thông báo mới (đúng lỗi vừa gặp). history() thì tăng đơn điệu (chỉ reset khi
   *  người dùng tự bấm "Xóa hết" ở trang Lịch sử), nên hiệu số với seenTotal luôn phản ánh
   *  đúng số thông báo THẬT SỰ mới kể từ lần mở chuông gần nhất. */
  protected readonly total = computed(
    () => this.reminders().length + this.invites().length + this.notify.history().length,
  );
  protected readonly open = signal(false);

  /** Số badge đỏ trên chuông — CHỈ đếm phần "mới kể từ lần mở gần nhất" (kiểu unread thật),
   *  không phải tổng số đang có. Mở chuông ra xem -> badge biến mất (markSeen ghi lại mốc
   *  total() hiện tại); sau đó có thêm N thông báo mới -> badge hiện đúng N, không hơn không
   *  kém. seenTotal lưu localStorage để F5 lại không bị "hiện lại từ đầu" những cái đã xem rồi. */
  // v2: đổi nguồn đếm từ recentHistory() (bị chặn tối đa 5 -> đứng yên mãi khi đã đầy, xem
  // ghi chú ở `total`) sang history() không giới hạn. Đổi tên key để KHÔNG đọc nhầm mốc cũ
  // (vốn hiệu chỉnh theo công thức cũ, nhỏ hơn nhiều) — nếu không, ngay sau khi cập nhật
  // code, hiệu số total()-seenTotal() sẽ nhảy vọt thành cả trăm (toàn bộ lịch sử cũ bị tính
  // là "mới") dù người dùng đã biết hết những thông báo đó từ trước rồi.
  private readonly SEEN_KEY = 'notif_seen_total_v2';
  private loadSeen(): number | null {
    try {
      const raw = localStorage.getItem(this.SEEN_KEY);
      if (raw == null) return null; // chưa từng lưu theo key v2 -> lần đầu chạy công thức mới
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  protected readonly seenTotal = signal<number>(0);
  protected readonly unread = computed(() => Math.max(0, this.total() - this.seenTotal()));

  constructor() {
    // Lần đầu chạy công thức v2 (chưa có key trong localStorage): coi như đã xem hết mọi thứ
    // đang có tại thời điểm này -> chuông không hiện số "giả" ngay sau khi cập nhật. Các thông
    // báo THẬT SỰ mới phát sinh sau mốc này mới được tính vào unread.
    const saved = this.loadSeen();
    this.seenTotal.set(saved ?? this.total());

    // Nếu total() TỤT xuống dưới mốc đã xem (vd đã Đồng ý/Từ chối 1 lời mời, hoặc bỏ qua 1
    // nhắc lịch) mà không hạ seenTotal theo -> sau đó có thông báo MỚI thật sự thì unread bị
    // tính thiếu (total tăng lại chạm mốc cũ, hiệu số = 0 dù có tin mới). Hạ seenTotal theo để
    // luôn phản ánh đúng "còn bao nhiêu cái CHƯA từng thấy" kể cả khi có xen kẽ dismiss/respond.
    effect(() => {
      const t = this.total();
      if (t < this.seenTotal()) {
        this.seenTotal.set(t);
        try {
          localStorage.setItem(this.SEEN_KEY, String(t));
        } catch {
          /* bỏ qua */
        }
      }
    });
  }

  protected toggleOpen(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) this.markSeen();
  }

  private markSeen(): void {
    const t = this.total();
    this.seenTotal.set(t);
    try {
      localStorage.setItem(this.SEEN_KEY, String(t));
    } catch {
      /* bỏ qua (localStorage đầy / bị chặn) */
    }
  }

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

  /** Bấm 1 nhắc lịch: mở sự kiện (nếu có) + đánh dấu ĐÃ ĐỌC -> tự rơi khỏi chuông, chấm đỏ giảm. */
  protected openReminder(n: { id: string; eventId: string | null }): void {
    if (n.eventId) this.goToEvent(n.eventId);
    this.notify.dismissReminder(n.id);
  }

  /** Bấm 1 dòng trong "Sự kiện gần đây": tin nhắn -> mở chat nhóm; còn lại -> mở sự kiện. */
  protected openHistoryEntry(h: { eventId?: string; groupId?: string; title?: string }): void {
    if (h.groupId) {
      this.groupsState.openPanel(h.groupId, 'chat');
      this.open.set(false);
      return;
    }
    if (h.eventId) {
      this.goToEvent(h.eventId);
      return;
    }
    // Thông báo CŨ (lưu trước khi có eventId) -> dò theo tiêu đề để vẫn bấm được.
    const byTitle = this.state.events().find((e) => e.title && e.title === h.title);
    if (byTitle) this.goToEvent(byTitle.id);
  }

  /** Xóa 1 dòng khỏi "Sự kiện gần đây" — chặn nổi bọt để không kích hoạt mở sự kiện của cả dòng. */
  protected removeRecent(ev: Event, id: string): void {
    ev.stopPropagation();
    this.notify.removeHistory(id);
  }

  /** Dòng lịch sử có mở được gì không (dùng để bật con trỏ + hiệu ứng rê chuột). */
  protected canOpenHistory(h: { eventId?: string; groupId?: string; title?: string }): boolean {
    if (h.eventId || h.groupId) return true;
    return this.state.events().some((e) => e.title && e.title === h.title);
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
    return eventColorClass(color);
  }

  /** Màu nền cho chấm khi người dùng tự chọn mã hex (rỗng nếu dùng màu dựng sẵn). */
  protected dotStyle(color: string): string {
    return eventColorStyle(color);
  }
}
