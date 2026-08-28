// IcsService: Xuất/Nhập file .ics (chuẩn iCalendar RFC 5545) — tương thích Google Calendar, Outlook...
// Xuất: gom events -> chuỗi .ics -> tải file về.
// Nhập: đọc text .ics -> tách các VEVENT -> trả về danh sách draft để tạo event.

import { Injectable } from '@angular/core';
import { CalendarEvent } from './calendar.types';
import { htmlToPlain } from '../shared/html-text';

export interface ImportedEvent {
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  description?: string;
  location?: string;
  /** Link phòng họp lấy được từ file .ics (X-GOOGLE-CONFERENCE / LOCATION / DESCRIPTION). */
  meetLink?: string;
}

@Injectable({ providedIn: 'root' })
export class IcsService {
  /** Gom danh sách event thành chuỗi .ics rồi tải file về máy */
  exportToFile(events: CalendarEvent[]): void {
    const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lich App//VN', 'CALSCALE:GREGORIAN'];
    const stamp = this.toUtc(new Date());
    for (const e of events) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${e.id}@lich-app`);
      lines.push(`DTSTAMP:${stamp}`);
      if (e.isAllDay) {
        lines.push(`DTSTART;VALUE=DATE:${this.toDate(e.start)}`);
        lines.push(`DTEND;VALUE=DATE:${this.toDate(e.end)}`);
      } else {
        lines.push(`DTSTART:${this.toUtc(e.start)}`);
        lines.push(`DTEND:${this.toUtc(e.end)}`);
      }
      lines.push(`SUMMARY:${this.esc(e.title || '(Không có tiêu đề)')}`);
      if (e.description) lines.push(`DESCRIPTION:${this.esc(htmlToPlain(e.description))}`);
      if (e.location) lines.push(`LOCATION:${this.esc(e.location)}`);
      // Google Calendar đọc đúng thuộc tính này để hiện nút "Tham gia Google Meet".
      // Thiếu nó thì file mình xuất ra mang sang lịch khác là mất link họp.
      if (e.meetLink) lines.push(`X-GOOGLE-CONFERENCE:${e.meetLink}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lich-${new Date().toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Phân tích chuỗi .ics -> danh sách event nhập vào */
  parse(text: string): ImportedEvent[] {
    // Gộp dòng bị "gấp" (dòng nối bắt đầu bằng space/tab) theo chuẩn iCalendar
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);

    const result: ImportedEvent[] = [];
    let cur: Record<string, { params: string; value: string }> | null = null;
    // Đang ở trong thành phần con lồng bên trong VEVENT (VALARM...) hay không.
    let subDepth = 0;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        cur = {};
        subDepth = 0;
        continue;
      }
      if (line === 'END:VEVENT') {
        if (cur) {
          const ev = this.buildEvent(cur);
          if (ev) result.push(ev);
        }
        cur = null;
        subDepth = 0;
        continue;
      }
      if (!cur) continue;

      // Bỏ qua field của thành phần con (nhất là VALARM có "DESCRIPTION:REMINDER") —
      // nếu không nó sẽ ĐÈ mất DESCRIPTION/… thật của VEVENT (chứa link phòng họp).
      if (line.startsWith('BEGIN:')) {
        subDepth++;
        continue;
      }
      if (line.startsWith('END:')) {
        if (subDepth > 0) subDepth--;
        continue;
      }
      if (subDepth > 0) continue;

      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const left = line.slice(0, colon); // KEY hoặc KEY;PARAMS
      const value = line.slice(colon + 1);
      const semi = left.indexOf(';');
      const key = (semi < 0 ? left : left.slice(0, semi)).toUpperCase();
      const params = semi < 0 ? '' : left.slice(semi + 1);
      cur[key] = { params, value };
    }
    return result;
  }

  private buildEvent(fields: Record<string, { params: string; value: string }>): ImportedEvent | null {
    const dtStart = fields['DTSTART'];
    const dtEnd = fields['DTEND'];
    if (!dtStart) return null;

    const isAllDay = /VALUE=DATE(?!-TIME)/i.test(dtStart.params) || /^\d{8}$/.test(dtStart.value);
    const start = this.parseDate(dtStart.value);
    if (!start) return null;
    let end = dtEnd ? this.parseDate(dtEnd.value) : null;
    if (!end) end = new Date(start.getTime() + 60 * 60 * 1000); // mặc định 1 tiếng

    const description = fields['DESCRIPTION'] ? this.unesc(fields['DESCRIPTION'].value) : undefined;
    const location = fields['LOCATION'] ? this.unesc(fields['LOCATION'].value) : undefined;
    const meetLink = this.findMeetLink(fields, location, description);

    return {
      title: this.unesc(fields['SUMMARY']?.value ?? '(Không có tiêu đề)'),
      start,
      end,
      isAllDay,
      description,
      // Địa điểm trùng y hệt link họp thì bỏ, không thì chi tiết sự kiện hiện link 2 lần.
      location: location && location === meetLink ? undefined : location,
      meetLink,
    };
  }

  /**
   * Tìm link phòng họp trong 1 VEVENT. Mỗi nơi xuất file để link ở một chỗ khác nhau:
   * Google dùng X-GOOGLE-CONFERENCE, nhiều nơi khác chỉ nhét thẳng vào LOCATION,
   * còn thư mời thì hay để trong DESCRIPTION. Dò lần lượt cả ba.
   */
  private findMeetLink(
    fields: Record<string, { params: string; value: string }>,
    location: string | undefined,
    description: string | undefined,
  ): string | undefined {
    const x = fields['X-GOOGLE-CONFERENCE']?.value?.trim();
    if (x) return x;
    // Teams/Outlook để link ở property riêng của Microsoft.
    const teams =
      fields['X-MICROSOFT-SKYPETEAMSMEETINGURL']?.value?.trim() ||
      fields['X-MICROSOFT-ONLINEMEETINGEXTERNALLINK']?.value?.trim();
    if (teams && /^https?:\/\//i.test(teams)) return teams;
    // CONFERENCE;VALUE=URI:... (RFC 7986) — Outlook/Teams hay dùng.
    const conf = fields['CONFERENCE']?.value?.trim();
    if (conf && /^https?:\/\//i.test(conf)) return conf;
    return this.firstMeetingUrl(location) ?? this.firstMeetingUrl(description);
  }

  /** Link phòng họp đầu tiên trong 1 đoạn chữ (Google Meet, Teams, Zoom). */
  private firstMeetingUrl(text: string | undefined): string | undefined {
    if (!text) return undefined;
    const m = text.match(
      /https?:\/\/(?:meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|[\w.-]*zoom\.us)\/[^\s<>"')\]]+/i,
    );
    // Dấu chấm/phẩy cuối câu hay bị dính vào URL -> cắt bỏ.
    return m ? m[0].replace(/[.,;:]+$/, '') : undefined;
  }

  private parseDate(v: string): Date | null {
    const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
    if (!m) return null;
    const [, y, mo, d, h = '0', mi = '0', s = '0', z] = m;
    if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)); // UTC
    return new Date(+y, +mo - 1, +d, +h, +mi, +s); // giờ địa phương / cả ngày
  }

  private toUtc(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  private toDate(d: Date): string {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }
  private esc(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  private unesc(s: string): string {
    return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  }
}
