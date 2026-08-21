// Các hàm xử lý ngày tháng dùng chung cho các view Calendar.
// Không dùng thư viện ngoài (date-fns/dayjs) để giữ project nhẹ ở giai đoạn đầu.

export const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + n);
  return r;
}

/**
 * Trả về ngày đầu tuần chứa `d`.
 * weekStartsOn: 0 = Chủ Nhật (mặc định), 1 = Thứ Hai.
 */
export function startOfWeek(d: Date, weekStartsOn = 0): Date {
  const r = startOfDay(d);
  const diff = (r.getDay() - weekStartsOn + 7) % 7;
  r.setDate(r.getDate() - diff);
  return r;
}

/** Nhãn thứ trong tuần, xoay theo ngày bắt đầu tuần (0=CN, 1=T2). */
export function orderedWeekdayLabels(weekStartsOn = 0): string[] {
  return [...WEEKDAY_LABELS.slice(weekStartsOn), ...WEEKDAY_LABELS.slice(0, weekStartsOn)];
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** vd (12h): 0 -> "12 AM", 13 -> "1 PM". (24h): 13 -> "13:00". */
export function formatHourLabel(hour: number, is24h = false): string {
  if (is24h) return `${String(hour).padStart(2, '0')}:00`;
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}
