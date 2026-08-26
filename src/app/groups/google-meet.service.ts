// GoogleMeetService — Tạo phòng họp Google Meet.
// Dùng token Google (provider_token từ phiên đăng nhập Supabase) gọi thẳng Google Meet REST API
// để tạo 1 "space" và lấy link Meet. Cần đã cấp quyền meetings.space.created khi đăng nhập Google.

import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../auth/supabase.service';

@Injectable({ providedIn: 'root' })
export class GoogleMeetService {
  private readonly supabase = inject(SupabaseService);

  /** Xin quyền Meet (chuyển hướng sang Google đồng ý, rồi quay lại). */
  requestAccess() {
    return this.supabase.requestMeetAccess();
  }

  /** Lỗi báo "cần xin quyền Meet" — state sẽ bắt và gọi requestAccess(). */
  private needConsent(): Error {
    const e = new Error('NEED_CONSENT') as Error & { code?: string };
    e.code = 'NEED_CONSENT';
    return e;
  }

  /** Rút gọn phần mô tả lỗi của Google cho vừa 1 dòng thông báo. */
  private shortReason(body: string): string {
    try {
      const msg = JSON.parse(body)?.error?.message;
      if (msg) return String(msg).slice(0, 200);
    } catch {
      /* không phải JSON -> dùng nguyên văn */
    }
    return body.slice(0, 200);
  }

  /** Tạo 1 phòng Meet mới, trả về link (vd https://meet.google.com/abc-defg-hij). */
  async createSpace(): Promise<string> {
    const token = this.supabase.session()?.provider_token;
    if (!token) throw this.needConsent(); // chưa có token Google -> cần xin quyền

    const res = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // 401 = token hết hạn -> xin lại quyền là hợp lý.
      if (res.status === 401) throw this.needConsent();
      // 403 có HAI nghĩa rất khác nhau:
      //  - thiếu SCOPE  -> xin quyền lại thì giải quyết được
      //  - API chưa bật / tài khoản không được phép -> xin quyền bao nhiêu lần cũng vô ích
      // Trước đây gộp chung nên rơi vào vòng lặp "xin quyền -> 403 -> xin quyền…".
      if (res.status === 403) {
        const scopeIssue = /scope|insufficient|ACCESS_TOKEN_SCOPE/i.test(detail);
        if (scopeIssue) throw this.needConsent();
        throw new Error(
          'Google từ chối tạo phòng Meet (403). Thường do Google Meet API chưa được bật ' +
            'trong Google Cloud, hoặc tài khoản không được phép dùng API này. ' +
            `Chi tiết: ${this.shortReason(detail)}`,
        );
      }
      throw new Error(`Tạo Google Meet thất bại (${res.status}). ${this.shortReason(detail)}`);
    }

    const data = await res.json();
    const link = data?.meetingUri as string | undefined;
    if (!link) throw new Error('Google không trả về link Meet.');
    return link;
  }
}
