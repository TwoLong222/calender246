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
  { id: 'navy', name: 'Xanh navy', palette: { 50: '#eef2f8', 100: '#d7e0ef', 500: '#3a5ca0', 600: '#22407d', 700: '#1a3260', 800: '#132549' } },
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

/** Nền trang mặc định (tông giấy ấm, đồng bộ landing) khi không dùng theme dịp lễ. */
const DEFAULT_APP_BG = '#f5f3ee';

interface StoredAccent {
  /** id preset, 'custom', hoặc 'palette' (lưu nguyên bảng màu, vd theme dịp lễ). */
  id: string;
  /** màu gốc (ứng với sắc 600) khi id === 'custom'. */
  base?: string;
  /** bảng màu đầy đủ khi id === 'palette'. */
  palette?: AccentPalette;
  /** màu nền trang (khi id === 'palette' và có tint riêng). */
  bg?: string;
}

@Injectable({ providedIn: 'root' })
export class ThemeBuilderService {
  /** id đang chọn ('navy' mặc định, 'custom', hoặc 'palette'). */
  readonly accentId = signal<string>('navy');
  /** màu gốc khi dùng tùy chỉnh (hex, = sắc 600). */
  readonly customBase = signal<string>('#22407d');
  /** Bảng màu + nền ĐANG áp (dùng để reapply chính xác sau khi seasonal nhường lại). */
  private currentPalette: AccentPalette = ACCENT_PRESETS[0].palette;
  private currentBg: string = DEFAULT_APP_BG;

  constructor() {
    const saved = this.load();
    if (saved?.id === 'custom' && saved.base) {
      this.setCustom(saved.base);
    } else if (saved?.id === 'palette' && saved.palette) {
      this.setPalette(saved.palette, saved.bg, false);
    } else if (saved?.id) {
      this.setPreset(saved.id, false);
    }
  }

  /** Áp 1 preset theo id (nền trang về mặc định). */
  setPreset(id: string, persist = true): void {
    const preset = ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
    this.apply(preset.palette, DEFAULT_APP_BG);
    this.accentId.set(preset.id);
    this.customBase.set(preset.palette[600]);
    if (persist) this.save({ id: preset.id });
  }

  /** Áp màu tùy chỉnh từ 1 màu gốc (hex) — tự suy ra 6 sắc độ (nền trang về mặc định). */
  setCustom(baseHex: string): void {
    const palette = paletteFromBase(baseHex);
    this.apply(palette, DEFAULT_APP_BG);
    this.accentId.set('custom');
    this.customBase.set(baseHex);
    this.save({ id: 'custom', base: baseHex });
  }

  /** Áp + lưu nguyên 1 bảng màu + nền (vd chọn theme dịp lễ để dùng luôn). */
  setPalette(palette: AccentPalette, bg?: string, persist = true): void {
    this.apply(palette, bg ?? DEFAULT_APP_BG);
    this.accentId.set('palette');
    this.customBase.set(palette[600]);
    if (persist) this.save({ id: 'palette', palette, bg });
  }

  /** Về mặc định (xanh navy). */
  reset(): void {
    this.setPreset('navy');
  }

  /** Áp lại đúng màu người dùng đang chọn (dùng khi hết dịp lễ, seasonal nhường lại). */
  reapply(): void {
    this.apply(this.currentPalette, this.currentBg);
  }

  /** Áp trực tiếp 1 bảng màu + nền (seasonal phủ tạm, KHÔNG lưu và KHÔNG đổi current). */
  applyPalette(palette: AccentPalette, bg?: string): void {
    const root = document.documentElement;
    for (const k of VAR_KEYS) root.style.setProperty(`--accent-${k}`, palette[k]);
    root.style.setProperty('--app-bg', bg ?? DEFAULT_APP_BG);
  }

  private apply(palette: AccentPalette, bg: string): void {
    this.currentPalette = palette; // nhớ lại để reapply chính xác
    this.currentBg = bg;
    const root = document.documentElement;
    for (const k of VAR_KEYS) {
      root.style.setProperty(`--accent-${k}`, palette[k]);
    }
    root.style.setProperty('--app-bg', bg);
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
  // Màu gốc coi như sắc 600; các sắc khác chỉnh độ sáng (L) quanh nó. 600/700/800 được dùng
  // làm NỀN cho chữ TRẮNG (nút chính, huy hiệu "hôm nay"...) -> nếu người dùng chọn màu quá
  // sáng/nhạt, phải ép tối lại đủ để chữ trắng còn đọc được (WCAG AA ~4.5:1), không thì cả
  // app nhìn mờ/khó đọc ở đúng những chỗ quan trọng nhất.
  const l600 = darkenForWhiteText(h, s, l);
  const l700 = darkenForWhiteText(h, s, clamp(l600 - 9, 8, 100));
  const l800 = darkenForWhiteText(h, s, clamp(l600 - 17, 6, 100));
  return {
    50: hslToHex(h, Math.min(s, 55), 96),
    100: hslToHex(h, Math.min(s, 60), 91),
    500: hslToHex(h, s, clamp(l600 + 8, 0, 92)),
    600: hslToHex(h, s, l600),
    700: hslToHex(h, s, l700),
    800: hslToHex(h, s, l800),
  };
}

/** Giảm dần độ sáng (L) tới khi nền đủ tối để chữ trắng đọc được (tỉ lệ tương phản tối thiểu
 *  4.5:1 theo WCAG AA) — chặn ĐÁY 5% để không bao giờ ép về đen tuyệt đối dù màu gốc rất sáng. */
function darkenForWhiteText(h: number, s: number, l: number, minRatio = 4.5): number {
  let cur = l;
  while (cur > 5 && contrastWithWhite(h, s, cur) < minRatio) cur -= 2;
  return cur;
}

function contrastWithWhite(h: number, s: number, l: number): number {
  const [r, g, b] = hslToRgb(h, s, l);
  const lum = relLuminance(r, g, b);
  return 1.05 / (lum + 0.05); // luminance của trắng = 1
}

function relLuminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
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

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  const to = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Độ sáng tương đối (WCAG) của một mã hex — 0 = đen, 1 = trắng.
 * Dùng để đoán màu nhấn có đọc được trên nền sáng / nền tối hay không.
 */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Màu nhấn này có hợp với chế độ đang bật không.
 *
 * Màu nhấn được dùng làm NỀN nút với chữ trắng, đồng thời làm màu chữ liên kết trên nền trang.
 *  - Quá tối (lum < 0.06): trên nền TỐI gần như chìm vào nền -> chỉ hợp nền sáng.
 *  - Quá sáng (lum > 0.45): trên nền SÁNG thì chữ trắng trên nút bị chói khó đọc -> chỉ hợp nền tối.
 *  - Ở giữa: dùng được cả hai.
 */
export function accentFitsTheme(hex600: string, isDark: boolean): boolean {
  const lum = relativeLuminance(hex600);
  if (lum < 0.06) return !isDark; // màu rất tối
  if (lum > 0.45) return isDark; // màu rất sáng
  return true;
}
