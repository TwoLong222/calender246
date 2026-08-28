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
  /**
   * Phần chữ CÒN LẠI sau khi bóc ngày/giờ ra — dùng để lọc tiếp theo TÊN sự kiện.
   * Vd "13:00 họp nhóm" -> lọc giờ 13:00, rồi lọc tiếp tên/mô tả/địa điểm chứa "họp nhóm".
   */
  text?: string;
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
/** Khoảng "giờ này, mọi ngày" — dùng khi câu chỉ nêu giờ. */
function anyDayAt(minuteOfDay: number): DateQuery {
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

/**
 * Đọc câu tìm kiếm.
 *
 * Người dùng thường gõ LẪN thời gian và tên sự kiện ("13:00 họp nhóm", "28/8 sinh nhật").
 * Sau khi bóc phần ngày/giờ ra, phần chữ còn lại trả về ở `text` để trang lịch lọc tiếp
 * theo tên. Trước đây cả câu như vậy KHÔNG khớp mẫu nào nên rơi về tìm chữ nguyên câu
 * ("13:00 họp") và luôn ra rỗng.
 *
 * `today` truyền vào để kiểm thử được (không phụ thuộc đồng hồ máy).
 */
export function parseDateQuery(raw: string, today: Date = new Date()): DateQuery | null {
  const cleaned = noAccent(raw.trim().toLowerCase()).replace(/\s+/g, ' ');
  if (!cleaned) return null;

  // Tách phần giờ ra trước — giờ có thể nằm bất kỳ đâu trong câu ("mai 9h họp", "họp 9h").
  let q = cleaned;
  let minuteOfDay: number | undefined;
  const timeMatch = q.match(/(?:^|\s)(\d{1,2})\s*(?::|h|g)\s*(\d{2})?(?![\d/a-z])/);
  if (timeMatch) {
    const h = +timeMatch[1];
    const mi = timeMatch[2] ? +timeMatch[2] : 0;
    if (h <= 23 && mi <= 59) {
      minuteOfDay = h * 60 + mi;
      q = (q.slice(0, timeMatch.index ?? 0) + ' ' + q.slice((timeMatch.index ?? 0) + timeMatch[0].length)).replace(/\s+/g, ' ').trim();
    }
  }

  // Chỉ có giờ, không còn chữ nào -> tra giờ đó trên MỌI ngày.
  if (!q && minuteOfDay != null) return anyDayAt(minuteOfDay);

  // Khớp TRỌN phần còn lại (câu thuần ngày: "mai", "28/8", "tháng 9").
  const whole = matchDatePhrase(q, today, minuteOfDay);
  if (whole) return whole;

  const words = q.split(' ');
  // Ngày đứng ĐẦU, phần sau là tên sự kiện: "28/8 họp nhóm".
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const m = matchDatePhrase(words.slice(0, n).join(' '), today, minuteOfDay);
    if (m) return { ...m, text: words.slice(n).join(' ') };
  }
  // Ngày đứng CUỐI, phần trước là tên sự kiện: "họp nhóm 28/8".
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    const m = matchDatePhrase(words.slice(-n).join(' '), today, minuteOfDay);
    if (m) return { ...m, text: words.slice(0, words.length - n).join(' ') };
  }

  // Không có phần ngày nhưng CÓ giờ -> lọc giờ trên mọi ngày, chữ còn lại lọc tên.
  if (minuteOfDay != null) return { ...anyDayAt(minuteOfDay), text: q };

  return null; // câu chữ thuần -> trang lịch tự tìm theo tên như cũ
}

/** Khớp một cụm ĐÚNG NGUYÊN VẸN là ngày (không lẫn chữ khác). */
function matchDatePhrase(q: string, today: Date, minuteOfDay: number | undefined): DateQuery | null {
  if (!q) return null;
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
  const weekOffset = /^tuan nay$/.test(q) ? 0 : /^(tuan sau|tuan toi)$/.test(q) ? 1 : /^tuan truoc$/.test(q) ? -1 : null;
  if (weekOffset !== null) {
    // Tuần bắt đầu từ Thứ 2 cho đúng thói quen ở Việt Nam.
    const dow = (today.getDay() + 6) % 7;
    const mon = addDays(today, -dow + weekOffset * 7);
    const label = weekOffset === 0 ? 'Tuần này' : weekOffset === 1 ? 'Tuần sau' : 'Tuần trước';
    return withTime(startOfDay(mon), endOfDay(addDays(mon, 6)), `${label} · ${DMY(mon)} – ${DMY(addDays(mon, 6))}`);
  }

  // ---- Tháng ----
  const monthOffset = /^thang nay$/.test(q) ? 0 : /^(thang sau|thang toi)$/.test(q) ? 1 : /^thang truoc$/.test(q) ? -1 : null;
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
