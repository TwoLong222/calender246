// Đọc câu tìm kiếm theo NGÀY / GIỜ.
//
// Thanh tìm kiếm trước đây chỉ so chữ với tiêu đề/mô tả/địa điểm, nên gõ "28/8" hay
// "hôm nay" là không ra gì. File này biến những câu đó thành một KHOẢNG THỜI GIAN,
// rồi trang lịch lọc sự kiện chạm vào khoảng đó.
//
// Chỉ nhận dạng những cách viết người Việt hay gõ thật; câu nào không hiểu thì trả
// về null để quay lại tìm theo chữ như cũ.

export interface DateQuery {
  /** Đầu khoảng (đã gồm). */
  from: Date;
  /** Cuối khoảng (đã gồm). */
  to: Date;
  /** Nhãn hiện cho người dùng biết đang xem khoảng nào. */
  label: string;
  /** Giờ cụ thể (phút tính từ 00:00) nếu câu có nêu giờ, vd "15:30" hoặc "9h". */
  minuteOfDay?: number;
  /**
   * Câu chỉ nêu GIỜ, không nêu ngày ("13:00"). Khi đó tìm trên MỌI ngày chứ không bó
   * vào hôm nay — gõ "13:00" là muốn biết mình có gì lúc 13h, không riêng gì hôm nay.
   */
  timeOnly?: boolean;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const DMY = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

/** Bỏ dấu tiếng Việt để "thứ hai" và "thu hai" đều khớp. */
function noAccent(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** Ngày trong tuần: 0 = Chủ nhật. Khớp cả "thứ 2", "thứ hai", "t2", "chủ nhật". */
const WEEKDAYS: { re: RegExp; dow: number; name: string }[] = [
  { re: /^(chu nhat|cn|t8|thu 8)$/, dow: 0, name: 'Chủ nhật' },
  { re: /^(thu 2|thu hai|t2)$/, dow: 1, name: 'Thứ 2' },
  { re: /^(thu 3|thu ba|t3)$/, dow: 2, name: 'Thứ 3' },
  { re: /^(thu 4|thu tu|t4)$/, dow: 3, name: 'Thứ 4' },
  { re: /^(thu 5|thu nam|t5)$/, dow: 4, name: 'Thứ 5' },
  { re: /^(thu 6|thu sau|t6)$/, dow: 5, name: 'Thứ 6' },
  { re: /^(thu 7|thu bay|t7)$/, dow: 6, name: 'Thứ 7' },
];

const MONTH_NAMES = [
  'tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
  'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12',
];

/**
 * Đọc câu tìm kiếm. `today` truyền vào để kiểm thử được (không phụ thuộc đồng hồ máy).
 * Trả về null nếu câu không nói về thời gian.
 */
export function parseDateQuery(raw: string, today: Date = new Date()): DateQuery | null {
  let q = noAccent(raw.trim().toLowerCase()).replace(/\s+/g, ' ');
  if (!q) return null;

  // Tách phần giờ ra trước ("28/8 15:30", "mai 9h") rồi đọc phần ngày còn lại.
  let minuteOfDay: number | undefined;
  const timeMatch = q.match(/(?:^|\s)(\d{1,2})\s*(?::|h|g)\s*(\d{2})?(?![\d/])/);
  if (timeMatch) {
    const h = +timeMatch[1];
    const mi = timeMatch[2] ? +timeMatch[2] : 0;
    if (h <= 23 && mi <= 59) {
      minuteOfDay = h * 60 + mi;
      q = (q.slice(0, timeMatch.index ?? 0) + ' ' + q.slice((timeMatch.index ?? 0) + timeMatch[0].length)).trim();
    }
  }

  // Chỉ có giờ, không có ngày -> tra giờ đó trên MỌI ngày.
  // (Trước đây bó vào đúng hôm nay, nên gõ "13:00" mà cuộc họp 13h nằm hôm qua là
  //  báo "không tìm thấy" — sai với điều người dùng muốn hỏi.)
  if (!q && minuteOfDay != null) {
    const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
    const mm = String(minuteOfDay % 60).padStart(2, '0');
    return {
      from: new Date(1970, 0, 1),
      to: new Date(2999, 11, 31, 23, 59, 59, 999),
      label: `Lúc ${hh}:${mm} · mọi ngày`,
      minuteOfDay,
      timeOnly: true,
    };
  }

  const withTime = (from: Date, to: Date, label: string): DateQuery => ({ from, to, label, minuteOfDay });

  // ---- Từ chỉ ngày quen thuộc ----
  if (/^(hom nay|nay|today)$/.test(q)) return withTime(startOfDay(today), endOfDay(today), 'Hôm nay');
  if (/^(ngay mai|mai|tomorrow)$/.test(q)) {
    const d = addDays(today, 1);
    return withTime(startOfDay(d), endOfDay(d), `Ngày mai · ${DMY(d)}`);
  }
  if (/^(hom qua|qua|yesterday)$/.test(q)) {
    const d = addDays(today, -1);
    return withTime(startOfDay(d), endOfDay(d), `Hôm qua · ${DMY(d)}`);
  }
  if (/^(ngay kia|mot)$/.test(q)) {
    const d = addDays(today, 2);
    return withTime(startOfDay(d), endOfDay(d), `Ngày kia · ${DMY(d)}`);
  }
  if (/^hom kia$/.test(q)) {
    const d = addDays(today, -2);
    return withTime(startOfDay(d), endOfDay(d), `Hôm kia · ${DMY(d)}`);
  }

  // ---- Tuần ----
  const weekOffset = /^tuan nay$/.test(q) ? 0 : /^tuan sau|^tuan toi$/.test(q) ? 1 : /^tuan truoc$/.test(q) ? -1 : null;
  if (weekOffset !== null) {
    // Tuần bắt đầu từ Thứ 2 cho đúng thói quen ở Việt Nam.
    const dow = (today.getDay() + 6) % 7;
    const mon = addDays(today, -dow + weekOffset * 7);
    const label = weekOffset === 0 ? 'Tuần này' : weekOffset === 1 ? 'Tuần sau' : 'Tuần trước';
    return withTime(startOfDay(mon), endOfDay(addDays(mon, 6)), `${label} · ${DMY(mon)} – ${DMY(addDays(mon, 6))}`);
  }

  // ---- Tháng ----
  const monthOffset = /^thang nay$/.test(q) ? 0 : /^thang sau|^thang toi$/.test(q) ? 1 : /^thang truoc$/.test(q) ? -1 : null;
  if (monthOffset !== null) {
    const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return withTime(startOfDay(first), endOfDay(last), `${MONTH_NAMES[first.getMonth()]}/${first.getFullYear()}`);
  }

  // "tháng 8" hoặc "tháng 8/2026" hoặc "thang 8 2026"
  const mOnly = q.match(/^thang (\d{1,2})(?:[/ ](\d{4}))?$/);
  if (mOnly) {
    const mo = +mOnly[1];
    if (mo >= 1 && mo <= 12) {
      const year = mOnly[2] ? +mOnly[2] : today.getFullYear();
      const first = new Date(year, mo - 1, 1);
      const last = new Date(year, mo, 0);
      return withTime(startOfDay(first), endOfDay(last), `${MONTH_NAMES[mo - 1]}/${year}`);
    }
  }

  // ---- Thứ trong tuần: lấy ngày gần nhất SẮP TỚI (gồm cả hôm nay) ----
  for (const w of WEEKDAYS) {
    if (w.re.test(q)) {
      const diff = (w.dow - today.getDay() + 7) % 7;
      const d = addDays(today, diff);
      return withTime(startOfDay(d), endOfDay(d), `${w.name} · ${DMY(d)}`);
    }
  }

  // ---- Ngày cụ thể: 28/8, 28-8, 28.8, 28/8/2026, 2026-08-28 ----
  const iso = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    if (d.getMonth() === +iso[2] - 1 && d.getDate() === +iso[3]) {
      return withTime(startOfDay(d), endOfDay(d), DMY(d));
    }
  }

  const dm = q.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (dm) {
    const day = +dm[1];
    const mo = +dm[2];
    let year = dm[3] ? +dm[3] : today.getFullYear();
    if (dm[3] && dm[3].length === 2) year += 2000;
    const d = new Date(year, mo - 1, day);
    // Ngày không có thật (31/2) thì Date tự nhảy sang tháng sau -> loại bỏ.
    if (d.getDate() === day && d.getMonth() === mo - 1) {
      return withTime(startOfDay(d), endOfDay(d), DMY(d));
    }
  }

  // "ngày 28" -> ngày 28 của tháng đang xem
  const dOnly = q.match(/^ngay (\d{1,2})$/);
  if (dOnly) {
    const day = +dOnly[1];
    const d = new Date(today.getFullYear(), today.getMonth(), day);
    if (d.getDate() === day) return withTime(startOfDay(d), endOfDay(d), DMY(d));
  }

  return null;
}
