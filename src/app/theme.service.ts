// ThemeService: quản lý chế độ Sáng/Tối. Thêm/bỏ class 'dark' trên thẻ <html>,
// nhớ lựa chọn vào localStorage để lần sau mở lại vẫn giữ.

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(false);

  constructor() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.apply(saved ? saved === 'dark' : prefersDark);
  }

  toggle(): void {
    this.apply(!this.isDark());
  }

  private apply(dark: boolean): void {
    this.isDark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }
}
