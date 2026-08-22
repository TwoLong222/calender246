// ThemeBuilderService: cho phép người dùng tự chọn MÀU NHẤN của lịch.
//
// App dùng "blue" làm màu nhấn duy nhất; styles.css đã remap các class blue-*
// sang biến CSS --accent-*. Service này chỉ cần set 6 biến đó trên <html> là đổi
// màu toàn app. Lưu lựa chọn vào localStorage (không cần backend/migration) và áp
// ngay khi khởi động để tránh nhấp nháy.

import { Injectable, signal } from '@angular/core';

/** Bảng 6 sắc độ của một màu nhấn. */
export interface AccentPalette {
  50: string;
  100: string;
  500: string;
  600: string;
  700: string;
  800: string;
}

export interface AccentPreset {
  id: string;
  name: string;
  palette: AccentPalette;
}

/** Các preset dựng sẵn (lấy từ bảng màu Tailwind). */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'blue', name: 'Xanh dương', palette: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af' } },
  { id: 'indigo', name: 'Chàm', palette: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3' } },
  { id: 'violet', name: 'Tím', palette: { 50: '#f5f3ff', 100: '#ede9fe', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6' } },
  { id: 'emerald', name: 'Xanh lá', palette: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46' } },
  { id: 'teal', name: 'Xanh ngọc', palette: { 50: '#f0fdfa', 100: '#ccfbf1', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59' } },
  { id: 'rose', name: 'Hồng', palette: { 50: '#fff1f2', 100: '#ffe4e6', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239' } },
  { id: 'red', name: 'Đỏ', palette: { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b' } },
  { id: 'orange', name: 'Cam', palette: { 50: '#fff7ed', 100: '#ffedd5', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412' } },
];

const STORAGE_KEY = 'accent-theme';
const VAR_KEYS: (keyof AccentPalette)[] = [50, 100, 500, 600, 700, 800];

interface StoredAccent {
  /** id preset, 'custom', hoặc 'palette' (lưu nguyên bảng màu, vd theme dịp lễ). */
  id: string;
  /** màu gốc (ứng với sắc 600) khi id === 'custom'. */
  base?: string;
  /** bảng màu đầy đủ khi id === 'palette'. */
  palette?: AccentPalette;
}

@Injectable({ providedIn: 'root' })
export class ThemeBuilderService {
  /** id đang chọn ('blue' mặc định, 'custom', hoặc 'palette'). */
  readonly accentId = signal<string>('blue');
  /** màu gốc khi dùng tùy chỉnh (hex, = sắc 600). */
  readonly customBase = signal<string>('#2563eb');
  /** Bảng màu ĐANG áp (dùng để reapply chính xác sau khi seasonal nhường lại). */
  private currentPalette: AccentPalette = ACCENT_PRESETS[0].palette;

  constructor() {
    const saved = this.load();
    if (saved?.id === 'custom' && saved.base) {
      this.setCustom(saved.base);
    } else if (saved?.id === 'palette' && saved.palette) {
      this.setPalette(saved.palette, false);
    } else if (saved?.id) {
      this.setPreset(saved.id, false);
    }
  }

  /** Áp 1 preset theo id. */
  setPreset(id: string, persist = true): void {
    const preset = ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
    this.apply(preset.palette);
    this.accentId.set(preset.id);
    this.customBase.set(preset.palette[600]);
    if (persist) this.save({ id: preset.id });
  }

  /** Áp màu tùy chỉnh từ 1 màu gốc (hex) — tự suy ra 6 sắc độ. */
  setCustom(baseHex: string): void {
    const palette = paletteFromBase(baseHex);
    this.apply(palette);
    this.accentId.set('custom');
    this.customBase.set(baseHex);
    this.save({ id: 'custom', base: baseHex });
  }

  /** Áp + lưu nguyên 1 bảng màu (vd chọn theme dịp lễ để dùng luôn). */
  setPalette(palette: AccentPalette, persist = true): void {
    this.apply(palette);
    this.accentId.set('palette');
    this.customBase.set(palette[600]);
    if (persist) this.save({ id: 'palette', palette });
  }

  /** Về mặc định (xanh dương). */
  reset(): void {
    this.setPreset('blue');
  }

  /** Áp lại đúng màu người dùng đang chọn (dùng khi hết dịp lễ, seasonal nhường lại). */
  reapply(): void {
    this.apply(this.currentPalette);
  }

  /** Áp trực tiếp 1 bảng màu (seasonal dùng để phủ tạm màu dịp lễ, KHÔNG lưu và KHÔNG đổi currentPalette). */
  applyPalette(palette: AccentPalette): void {
    const root = document.documentElement;
    for (const k of VAR_KEYS) root.style.setProperty(`--accent-${k}`, palette[k]);
  }

  private apply(palette: AccentPalette): void {
    this.currentPalette = palette; // nhớ lại để reapply chính xác
    const root = document.documentElement;
    for (const k of VAR_KEYS) {
      root.style.setProperty(`--accent-${k}`, palette[k]);
    }
  }

  private load(): StoredAccent | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredAccent) : null;
    } catch {
      return null;
    }
  }

  private save(v: StoredAccent): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      /* localStorage đầy/tắt -> bỏ qua, vẫn áp được trong phiên */
    }
  }
}

// ---- Suy ra bảng sắc độ từ 1 màu gốc (thao tác trên HSL) ----

function paletteFromBase(hex: string): AccentPalette {
  const { h, s, l } = hexToHsl(hex);
  // Màu gốc coi như sắc 600; các sắc khác chỉnh độ sáng (L) quanh nó.
  return {
    50: hslToHex(h, Math.min(s, 55), 96),
    100: hslToHex(h, Math.min(s, 60), 91),
    500: hslToHex(h, s, clamp(l + 8, 0, 92)),
    600: hslToHex(h, s, l),
    700: hslToHex(h, s, clamp(l - 9, 8, 100)),
    800: hslToHex(h, s, clamp(l - 17, 6, 100)),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
