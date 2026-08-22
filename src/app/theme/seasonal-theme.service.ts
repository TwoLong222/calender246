// SeasonalThemeService: tự đổi "tông" giao diện theo dịp lễ.
//
// Khi bật (mặc định), nếu hôm nay rơi vào 1 dịp lễ (Tết, Trung Thu, Halloween,
// Giáng sinh...) thì phủ tạm bảng màu nhấn của dịp đó + hiện emoji/nhãn lễ hội.
// Hết dịp -> trả lại đúng màu người dùng chọn (ThemeBuilderService.reapply).
//
// Ngày Tết/Trung Thu tính động qua lunar.util nên đúng mọi năm.

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { solarToLunar } from '../lunar/lunar.util';
import { AccentPalette, ThemeBuilderService } from './theme-builder.service';

export interface Season {
  id: string;
  name: string;
  emoji: string;
  palette: AccentPalette;
  /** Màu nền cả trang (tint nhẹ hợp tông dịp lễ, vẫn dễ đọc). */
  bg: string;
  /** Mô tả thời gian áp dụng (cho UI). */
  when: string;
  /** Có đang trong dịp này không (theo 1 ngày cho trước). */
  isActive: (d: Date) => boolean;
}

/** Kiểm tra ngày dương d có rơi vào (ngày/tháng âm) trong khoảng không. */
function lunarBetween(d: Date, month: number, dayFrom: number, dayTo: number): boolean {
  const l = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
  return !l.leap && l.month === month && l.day >= dayFrom && l.day <= dayTo;
}

export const SEASONS: Season[] = [
  {
    id: 'tet',
    name: 'Tết Nguyên đán',
    emoji: '🧧',
    when: 'Từ 23 tháng Chạp đến mùng 7 Tết (âm lịch)',
    palette: { 50: '#fff1f0', 100: '#ffccc7', 500: '#ff4d4f', 600: '#cf1322', 700: '#a8071a', 800: '#820014' },
    bg: '#fff1f0',
    isActive: (d) => {
      const l = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
      if (l.leap) return false;
      return (l.month === 12 && l.day >= 23) || (l.month === 1 && l.day <= 7);
    },
  },
  {
    id: 'trungthu',
    name: 'Tết Trung thu',
    emoji: '🥮',
    when: 'Quanh Rằm tháng 8 (âm lịch)',
    palette: { 50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e' },
    bg: '#fffbeb',
    isActive: (d) => lunarBetween(d, 8, 13, 16),
  },
  {
    id: 'halloween',
    name: 'Halloween',
    emoji: '🎃',
    when: '25–31 tháng 10 (dương lịch)',
    palette: { 50: '#fff7ed', 100: '#ffedd5', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#7c2d12' },
    bg: '#fff4e6',
    isActive: (d) => d.getMonth() === 9 && d.getDate() >= 25 && d.getDate() <= 31,
  },
  {
    id: 'christmas',
    name: 'Giáng sinh',
    emoji: '🎄',
    when: '20–26 tháng 12 (dương lịch)',
    palette: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46' },
    bg: '#f0fdf4',
    isActive: (d) => d.getMonth() === 11 && d.getDate() >= 20 && d.getDate() <= 26,
  },
  {
    id: 'newyear',
    name: 'Năm mới Dương lịch',
    emoji: '🎉',
    when: '31/12 – 1/1 (dương lịch)',
    palette: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3' },
    bg: '#eef2ff',
    isActive: (d) => (d.getMonth() === 11 && d.getDate() === 31) || (d.getMonth() === 0 && d.getDate() === 1),
  },
];

const STORAGE_KEY = 'seasonal-theme-auto';

@Injectable({ providedIn: 'root' })
export class SeasonalThemeService {
  private readonly themeBuilder = inject(ThemeBuilderService);

  /** Bật tự đổi theo dịp lễ (mặc định bật). */
  readonly autoEnabled = signal<boolean>(this.loadAuto());

  /** Dịp lễ đang diễn ra hôm nay (null nếu không có), chỉ khi autoEnabled. */
  readonly activeSeason = computed<Season | null>(() => {
    if (!this.autoEnabled()) return null;
    const now = new Date();
    return SEASONS.find((s) => s.isActive(now)) ?? null;
  });

  constructor() {
    // Áp/gỡ màu + nền dịp lễ mỗi khi trạng thái đổi.
    effect(() => {
      const s = this.activeSeason();
      if (s) this.themeBuilder.applyPalette(s.palette, s.bg);
      else this.themeBuilder.reapply();
    });
  }

  setAuto(on: boolean): void {
    this.autoEnabled.set(on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
      /* bỏ qua nếu localStorage tắt */
    }
  }

  /** Xem thử 1 dịp (áp màu + nền tạm, không lưu). Gọi clearPreview() để trả lại. */
  preview(season: Season): void {
    this.themeBuilder.applyPalette(season.palette, season.bg);
  }
  clearPreview(): void {
    const s = this.activeSeason();
    if (s) this.themeBuilder.applyPalette(s.palette, s.bg);
    else this.themeBuilder.reapply();
  }

  private loadAuto(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== '0'; // mặc định bật
    } catch {
      return true;
    }
  }
}
