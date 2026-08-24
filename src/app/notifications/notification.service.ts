// NotificationService: nhắc lịch NGAY TRONG APP.
// Cứ 30 giây (và mỗi khi danh sách event đổi) quét các sự kiện SẮP bắt đầu trong 10 phút tới
// mà chưa nhắc -> hiện toast góc màn hình + thông báo trình duyệt (nếu người dùng cho phép).
// Mỗi sự kiện chỉ nhắc 1 lần.

import { Injectable, effect, inject, signal } from '@angular/core';
import { CalendarStateService } from '../calendar/calendar-state.service';
import { CalendarEvent } from '../calendar/calendar.types';
import { AttachmentsApiService } from '../calendar/attachments-api.service';
import { SupabaseService } from '../auth/supabase.service';
import { TranslateService } from '../i18n/translate.service';
import { SettingsService } from '../settings/settings.service';

interface Toast {
  id: string;
  /** 'event' nhắc lịch; 'file' tài liệu; 'chat' tin nhắn; 'invite' lời mời; 'cancelled' hủy; 'changed' cập nhật. */
  kind: 'event' | 'file' | 'chat' | 'invite' | 'cancelled' | 'changed';
  title: string;
  /** Dòng phụ: giờ bắt đầu (event), tên sự kiện (file), hoặc email người mời (invite). */
  detail?: string;
  /** Nội dung tin nhắn (chat). */
  body?: string;
  /** ID sự kiện — dùng cho toast 'invite' để bấm Đồng ý/Từ chối ngay. */
  eventId?: string;
}

/** Thông báo LƯU LẠI trong chuông (khác toast thoáng qua). */
export interface ChangeNotice {
  id: string;
  eventId: string;
  title: string;
  /** Các dòng mô tả thay đổi, vd: "Ngày giờ bắt đầu → 14:00 1/9". */
  changes: string[];
  at: number;
}
export interface CancelNotice {
  id: string;
  title: string;
  at: number;
}

