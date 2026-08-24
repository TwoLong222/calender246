// ThemeService: quản lý giao diện Sáng/Tối/Theo hệ thống.
// Thêm/bỏ class 'dark' trên <html>. Nhớ lựa chọn vào localStorage để mở lại vẫn giữ
// (và tránh nhấp nháy trước khi settings tải xong từ server).
//
// - mode: 'light' | 'dark' | 'system'  (nguồn sự thật của lựa chọn)
// - isDark: giao diện tối có đang bật thật hay không (đã suy ra từ mode + hệ thống)

import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('system');
  readonly isDark = signal(false);

  private mql = window.matchMedia?.('(prefers-color-scheme: dark)');

  constructor() {
    // Mặc định là Tối khi chưa có lựa chọn nào được lưu (chưa từng mở app / đã xoá localStorage).
    const saved = (localStorage.getItem('theme') as ThemeMode | null) ?? 'dark';
    this.setMode(saved === 'light' || saved === 'dark' ? saved : 'system');

    // Khi ở chế độ "system", đổi theo cài đặt hệ điều hành trong lúc đang mở app.
    this.mql?.addEventListener?.('change', () => {
      if (this.mode() === 'system') this.applyDark(this.systemPrefersDark());
    });
  }

  /** Đặt chế độ giao diện + lưu lại. */
  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem('theme', mode);
    this.applyDark(mode === 'system' ? this.systemPrefersDark() : mode === 'dark');
  }

  /** Nút bật/tắt nhanh ở header: chuyển thẳng giữa Sáng và Tối. */
  toggle(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  private systemPrefersDark(): boolean {
    return this.mql?.matches ?? false;
  }

  private applyDark(dark: boolean): void {
    this.isDark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
  }
}
