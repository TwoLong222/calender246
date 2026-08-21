// NotificationService: nhắc lịch NGAY TRONG APP.
// Cứ 30 giây (và mỗi khi danh sách event đổi) quét các sự kiện SẮP bắt đầu trong 10 phút tới
// mà chưa nhắc -> hiện toast góc màn hình + thông báo trình duyệt (nếu người dùng cho phép).
// Mỗi sự kiện chỉ nhắc 1 lần.

import { Injectable, effect, inject, signal } from '@angular/core';
import { CalendarStateService } from '../calendar/calendar-state.service';
import { CalendarEvent } from '../calendar/calendar.types';

interface Toast {
  id: string;
  title: string;
  timeLabel: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly state = inject(CalendarStateService);

  readonly toasts = signal<Toast[]>([]);
  private readonly notified = new Set<string>();

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
    this.toasts.update((t) => [...t, { id: toastId, title: e.title || '(không tiêu đề)', timeLabel }]);
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

  dismiss(id: string): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
