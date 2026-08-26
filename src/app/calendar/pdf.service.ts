// PdfService: Xuất danh sách sự kiện ra file PDF (bảng), và đọc chữ thô từ 1 file PDF để
// đưa cho AI nhận diện sự kiện (Nhập PDF). Xuất bằng cách render 1 bảng HTML thật rồi
// chụp qua jsPDF.html() (dùng html2canvas) — cách này giữ đúng tiếng Việt có dấu, vì font
// mặc định của jsPDF (Helvetica/WinAnsi) KHÔNG có dấu tiếng Việt.

import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { CalendarEvent } from './calendar.types';

// File worker được copy ra gốc thư mục build qua angular.json (assets) -> phục vụ tĩnh tại "/pdf.worker.min.mjs".
// KHÔNG dùng new URL(..., import.meta.url): esbuild (builder của Angular) không nhận diện pattern
// này để copy file ra output, worker sẽ 404 lúc chạy thật dù build không báo lỗi gì.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/** Số ký tự tối đa gửi lên AI — khớp giới hạn MaxLength ở backend (extract-events.dto.ts). */
const MAX_TEXT_LENGTH = 15000;

@Injectable({ providedIn: 'root' })
export class PdfService {
  /** Xuất events -> bảng HTML tạm -> chụp thành PDF -> tải file về. */
  exportToFile(events: CalendarEvent[]): Promise<void> {
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    const container = this.buildTable(sorted);
    document.body.appendChild(container);

    return new Promise<void>((resolve, reject) => {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.html(container, {
        x: 24,
        y: 24,
        width: 547, // khổ A4 (595pt) trừ lề 2 bên
        windowWidth: 800,
        autoPaging: 'text',
        callback: (d) => {
          container.remove();
          try {
            d.save(`lich-${new Date().toISOString().slice(0, 10)}.pdf`);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      });
    });
  }

  private buildTable(events: CalendarEvent[]): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed; left:-9999px; top:0; width:800px; padding:0; font-family:Arial, sans-serif; color:#111;';

    const title = document.createElement('h2');
    title.textContent = 'Lịch của tôi';
    title.style.cssText = 'font-size:20px; margin:0 0 14px;';
    wrap.appendChild(title);

    const table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size:12px;';
    const thStyle = 'text-align:left; border-bottom:2px solid #333; padding:6px 8px; white-space:nowrap;';
    const tdStyle = 'border-bottom:1px solid #ddd; padding:6px 8px; vertical-align:top;';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const h of ['Tiêu đề', 'Bắt đầu', 'Kết thúc', 'Địa điểm']) {
      const th = document.createElement('th');
      th.textContent = h;
      th.setAttribute('style', thStyle);
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const e of events) {
      const row = document.createElement('tr');
      const cells = [e.title || '(Không có tiêu đề)', this.fmt(e.start, e.isAllDay), this.fmt(e.end, e.isAllDay), e.location ?? ''];
      for (const c of cells) {
        const td = document.createElement('td');
        td.textContent = c;
        td.setAttribute('style', tdStyle);
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  private fmt(d: Date, isAllDay: boolean): string {
    const date = d.toLocaleDateString('vi-VN');
    if (isAllDay) return date;
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  }

  /** Đọc toàn bộ chữ trong file PDF (cắt bớt nếu quá dài) — dùng làm nguyên liệu cho AI nhận diện sự kiện. */
  async extractText(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const parts: string[] = [];
    let total = 0;
    for (let i = 1; i <= pdf.numPages && total < MAX_TEXT_LENGTH; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((it) => ('str' in it ? (it as { str: string }).str : '')).join(' ');
      parts.push(pageText);
      total += pageText.length;
    }
    return parts.join('\n').slice(0, MAX_TEXT_LENGTH);
  }
}
