// Trang đăng nhập — CHỈ dùng tài khoản Google (OAuth).
// Không có đăng ký / đăng nhập bằng email-mật khẩu: toàn bộ xác thực đi qua Google,
// Supabase chỉ đóng vai trò xử lý phiên (session) phía sau.
//
// Thiết kế: tối giản, chuyên nghiệp (khác bản "illustrated calendar world" cũ có linh
// vật/sao/đom đóm bị đánh giá "trẻ con") — nền tối phẳng, 1 quầng gradient trôi rất chậm
// phía sau, thẻ đăng nhập ở giữa dùng đúng logo + màu thương hiệu Foresight. Dùng lại bộ
// class .auth-fade-in/.auth-rise-in/.auth-blob/.auth-error-in có sẵn trong styles.css.
// Chỉ là PRESENTATION — không đổi logic xác thực (SupabaseService.signInWithGoogle giữ nguyên).

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-scene auth-fade-in relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0c10] px-4 py-10">
      <!-- Quầng gradient trôi rất chậm phía sau — thay cho linh vật/sao, vẫn có chiều sâu -->
      <div
        class="auth-blob pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-indigo-500/25 via-violet-500/15 to-cyan-400/10 blur-3xl"
        aria-hidden="true"
      ></div>
      <div
        class="auth-blob pointer-events-none absolute -bottom-48 -left-40 h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-cyan-400/10 via-indigo-500/10 to-transparent blur-3xl"
        style="animation-delay: -8s"
        aria-hidden="true"
      ></div>

      <!-- Lưới điểm rất mờ tạo chất liệu, đồng bộ phong cách hero landing -->
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.05]"
        style="background-image: linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px); background-size: 64px 64px;"
        aria-hidden="true"
      ></div>

      <!-- Wordmark nhỏ góc trên, đưa về trang chủ — chuẩn page chrome của SaaS chuyên nghiệp -->
      <a
        href="/landing/index.html"
        class="absolute left-6 top-6 z-10 flex items-center gap-1.5 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        Foresight
      </a>

      <div
        class="auth-rise-in relative w-full max-w-[400px] rounded-2xl border border-white/[0.08] bg-white/[0.04] p-9 text-center backdrop-blur-xl"
        style="animation-delay: .1s; box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 25px 60px -15px rgba(0,0,0,0.65), 0 0 90px -25px rgba(129,140,248,0.3);"
      >
        <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06]">
          <svg width="32" height="32" viewBox="0 0 96 96" aria-hidden="true">
            <defs>
              <linearGradient id="fsGradLogin" x1="8" y1="88" x2="90" y2="6" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#a5b4fc" />
                <stop offset=".55" stop-color="#c4b5fd" />
                <stop offset="1" stop-color="#67e8f9" />
              </linearGradient>
              <linearGradient id="fsCardLogin" x1="14" y1="84" x2="84" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#4338ca" />
                <stop offset="1" stop-color="#7c3aed" />
              </linearGradient>
            </defs>
            <rect x="30" y="8" width="8" height="14" rx="4" fill="url(#fsCardLogin)" />
            <rect x="12" y="20" width="72" height="64" rx="15" fill="url(#fsCardLogin)" />
            <circle cx="66" cy="48" r="2.6" fill="#e5e3fa" opacity=".85" />
            <circle cx="66" cy="60" r="2.6" fill="#e5e3fa" opacity=".85" />
            <circle cx="66" cy="72" r="2.6" fill="#e5e3fa" opacity=".85" />
            <circle cx="78" cy="60" r="2.6" fill="#e5e3fa" opacity=".85" />
            <circle cx="78" cy="72" r="2.6" fill="#e5e3fa" opacity=".85" />
            <rect x="72.5" y="42.5" width="11" height="11" rx="3" fill="#e5e3fa" />
            <path d="M75.5 48.2 L77.4 50 L80.5 45.8" fill="none" stroke="#241b47" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="38" cy="50" r="2.6" fill="#e5e3fa" opacity=".85" />
            <circle cx="22" cy="76" r="2.6" fill="#e5e3fa" opacity=".85" />
            <path d="M58 20 L58 82 M58 54 L24 54 L52 18" fill="none" stroke="url(#fsGradLogin)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M52 18 C62 4 88 4 94 18 C88 30 62 30 52 18 Z" fill="url(#fsGradLogin)" />
            <circle cx="80" cy="19" r="7" fill="#0c1030" />
            <circle cx="83" cy="16" r="1.8" fill="#fff" opacity=".9" />
          </svg>
        </div>

        <p class="mb-1 font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-indigo-300/80">Foresight</p>
        <h1 class="text-[26px] font-semibold tracking-tight text-white">Chào mừng trở lại</h1>
        <p class="mx-auto mt-2 max-w-[270px] text-[14px] leading-relaxed text-white/50">
          Đăng nhập để quản lý lịch trình và không bỏ lỡ điều quan trọng.
        </p>

        @if (errorMessage()) {
          <p class="auth-error-in mt-5 rounded-lg border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-left text-[13px] leading-relaxed text-red-300">
            {{ errorMessage() }}
          </p>
        }

        <button
          type="button"
          (click)="loginWithGoogle()"
          [disabled]="isLoading()"
          class="mt-7 flex h-[50px] w-full items-center justify-center gap-3 rounded-xl bg-white text-[14px] font-semibold text-gray-800 transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-[0_8px_24px_-6px_rgba(129,140,248,0.55)] active:scale-[0.98] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c10]"
        >
          @if (isLoading()) {
            <span class="spin h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600"></span>
            <span>Đang chuyển hướng…</span>
          } @else {
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            <span>Đăng nhập bằng Google</span>
          }
        </button>

        <p class="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-white/40">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          Dữ liệu của bạn được bảo mật.
        </p>
        <p class="mt-1.5 text-[11px] leading-relaxed text-white/25">
          Bằng việc tiếp tục, bạn đồng ý với Điều khoản &amp; Chính sách quyền riêng tư.
        </p>
      </div>
    </div>
  `,
})
export class LoginPageComponent {
  private readonly supabase = inject(SupabaseService);

  errorMessage = signal<string | null>(null);
  isLoading = signal(false);

  async loginWithGoogle(): Promise<void> {
    this.errorMessage.set(null);
    this.isLoading.set(true);

    const { error } = await this.supabase.signInWithGoogle();

    // Nếu gọi thành công, trình duyệt sẽ tự chuyển hướng sang trang đăng nhập Google.
    // Chỉ khi có lỗi (vd cấu hình OAuth sai) mới cần hiển thị lại thông báo ở đây.
    if (error) {
      this.isLoading.set(false);
      this.errorMessage.set('Không mở được đăng nhập Google. Kiểm tra lại cấu hình OAuth trong Supabase.');
    }
  }
}
