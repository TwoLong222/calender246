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

  signInWithGoogle() {
    return this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  signOut() {
    return this.client.auth.signOut();
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
