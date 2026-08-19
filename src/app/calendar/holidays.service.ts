// HolidaysService: danh sách ngày lễ Việt Nam (2025-2029).
// - Ngày lễ Dương lịch (cố định): hardcode theo tháng/ngày.
// - Ngày lễ Âm lịch (Tết Nguyên đán, Giỗ Tổ, Phật Đản, Trung thu): hardcode
//   trước ngày Dương lịch tương ứng cho các năm 2025-2029 (Âm→Dương phức tạp,
//   không muốn kéo cả thư viện lịch âm cho đúng nhu cầu demo).
// - "isPublic" = ngày nghỉ chính thức (Bộ luật Lao động 2019).

import { Injectable } from '@angular/core';

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

/** Ngày lễ theo lịch Âm — bảng tra sẵn Dương lịch cho từng năm (yyyy-mm-dd) */
const LUNAR_TO_SOLAR: Record<string, string[]> = {
  // Tết Nguyên đán (mùng 1 Tết): thường nghỉ 5 ngày quanh đó
  'Tết Nguyên đán': [
    '2025-01-29', '2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13',
  ],
  // Giỗ Tổ Hùng Vương (10/3 Âm)
  'Giỗ Tổ Hùng Vương': [
    '2025-04-07', '2026-04-26', '2027-04-16', '2028-04-04', '2029-04-23',
  ],
  // Phật Đản (15/4 Âm)
  'Lễ Phật Đản': [
    '2025-05-12', '2026-05-31', '2027-05-20', '2028-05-08', '2029-05-27',
  ],
  // Tết Trung thu (15/8 Âm)
  'Tết Trung thu': [
    '2025-10-06', '2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22',
  ],
};

@Injectable({ providedIn: 'root' })
export class HolidaysService {
  /** Trả về ngày lễ (nếu có) cho ngày bất kỳ; null nếu không phải lễ */
  get(d: Date): Holiday | null {
    // Ưu tiên lễ Âm lịch (Tết, Giỗ Tổ...) vì thường quan trọng hơn
    const key = this.dayKey(d);
    for (const [name, dates] of Object.entries(LUNAR_TO_SOLAR)) {
      if (dates.includes(key)) {
        return { name, isPublic: name === 'Tết Nguyên đán' || name === 'Giỗ Tổ Hùng Vương' };
      }
    }
    // Sau đó check lễ Dương
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const found = FIXED_SOLAR.find((h) => h.month === m && h.day === day);
    return found ? { name: found.name, isPublic: found.isPublic } : null;
  }

  /** Ngày này có phải là ngày lễ không (tiện dùng trong template) */
  has(d: Date): boolean {
    return this.get(d) !== null;
  }

  /** Ngày lễ chính thức (được nghỉ) — dùng để tô đậm hơn/màu đỏ */
  isPublic(d: Date): boolean {
    return this.get(d)?.isPublic === true;
  }

  private dayKey(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
}
