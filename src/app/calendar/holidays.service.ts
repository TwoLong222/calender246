// HolidaysService: ngày lễ Việt Nam — tính ĐỘNG cho mọi năm.
// - Lễ Dương lịch (cố định): theo tháng/ngày.
// - Lễ Âm lịch (Tết, Giỗ Tổ, Phật Đản, Trung thu...): đổi ngày Dương -> Âm bằng
//   bộ chuyển đổi lunar.util rồi so ngày/tháng Âm. Không còn bảng tra cứng, đúng
//   cho mọi năm (không giới hạn 2025-2029 như bản cũ).
// - "isPublic" = ngày nghỉ chính thức (Bộ luật Lao động 2019).

import { Injectable } from '@angular/core';
import { solarToLunar } from '../lunar/lunar.util';

export interface Holiday {
  name: string;
  isPublic: boolean;
}

/** Ngày lễ có ngày/tháng CỐ ĐỊNH theo Dương lịch */
const FIXED_SOLAR: { month: number; day: number; name: string; isPublic: boolean }[] = [
  { month: 1, day: 1, name: 'Tết Dương lịch', isPublic: true },
  { month: 2, day: 14, name: 'Valentine', isPublic: false },
  { month: 3, day: 8, name: 'Quốc tế Phụ nữ', isPublic: false },
  { month: 4, day: 30, name: 'Ngày Giải phóng miền Nam', isPublic: true },
  { month: 5, day: 1, name: 'Quốc tế Lao động', isPublic: true },
  { month: 6, day: 1, name: 'Quốc tế Thiếu nhi', isPublic: false },
  { month: 9, day: 2, name: 'Quốc khánh', isPublic: true },
  { month: 10, day: 20, name: 'Ngày Phụ nữ Việt Nam', isPublic: false },
  { month: 11, day: 20, name: 'Ngày Nhà giáo Việt Nam', isPublic: false },
  { month: 12, day: 22, name: 'Ngày Quân đội Nhân dân', isPublic: false },
  { month: 12, day: 24, name: 'Đêm Giáng sinh', isPublic: false },
  { month: 12, day: 25, name: 'Giáng sinh', isPublic: false },
];

/** Ngày lễ theo lịch ÂM — xác định bằng NGÀY/THÁNG âm lịch (đúng cho mọi năm) */
const LUNAR_HOLIDAYS: { day: number; month: number; name: string; isPublic: boolean }[] = [
  { day: 1, month: 1, name: 'Tết Nguyên đán', isPublic: true },
  { day: 2, month: 1, name: 'Mùng 2 Tết', isPublic: true },
  { day: 3, month: 1, name: 'Mùng 3 Tết', isPublic: true },
  { day: 15, month: 1, name: 'Tết Nguyên tiêu (Rằm tháng Giêng)', isPublic: false },
  { day: 10, month: 3, name: 'Giỗ Tổ Hùng Vương', isPublic: true },
  { day: 15, month: 4, name: 'Lễ Phật Đản', isPublic: false },
  { day: 5, month: 5, name: 'Tết Đoan Ngọ', isPublic: false },
  { day: 15, month: 7, name: 'Lễ Vu Lan', isPublic: false },
  { day: 15, month: 8, name: 'Tết Trung thu', isPublic: false },
  { day: 23, month: 12, name: 'Ông Công Ông Táo', isPublic: false },
];

@Injectable({ providedIn: 'root' })
export class HolidaysService {
  /** Trả về ngày lễ (nếu có) cho ngày bất kỳ; null nếu không phải lễ. Ưu tiên lễ Âm. */
  get(d: Date): Holiday | null {
    const lunar = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
    if (!lunar.leap) {
      const h = LUNAR_HOLIDAYS.find((x) => x.day === lunar.day && x.month === lunar.month);
      if (h) return { name: h.name, isPublic: h.isPublic };
    }
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const found = FIXED_SOLAR.find((h) => h.month === m && h.day === day);
    return found ? { name: found.name, isPublic: found.isPublic } : null;
  }

  /** Ngày này có phải là ngày lễ không (tiện dùng trong template) */
  has(d: Date): boolean {
    return this.get(d) !== null;
  }

  /** Ngày lễ chính thức (được nghỉ) — dùng để tô đậm/màu đỏ */
  isPublic(d: Date): boolean {
    return this.get(d)?.isPublic === true;
  }
}
