// Helper màu sự kiện — dùng CHUNG cho mọi chỗ vẽ chip/chấm màu.
//
// Màu của sự kiện có 2 dạng:
//   1. Tên màu dựng sẵn ('sky' | 'violet' | ...) -> đổi ra class Tailwind.
//   2. Mã hex người dùng tự chọn ('#ff8800')     -> đặt thẳng vào style background-color.
//
// Vì Tailwind biên dịch tĩnh nên KHÔNG thể sinh class từ hex; do đó template phải bind
// cả hai: [class]="eventColorClass(c)" [style.background-color]="eventColorStyle(c)".

/** Bảng màu dựng sẵn (giữ nguyên như trước để dữ liệu cũ vẫn hiển thị đúng). */
const NAMED: Record<string, string> = {
  sky: 'bg-sky-600',
  violet: 'bg-violet-600',
  emerald: 'bg-emerald-600',
  rose: 'bg-rose-600',
  amber: 'bg-amber-600',
};

/** Mã hex tương ứng các tên trên — dùng cho <input type="color"> và cho ô xem trước. */
const NAMED_HEX: Record<string, string> = {
  sky: '#0284c7',
  violet: '#7c3aed',
  emerald: '#059669',
  rose: '#e11d48',
  amber: '#d97706',
};

/** Màu tự chọn là chuỗi hex dạng #rgb hoặc #rrggbb. */
export function isCustomColor(color: string | undefined | null): boolean {
  return !!color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color);
}

/** Class Tailwind cho màu dựng sẵn; rỗng nếu là màu hex tự chọn (đã vẽ bằng style). */
export function eventColorClass(color: string | undefined | null): string {
  if (isCustomColor(color)) return '';
  return NAMED[color ?? ''] ?? NAMED['sky'];
}

/** Giá trị background-color cho màu hex tự chọn; rỗng nếu dùng class Tailwind. */
export function eventColorStyle(color: string | undefined | null): string {
  return isCustomColor(color) ? (color as string) : '';
}

/** Luôn trả về 1 mã hex — dùng làm giá trị khởi tạo cho <input type="color">. */
export function eventColorHex(color: string | undefined | null): string {
  if (isCustomColor(color)) return color as string;
  return NAMED_HEX[color ?? ''] ?? NAMED_HEX['sky'];
}
