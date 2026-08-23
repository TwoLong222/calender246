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
      // 401/403 = token hết hạn HOẶC đăng nhập cơ bản (chưa có quyền Meet) -> xin quyền Meet.
      if (res.status === 401 || res.status === 403) throw this.needConsent();
      const detail = await res.text().catch(() => '');
      throw new Error(`Tạo Google Meet thất bại (${res.status}). ${detail.slice(0, 150)}`);
    }

    const data = await res.json();
    const link = data?.meetingUri as string | undefined;
    if (!link) throw new Error('Google không trả về link Meet.');
    return link;
  }
}
