// PdfService: Xuất danh sách sự kiện ra file PDF (bảng), và đọc chữ thô từ 1 file PDF để
// đưa cho AI nhận diện sự kiện (Nhập PDF). Xuất bằng cách vẽ CHỮ THẬT (vector text, không
// chụp ảnh HTML) với font Roboto nhúng riêng (hỗ trợ dấu tiếng Việt — font mặc định của
// jsPDF (Helvetica/WinAnsi) KHÔNG có dấu tiếng Việt). Vẽ chữ thật thay vì chụp ảnh là bắt
// buộc để PDF xuất ra có LỚP CHỮ THỰC, nhờ vậy có thể nhập ngược lại (extractText/pdfjs chỉ
// đọc được PDF có chữ thật) — trước đây dùng jsPDF.html() (chụp qua html2canvas) tạo PDF chỉ
// là ảnh, tự xuất rồi tự nhập lại báo "Không đọc được chữ nào" vì không có chữ thật nào cả.

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

const MARGIN = 40;
const LINE_H = 12;

interface PdfColumn {
  label: string;
  w: number;
}

@Injectable({ providedIn: 'root' })
export class PdfService {
  /** Font Roboto (VFS + addFont) chỉ cần nạp 1 lần cho mỗi doc — cache promise để gọi export nhiều lần không tải lại font. */
  private fontsPromise: Promise<{ regular: string; bold: string }> | null = null;

  private loadFonts(): Promise<{ regular: string; bold: string }> {
    if (!this.fontsPromise) {
      this.fontsPromise = Promise.all([
        this.fetchFontBase64('/fonts/Roboto-Regular.ttf'),
        this.fetchFontBase64('/fonts/Roboto-Bold.ttf'),
      ])
        .then(([regular, bold]) => ({ regular, bold }))
        // Lỗi lần đầu (vd mạng chập chờn) không được kẹt promise hỏng mãi mãi -> xóa cache để lần xuất sau thử tải lại.
        .catch((err) => {
          this.fontsPromise = null;
          throw err;
        });
    }
    return this.fontsPromise;
  }

  private async fetchFontBase64(url: string): Promise<string> {
    const res = await fetch(url);
    // Validate rõ ở biên mạng: nếu route SPA/proxy nào đó trả nhầm về index.html (hay lỗi khác)
    // thay vì file font thật, addFont() sẽ ÂM THẦM nhúng dữ liệu rác -> chữ vẽ ra "vô hình",
    // PDF trông như trống mà không có lỗi nào hiện ra. Chặn sớm ở đây để báo lỗi rõ thay vì vậy.
    if (!res.ok) throw new Error(`Không tải được font ${url} (HTTP ${res.status})`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 10_000) throw new Error(`File font ${url} có vẻ không đúng (chỉ ${buf.byteLength} byte)`);
    const bytes = new Uint8Array(buf);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  /** Xuất events -> PDF chữ thật (vector), tự xuống trang khi hết chỗ -> tải file về. */
  async exportToFile(events: CalendarEvent[]): Promise<void> {
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    const { regular, bold } = await this.loadFonts();

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.addFileToVFS('Roboto-Regular.ttf', regular);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFileToVFS('Roboto-Bold.ttf', bold);
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const contentW = pageW - 2 * MARGIN;
    const cols: PdfColumn[] = [
      { label: 'Tiêu đề', w: contentW * 0.38 },
      { label: 'Bắt đầu', w: contentW * 0.21 },
      { label: 'Kết thúc', w: contentW * 0.21 },
      { label: 'Địa điểm', w: contentW * 0.2 },
    ];

    let y = MARGIN;
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.text('Lịch của tôi', MARGIN, y);
    y += 26;

    const drawHeaderRow = () => {
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(10);
      let x = MARGIN;
      for (const c of cols) {
        doc.text(c.label, x, y);
        x += c.w;
      }
      y += 6;
      doc.setDrawColor(180);
      doc.line(MARGIN, y, MARGIN + contentW, y);
      y += LINE_H;
      doc.setFont('Roboto', 'normal');
      doc.setFontSize(9);
    };
    drawHeaderRow();

    for (const e of sorted) {
      const cells = [e.title || '(Không có tiêu đề)', this.fmt(e.start, e.isAllDay), this.fmt(e.end, e.isAllDay), e.location ?? ''];
      const wrapped = cells.map((text, i) => doc.splitTextToSize(text, cols[i].w - 6) as string[]);
      const rowLines = Math.max(...wrapped.map((w) => w.length), 1);
      const rowH = rowLines * LINE_H;

      if (y + rowH > pageH - MARGIN) {
        doc.addPage();
        y = MARGIN;
        drawHeaderRow();
      }

      let x = MARGIN;
      wrapped.forEach((lines, i) => {
        doc.text(lines, x, y);
        x += cols[i].w;
      });
      y += rowH + 4;
    }

    doc.save(`lich-${new Date().toISOString().slice(0, 10)}.pdf`);
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
