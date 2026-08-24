// NotificationService: nhắc lịch NGAY TRONG APP.
// Cứ 30 giây (và mỗi khi danh sách event đổi) quét các sự kiện SẮP bắt đầu trong 10 phút tới
// mà chưa nhắc -> hiện toast góc màn hình + thông báo trình duyệt (nếu người dùng cho phép).
// Mỗi sự kiện chỉ nhắc 1 lần.

import { Injectable, effect, inject, signal } from '@angular/core';
import { CalendarStateService } from '../calendar/calendar-state.service';
import { CalendarEvent } from '../calendar/calendar.types';
import { AttachmentsApiService } from '../calendar/attachments-api.service';

interface Toast {
  id: string;
  /** 'event' = nhắc lịch; 'file' = tài liệu vừa mở; 'chat' = tin nhắn nhóm mới; 'invite' = lời mời sự kiện. */
  kind: 'event' | 'file' | 'chat' | 'invite';
  title: string;
  /** Dòng phụ: giờ bắt đầu (event), tên sự kiện (file), hoặc email người mời (invite). */
  detail?: string;
  /** Nội dung tin nhắn (chat). */
  body?: string;
  /** ID sự kiện — dùng cho toast 'invite' để bấm Đồng ý/Từ chối ngay. */
  eventId?: string;
}

const SEEN_FILES_KEY = 'notified-file-open';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly state = inject(CalendarStateService);
  private readonly attachmentsApi = inject(AttachmentsApiService);

  readonly toasts = signal<Toast[]>([]);
  private readonly notified = new Set<string>();
  /** Các lời mời đã hiện toast (tránh báo lại). */
  private readonly notifiedInvites = new Set<string>();
  /** Mốc mở app: trong ~4s đầu chỉ GHI NHẬN lời mời đang có, không bắn toast (tránh spam lúc mở). */
  private readonly startedAt = Date.now();

  constructor() {
    // Xin quyền thông báo trình duyệt (nếu chưa hỏi)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
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
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
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
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`📩 Lời mời mới: ${iv.title || 'Sự kiện'}`, { body: iv.creatorEmail ? `Từ ${iv.creatorEmail}` : '' });
      } catch {
        /* bỏ qua */
      }
    }
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

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
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
    if (hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
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
}
