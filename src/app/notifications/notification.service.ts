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
  private readonly LEAD_MS = 10 * 60 * 1000; // nhắc khi còn <= 10 phút tới giờ bắt đầu

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
      const diff = e.start.getTime() - now;
      if (diff > 0 && diff <= this.LEAD_MS) {
        this.notified.add(e.id);
        this.fire(e);
      }
    }
  }

  private fire(e: CalendarEvent): void {
    const timeLabel = e.start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const toastId = `${e.id}:${Date.now()}`;
    this.toasts.update((t) => [...t, { id: toastId, title: e.title || '(không tiêu đề)', timeLabel }]);
    setTimeout(() => this.dismiss(toastId), 12_000); // tự ẩn sau 12s

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`⏰ Sắp tới: ${e.title || 'Sự kiện'}`, { body: `Bắt đầu lúc ${timeLabel}` });
      } catch {
        /* một số trình duyệt yêu cầu ServiceWorker cho Notification — bỏ qua nếu lỗi */
      }
    }
  }

  dismiss(id: string): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
