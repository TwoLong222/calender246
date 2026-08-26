// SupabaseService (frontend): tạo Supabase client 1 lần duy nhất, expose trạng thái
// đăng nhập hiện tại (session/user) dưới dạng Signal để mọi component đọc trực tiếp,
// và cung cấp các phương thức đăng ký/đăng nhập/đăng xuất.

import { Injectable, signal } from '@angular/core';
import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  /** true = đã xác định xong trạng thái đăng nhập lúc mở trang (tránh nhấp nháy/redirect nhầm) */
  readonly isReady = signal(false);

  constructor() {
    this.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.user.set(data.session?.user ?? null);
      this.isReady.set(true);
    });

    // Lắng nghe mọi thay đổi trạng thái đăng nhập: đăng nhập, đăng xuất, refresh token,
    // và cả trường hợp Google OAuth redirect về xong (Supabase tự bắn sự kiện SIGNED_IN)
    this.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
      this.isReady.set(true);
    });
  }

  signUp(email: string, password: string) {
    return this.client.auth.signUp({ email, password });
  }

  signInWithPassword(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  // Đăng nhập THƯỜNG: chỉ dùng quyền cơ bản (email/hồ sơ) -> KHÔNG kích hoạt cảnh báo
  // "app chưa xác minh", ai cũng đăng nhập được (khi app đã publish). Quyền Google Meet
  // là quyền nhạy cảm -> tách ra, chỉ xin khi người dùng thực sự bấm "Tạo Meet".
  signInWithGoogle() {
    return this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  /** Xin quyền tạo phòng Google Meet (chỉ gọi khi người dùng bấm "Tạo Meet"). Sẽ chuyển hướng
   *  sang Google để đồng ý, rồi quay lại app với token có quyền Meet. */
  requestMeetAccess() {
    // Quay lại ĐÚNG TRANG đang đứng, nhưng bỏ query/hash cũ: nếu giữ nguyên
    // window.location.href, URL có thể còn mang ?code=… của lần cấp quyền trước ->
    // vòng sau Supabase nhận về một redirect bẩn và việc đổi mã dễ hỏng.
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    return this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: cleanUrl,
        scopes: 'openid email profile https://www.googleapis.com/auth/meetings.space.created',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
  }

  signOut() {
    return this.client.auth.signOut();
  }

  /**
   * Lấy session, nhưng nếu URL đang mang tham số OAuth (?code=… hoặc #access_token=…)
   * thì ĐỢI supabase-js đổi xong mã đó thành session rồi mới trả lời.
   *
   * Vì sao cần: sau khi bấm "Continue" ở màn hình cấp quyền Google (đăng nhập, hoặc xin
   * quyền tạo Meet), trình duyệt quay lại app kèm mã trong URL. Việc đổi mã -> session là
   * BẤT ĐỒNG BỘ; nếu guard hỏi ngay lập tức sẽ thấy "chưa đăng nhập" và đá người dùng ra
   * trang landing — đúng lúc họ vừa cấp quyền xong.
   */
  async getSessionAfterOAuth(timeoutMs = 6000) {
    const url = new URL(window.location.href);
    const pending =
      url.searchParams.has('code') ||
      window.location.hash.includes('access_token') ||
      window.location.hash.includes('error');

    const { data } = await this.client.auth.getSession();
    if (data.session || !pending) return data.session;

    // Có mã OAuth trong URL nhưng session chưa sẵn sàng -> chờ ngắn, hỏi lại theo nhịp.
    const step = 150;
    for (let waited = 0; waited < timeoutMs; waited += step) {
      await new Promise((r) => setTimeout(r, step));
      const { data: again } = await this.client.auth.getSession();
      if (again.session) return again.session;
    }
    return null;
  }

  /**
   * Đăng xuất rồi đưa về TRANG LANDING (public/landing/index.html).
   * Dùng window.location (điều hướng cả trang) chứ không phải Router: landing là file
   * tĩnh nằm NGOÀI ứng dụng Angular, router không tới được. Đi cả trang cũng xoá sạch
   * state trong bộ nhớ — không sót dữ liệu của phiên vừa đăng xuất.
   */
  async signOutToLanding(scope: 'local' | 'global' = 'local'): Promise<void> {
    try {
      await (scope === 'global'
        ? this.client.auth.signOut({ scope: 'global' })
        : this.client.auth.signOut());
    } catch {
      /* mất mạng vẫn cho thoát ra landing */
    }
    window.location.href = '/landing/index.html';
  }

  /** Gửi email chứa link đặt lại mật khẩu — link trỏ về trang /reset-password của app */
  resetPasswordForEmail(email: string) {
    return this.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  }

  /** Đặt mật khẩu mới cho user đang trong phiên khôi phục (sau khi bấm link trong email) */
  updatePassword(newPassword: string) {
    return this.client.auth.updateUser({ password: newPassword });
  }
}