const SEEN_FILES_KEY = 'notified-file-open';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly state = inject(CalendarStateService);
  private readonly attachmentsApi = inject(AttachmentsApiService);
  private readonly supabase = inject(SupabaseService);
  private readonly tr = inject(TranslateService);
  private readonly settings = inject(SettingsService);

  /** Ảnh chụp các sự kiện DO NGƯỜI KHÁC mời mình (id -> thông tin) để phát hiện HỦY/ĐỔI. */
  private readonly invitedSnapshot = new Map<string, { title: string; start: number; end: number; location: string }>();

  /** Danh sách thông báo LƯU trong chuông: sự kiện bị SỬA và bị HỦY (giữ tối đa 30 cái mới nhất). */
  readonly changeNotices = signal<ChangeNotice[]>([]);
  readonly cancelNotices = signal<CancelNotice[]>([]);

  readonly toasts = signal<Toast[]>([]);
  private readonly notified = new Set<string>();
  /** Các lời mời đã hiện toast (tránh báo lại). */
  private readonly notifiedInvites = new Set<string>();
  /** Mốc mở app: trong ~4s đầu chỉ GHI NHẬN lời mời đang có, không bắn toast (tránh spam lúc mở). */
  private readonly startedAt = Date.now();

  constructor() {
    // KHÔNG tự xin quyền thông báo lúc mở app — chỉ xin khi người dùng bật công tắc
    // "Thông báo trình duyệt" trong Cài đặt (toggleBrowserNotif). Nhờ vậy chưa bật thì
    // không có thông báo desktop nào bật ra.
    setInterval(() => this.check(), 30_000);
    // Quét lại ngay khi danh sách event thay đổi (tạo/sửa/realtime)
    effect(() => {
      this.state.events();
      this.check();
    });
    // Bắn toast khi có LỜI MỜI MỚI (realtime). Bỏ qua các lời mời đã có sẵn lúc mở app.
    effect(() => {
      const invs = this.state.invitations();
      const warmup = Date.now() - this.startedAt < 4000;
      for (const iv of invs) {
        if (this.notifiedInvites.has(iv.eventId)) continue;
        this.notifiedInvites.add(iv.eventId);
        if (!warmup) this.fireInvite(iv);
      }
    });
    // Phát hiện HỦY/ĐỔI sự kiện mình được mời (do NGƯỜI KHÁC thao tác) -> toast real-time.
    effect(() => {
      const events = this.state.events();
      const me = this.supabase.user()?.email?.toLowerCase();
      if (!me) return;
      // Chỉ xét sự kiện do người khác tạo mà mình được mời (creatorEmail có & khác mình).
      // -> tự loại trừ thay đổi do CHÍNH mình thực hiện.
      const invited = events.filter(
        (e) => e.creatorEmail && e.creatorEmail.toLowerCase() !== me && !e.deletedAt,
      );
      const warmup = Date.now() - this.startedAt < 4000;
      const next = new Map<string, { title: string; start: number; end: number; location: string }>();
      for (const e of invited) {
        next.set(e.id, { title: e.title, start: e.start.getTime(), end: e.end.getTime(), location: e.location ?? '' });
      }
      if (!warmup) {
        // ĐỔI: có ở cả 2 nhưng khác nội dung
        for (const e of invited) {
          const prev = this.invitedSnapshot.get(e.id);
          if (!prev) continue; // mới xuất hiện (vừa Đồng ý) -> không phải "đổi"
          const lines = this.describeChanges(prev, next.get(e.id)!, e);
          if (lines.length) this.fireChanged(e.id, e.title, lines);
        }
        // HỦY: có trong snapshot cũ nhưng biến mất khỏi danh sách (creator xóa/gỡ mình)
        for (const [id, prev] of this.invitedSnapshot) {
          if (!next.has(id)) this.fireCancelled(prev.title);
        }
      }
      this.invitedSnapshot.clear();
      for (const [id, v] of next) this.invitedSnapshot.set(id, v);
    });
    // Quét tài liệu vừa mở: ngay khi mở app + mỗi 5 phút.
    setTimeout(() => this.checkAttachments(), 4_000);
    setInterval(() => this.checkAttachments(), 5 * 60_000);
  }

  /** Quét tài liệu đính kèm vừa tới giờ mở -> toast (mỗi file chỉ báo 1 lần/ máy). */
  private checkAttachments(): void {
    this.attachmentsApi.recentAvailable().subscribe({
      next: (list) => {
        const seen = this.loadSeenFiles();
        for (const a of list) {
          if (seen.has(a.id)) continue;
          seen.add(a.id);
          this.fireFile(a.file_name, a.event_title);
        }
        this.saveSeenFiles(seen);
      },
      error: () => {},
    });
  }

  private loadSeenFiles(): Set<string> {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(SEEN_FILES_KEY) ?? '[]'));
    } catch {
      return new Set<string>();
    }
  }
  private saveSeenFiles(s: Set<string>): void {
    try {
      // giữ tối đa 200 id gần nhất cho gọn
      localStorage.setItem(SEEN_FILES_KEY, JSON.stringify([...s].slice(-200)));
    } catch {
      /* bỏ qua */
    }
  }

  private fireFile(fileName: string, eventTitle: string): void {
    const toastId = `file:${fileName}:${Date.now()}`;
    this.toasts.update((t) => [...t, { id: toastId, kind: 'file', title: fileName, detail: eventTitle }]);
    setTimeout(() => this.dismiss(toastId), 15_000);
    this.playBeep();
    if (this.canDesktopNotify()) {
      try {
        new Notification(`📎 Tài liệu đã mở: ${fileName}`, { body: eventTitle });
      } catch {
        /* bỏ qua */
      }
    }
  }

  /** Toast LỜI MỜI mới — có nút Đồng ý/Từ chối ngay trên toast. Ẩn sau 60s. */
  private fireInvite(iv: { eventId: string; title: string; creatorEmail: string | null }): void {
    const toastId = `invite:${iv.eventId}:${Date.now()}`;
    this.toasts.update((t) => [
      ...t,
      { id: toastId, kind: 'invite', title: iv.title || '(không tiêu đề)', detail: iv.creatorEmail ?? '', eventId: iv.eventId },
    ]);
    setTimeout(() => this.dismiss(toastId), 60_000);
    this.playBeep();
    if (this.canDesktopNotify()) {
      try {
        new Notification(`📩 Lời mời mới: ${iv.title || 'Sự kiện'}`, { body: iv.creatorEmail ? `Từ ${iv.creatorEmail}` : '' });
      } catch {
        /* bỏ qua */
      }
    }
  }

  private fmtDateTime(d: Date, allDay: boolean): string {
    return allDay ? this.settings.formatDate(d) : `${this.settings.formatDate(d)} ${this.settings.formatTime(d)}`;
  }

  /** Mô tả từng thay đổi thành các DÒNG riêng (ngày giờ bắt đầu / kết thúc tách biệt). */
  private describeChanges(
    prev: { title: string; start: number; end: number; location: string },
    cur: { title: string; start: number; end: number; location: string },
    e: CalendarEvent,
  ): string[] {
    const lines: string[] = [];
    if (prev.title !== cur.title) lines.push(`${this.tr.t('notif.fTitle')} → ${cur.title || '(trống)'}`);
    if (prev.start !== cur.start) lines.push(`${this.tr.t('notif.fStart')} → ${this.fmtDateTime(e.start, e.isAllDay)}`);
    if (prev.end !== cur.end) lines.push(`${this.tr.t('notif.fEnd')} → ${this.fmtDateTime(e.end, e.isAllDay)}`);
    if (prev.location !== cur.location) {
      lines.push(cur.location ? `${this.tr.t('notif.fLocation')} → ${cur.location}` : `${this.tr.t('notif.fLocation')} (đã gỡ)`);
    }
    return lines;
  }

  /** Sự kiện mình được mời đã bị người tạo HỦY -> toast + lưu vào chuông. */
  private fireCancelled(title: string): void {
    const safeTitle = title || '(không tiêu đề)';
    const id = `cancel:${safeTitle}:${Date.now()}`;
    this.cancelNotices.update((l) => [{ id, title: safeTitle, at: Date.now() }, ...l].slice(0, 30));
    this.toasts.update((t) => [...t, { id, kind: 'cancelled', title: this.tr.t('notif.cancelled'), detail: safeTitle }]);
    setTimeout(() => this.dismiss(id), 30_000);
    this.playBeep();
    if (this.canDesktopNotify()) {
      try {
        new Notification(`❌ ${this.tr.t('notif.cancelled')}`, { body: safeTitle });
      } catch {
        /* bỏ qua */
      }
    }
  }

  /** Sự kiện mình được mời vừa bị SỬA -> toast + lưu vào chuông (kèm các dòng thay đổi). */
  private fireChanged(eventId: string, title: string, lines: string[]): void {
    const safeTitle = title || '(không tiêu đề)';
    const id = `change:${eventId}:${Date.now()}`;
    this.changeNotices.update((l) => [{ id, eventId, title: safeTitle, changes: lines, at: Date.now() }, ...l].slice(0, 30));
    this.toasts.update((t) => [...t, { id, kind: 'changed', title: safeTitle, body: lines.join(', ') }]);
    setTimeout(() => this.dismiss(id), 30_000);
    this.playBeep();
    if (this.canDesktopNotify()) {
      try {
        new Notification(`✏️ ${this.tr.t('notif.changed')}: ${safeTitle}`, { body: lines.join(', ') });
      } catch {
        /* bỏ qua */
      }
    }
  }

  /** Xóa 1 thông báo "bị sửa" khỏi chuông. */
  dismissChange(id: string): void {
    this.changeNotices.update((l) => l.filter((x) => x.id !== id));
  }
  /** Xóa 1 thông báo "bị hủy" khỏi chuông. */
  dismissCancel(id: string): void {
    this.cancelNotices.update((l) => l.filter((x) => x.id !== id));
  }
  /** Xóa tất cả thông báo hủy/sửa đã lưu. */
  clearNotices(): void {
    this.changeNotices.set([]);
    this.cancelNotices.set([]);
  }

  private check(): void {
    const now = Date.now();
    for (const e of this.state.events()) {
      if (e.isAllDay || this.notified.has(e.id)) continue;
      // Chỉ nhắc sự kiện CÓ đặt nhắc, và đúng số phút đã chọn (5/15/30... phút trước).
      // Để "Không" (reminderMinutes == null) -> không báo toast.
      if (e.reminderMinutes == null) continue;
      const leadMs = e.reminderMinutes * 60 * 1000;
      const diff = e.start.getTime() - now;
      if (diff > 0 && diff <= leadMs) {
        this.notified.add(e.id);
        this.fire(e);
      }
    }
  }

  private fire(e: CalendarEvent): void {
    const timeLabel = e.start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const toastId = `${e.id}:${Date.now()}`;
    this.toasts.update((t) => [...t, { id: toastId, kind: 'event', title: e.title || '(không tiêu đề)', detail: timeLabel }]);
    setTimeout(() => this.dismiss(toastId), 15_000); // tự ẩn sau 15s

    this.playBeep();

    if (this.canDesktopNotify()) {
      try {
        new Notification(`⏰ Sắp tới: ${e.title || 'Sự kiện'}`, { body: `Bắt đầu lúc ${timeLabel}` });
      } catch {
        /* một số trình duyệt yêu cầu ServiceWorker cho Notification — bỏ qua nếu lỗi */
      }
    }
  }

  /** Kêu 2 tiếng bíp bằng Web Audio (không cần file âm thanh) */
  private playBeep(): void {
    try {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      ctx.resume?.();
      const beep = (at: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.2);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.22);
      };
      beep(0);
      beep(0.28);
      setTimeout(() => ctx.close(), 800);
    } catch {
      /* trình duyệt chặn âm thanh khi chưa có tương tác -> bỏ qua */
    }
  }

  /**
   * Thông báo chung (dùng cho tin nhắn nhóm mới):
   * - Luôn hiện toast nổi trong app + kêu bíp nhẹ.
   * - Nếu người dùng đang ở tab/cửa sổ KHÁC (tab ẩn) và đã cấp quyền -> báo thêm desktop.
   */
  notifyMessage(title: string, body: string): void {
    const toastId = `chat:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    this.toasts.update((t) => [...t, { id: toastId, title, body, kind: 'chat' }]);
    setTimeout(() => this.dismiss(toastId), 8_000); // tự ẩn sau 8s
    this.playBeep();

    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (hidden && this.canDesktopNotify()) {
      try {
        new Notification(title, { body });
      } catch {
        /* một số trình duyệt yêu cầu ServiceWorker cho Notification — bỏ qua nếu lỗi */
      }
    }
  }

  dismiss(id: string): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  /**
   * Chỉ bắn thông báo DESKTOP (Notification API của trình duyệt) khi CẢ HAI điều kiện:
   *  1) Người dùng đã BẬT công tắc "Thông báo trình duyệt" trong Cài đặt.
   *  2) Trình duyệt đã cấp quyền.
   * Toast nổi trong app + tiếng bíp vẫn hiện bình thường (đó là UI của chính app).
   */
  private canDesktopNotify(): boolean {
    return (
      this.settings.settings().browser_notifications === true &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    );
  }
}
