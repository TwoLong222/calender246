// Trang đăng nhập — CHỈ dùng tài khoản Google (OAuth).
// Không có đăng ký / đăng nhập bằng email-mật khẩu: toàn bộ xác thực đi qua Google,
// Supabase chỉ đóng vai trò xử lý phiên (session) phía sau.
//
// Thiết kế: chia đôi màn hình (kiểu SaaS chuyên nghiệp — Linear/Notion) thay vì 1 thẻ
// nổi giữa nền tối. Nửa trái (chỉ hiện màn hình rộng, lg+): quầng gradient thương hiệu +
// logo + tagline + preview lịch nhỏ, để kể câu chuyện "đây là app lịch". Nửa phải: form
// đăng nhập trên nền sáng, KHỚP HỆT với Settings/Calendar/Lời mời (bg-gray-50 + thẻ trắng)
// thay vì tự tạo 1 theme tối riêng — đỡ lệch tone với phần còn lại của app. Màn hình hẹp
// (mobile) chỉ hiện nửa phải, có logo nhỏ ở trên để vẫn giữ thương hiệu.
// Chỉ là PRESENTATION — không đổi logic xác thực (SupabaseService.signInWithGoogle giữ nguyên).

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-scene auth-fade-in flex min-h-screen">
      <!-- Dải gradient thương hiệu (đúng màu logo: tím -> chàm -> ngọc) nối liền 2 nửa -->
      <div class="fixed inset-x-0 top-0 z-30 h-[3px]" style="background: linear-gradient(90deg, #22407D, #3B62A6 45%, #5A86C8)" aria-hidden="true"></div>

      <!-- ================= NỬA TRÁI — thương hiệu (chỉ hiện lg+) ================= -->
      <div class="relative hidden w-full max-w-xl shrink-0 flex-col justify-between overflow-hidden bg-[#0b0c10] p-10 lg:flex xl:max-w-2xl xl:p-14">
        <div
          class="auth-blob pointer-events-none absolute -right-32 -top-32 h-[440px] w-[440px] rounded-full bg-gradient-to-br from-indigo-500/25 via-violet-500/15 to-cyan-400/10 blur-3xl"
          aria-hidden="true"
        ></div>
        <div
          class="auth-blob pointer-events-none absolute -bottom-40 -left-32 h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-cyan-400/10 via-indigo-500/10 to-transparent blur-3xl"
          style="animation-delay: -8s"
          aria-hidden="true"
        ></div>
        <div
          class="pointer-events-none absolute inset-0 opacity-[0.05]"
          style="background-image: linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px); background-size: 64px 64px;"
          aria-hidden="true"
        ></div>

        <a href="/landing/index.html" class="relative z-10 flex w-fit items-center gap-2 text-white/70 transition-colors hover:text-white">
          <svg width="26" height="22" viewBox="209.20 79.40 186.70 159.70" aria-hidden="true"><defs><linearGradient id="fsGradLeft" x1="209.20" y1="239.10" x2="395.90" y2="79.40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3E68AC"/><stop offset=".5" stop-color="#4E78BC"/><stop offset="1" stop-color="#5E86C4"/></linearGradient></defs><g transform="translate(0,327) scale(0.1,-0.1)" fill="url(#fsGradLeft)" stroke="none"><path d="M3203 2421 c-141 -38 -224 -94 -373 -247 -64 -66 -192 -198 -286 -294 -93 -96 -224 -231 -291 -300 l-121 -125 2 -60 1 -60 333 0 332 0 0 -207 0 -208 80 0 80 0 2 208 3 207 45 0 45 0 0 70 0 70 -47 -2 -48 -3 -2 288 -3 287 -77 -82 -78 -82 0 -203 0 -203 -230 0 c-127 -1 -230 1 -230 4 0 3 46 52 103 110 56 59 206 213 332 344 300 311 375 362 561 374 133 9 259 -40 391 -153 84 -72 84 -77 21 -141 -198 -202 -417 -247 -673 -138 -18 8 -19 7 -6 -9 66 -81 303 -135 454 -103 l37 8 0 -346 c0 -332 -1 -346 -20 -365 -19 -19 -33 -20 -270 -20 l-250 0 0 -37 c0 -21 -3 -48 -6 -61 l-7 -23 286 3 c414 4 381 -38 385 499 l3 399 37 19 c59 31 152 111 201 174 55 71 54 75 -79 207 -156 155 -270 210 -455 216 -87 3 -125 0 -182 -15z"/><path d="M2539 2334 c-7 -9 -13 -35 -14 -57 l-1 -42 -81 -5 c-148 -9 -163 -39 -163 -332 l0 -212 60 59 60 59 0 73 0 73 66 0 66 0 133 138 132 137 -78 3 -79 3 0 44 c0 67 -63 104 -101 59z"/><path d="M3282 2213 c-147 -72 -88 -298 78 -298 109 0 182 95 156 201 l-7 28 -22 -27 c-33 -39 -78 -40 -103 -2 -21 32 -11 72 21 87 13 6 22 15 19 19 -9 15 -107 9 -142 -8z"/><path d="M3314 1667 c-3 -8 -4 -39 -2 -68 l3 -54 67 -3 c77 -3 82 3 76 89 l-3 44 -68 3 c-51 2 -69 -1 -73 -11z m106 -35 c0 -20 -46 -52 -58 -40 -16 16 -15 29 1 22 8 -3 20 2 27 11 13 16 30 20 30 7z"/><path d="M3112 1613 l3 -58 55 0 55 0 3 58 3 57 -61 0 -61 0 3 -57z"/><path d="M2563 1636 c-46 -39 -9 -107 50 -92 52 13 59 83 11 105 -32 14 -28 15 -61 -13z"/><path d="M3110 1405 l0 -55 60 0 60 0 0 55 0 55 -60 0 -60 0 0 -55z"/><path d="M3328 1418 c-7 -63 -3 -68 58 -68 l54 0 0 55 0 55 -54 0 -54 0 -4 -42z"/><path d="M2282 1151 c3 -141 10 -159 72 -205 25 -19 44 -21 212 -24 l184 -3 0 60 0 61 -153 0 c-198 0 -191 -5 -192 132 l0 103 -63 3 -64 3 4 -130z"/><path d="M2575 1248 c-58 -33 -39 -108 28 -108 57 0 74 84 22 108 -30 14 -25 14 -50 0z"/><path d="M3114 1247 c-3 -8 -4 -34 -2 -58 l3 -44 58 -3 58 -3 -3 58 -3 58 -53 3 c-38 2 -54 -1 -58 -11z"/><path d="M3350 1242 c-43 -35 -23 -102 31 -102 56 0 82 73 37 104 -29 20 -41 20 -68 -2z"/></g></svg>
          <span class="text-[15px] font-semibold tracking-tight">Foresight</span>
        </a>

        <div class="relative z-10">
          <h2 class="max-w-sm text-[34px] font-semibold leading-[1.15] tracking-tight text-white xl:text-[38px]">
            Đi trước thời gian,<br />không bỏ lỡ phút nào.
          </h2>
          <p class="mt-4 max-w-sm text-[15px] leading-relaxed text-white/50">
            Foresight gom mọi lịch, sự kiện và lời nhắc vào một nơi — mời cộng sự, theo dõi ai đã nhận, và luôn nhìn trước những gì sắp tới.
          </p>

          <!-- Preview lịch nhỏ — chỉ để gợi nhớ đây là app lịch, không phải dữ liệu thật.
               2 chip nổi quanh khung (giống showcase landing) để đỡ đơn điệu, có bay-vào + lơ lửng nhẹ. -->
          <div class="relative mt-10 max-w-sm">
            <div
              class="auth-card-float absolute -right-5 -top-6 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-[#14151b] px-3 py-2 shadow-lg shadow-black/40"
              style="--card-delay:.2s"
            >
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-violet-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
              </span>
              <span class="text-[11.5px] font-medium text-white/85">Nhắc trước 30 phút</span>
            </div>
            <div
              class="auth-card-float absolute -bottom-9 -left-6 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-[#14151b] px-3 py-2 shadow-lg shadow-black/40"
              style="--card-delay:.7s"
            >
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
              <span class="text-[11.5px] font-medium text-white/85">Đã nhận lời</span>
            </div>

            <div class="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
              <div class="mb-3 flex items-center justify-between">
                <span class="font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">Tuần này</span>
                <div class="flex gap-1"><i class="h-1.5 w-1.5 rounded-full bg-rose-400/80"></i><i class="h-1.5 w-1.5 rounded-full bg-amber-400/80"></i><i class="h-1.5 w-1.5 rounded-full bg-emerald-400/80"></i></div>
              </div>
              <div class="space-y-1.5">
                <div class="flex items-center gap-2 rounded-lg bg-indigo-500/[0.12] px-2.5 py-1.5 text-[12.5px] text-indigo-200">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400"></span> Họp nhóm <span class="ml-auto font-mono text-[11px] text-indigo-200/60">08:30</span>
                </div>
                <div class="flex items-center gap-2 rounded-lg bg-violet-500/[0.12] px-2.5 py-1.5 text-[12.5px] text-violet-200">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400"></span> Demo sản phẩm <span class="ml-auto font-mono text-[11px] text-violet-200/60">11:30</span>
                </div>
                <div class="flex items-center gap-2 rounded-lg bg-cyan-500/[0.12] px-2.5 py-1.5 text-[12.5px] text-cyan-200">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400"></span> Cà phê 1-1 <span class="ml-auto font-mono text-[11px] text-cyan-200/60">14:00</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p class="relative z-10 text-[12px] text-white/25">© 2026 Foresight</p>
      </div>

      <!-- ================= NỬA PHẢI — form đăng nhập (khớp theme sáng của app) ================= -->
      <div class="flex flex-1 items-center justify-center bg-gray-50 px-4 py-10">
        <div class="auth-rise-in w-full max-w-sm" style="animation-delay: .1s">
          <!-- Logo nhỏ — chỉ hiện khi nửa trái bị ẩn (màn hình hẹp) -->
          <a href="/landing/index.html" class="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <svg width="30" height="26" viewBox="209.20 79.40 186.70 159.70" aria-hidden="true"><defs><linearGradient id="fsGradMobile" x1="209.20" y1="239.10" x2="395.90" y2="79.40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3E68AC"/><stop offset=".5" stop-color="#4E78BC"/><stop offset="1" stop-color="#5E86C4"/></linearGradient></defs><g transform="translate(0,327) scale(0.1,-0.1)" fill="url(#fsGradMobile)" stroke="none"><path d="M3203 2421 c-141 -38 -224 -94 -373 -247 -64 -66 -192 -198 -286 -294 -93 -96 -224 -231 -291 -300 l-121 -125 2 -60 1 -60 333 0 332 0 0 -207 0 -208 80 0 80 0 2 208 3 207 45 0 45 0 0 70 0 70 -47 -2 -48 -3 -2 288 -3 287 -77 -82 -78 -82 0 -203 0 -203 -230 0 c-127 -1 -230 1 -230 4 0 3 46 52 103 110 56 59 206 213 332 344 300 311 375 362 561 374 133 9 259 -40 391 -153 84 -72 84 -77 21 -141 -198 -202 -417 -247 -673 -138 -18 8 -19 7 -6 -9 66 -81 303 -135 454 -103 l37 8 0 -346 c0 -332 -1 -346 -20 -365 -19 -19 -33 -20 -270 -20 l-250 0 0 -37 c0 -21 -3 -48 -6 -61 l-7 -23 286 3 c414 4 381 -38 385 499 l3 399 37 19 c59 31 152 111 201 174 55 71 54 75 -79 207 -156 155 -270 210 -455 216 -87 3 -125 0 -182 -15z"/><path d="M2539 2334 c-7 -9 -13 -35 -14 -57 l-1 -42 -81 -5 c-148 -9 -163 -39 -163 -332 l0 -212 60 59 60 59 0 73 0 73 66 0 66 0 133 138 132 137 -78 3 -79 3 0 44 c0 67 -63 104 -101 59z"/><path d="M3282 2213 c-147 -72 -88 -298 78 -298 109 0 182 95 156 201 l-7 28 -22 -27 c-33 -39 -78 -40 -103 -2 -21 32 -11 72 21 87 13 6 22 15 19 19 -9 15 -107 9 -142 -8z"/><path d="M3314 1667 c-3 -8 -4 -39 -2 -68 l3 -54 67 -3 c77 -3 82 3 76 89 l-3 44 -68 3 c-51 2 -69 -1 -73 -11z m106 -35 c0 -20 -46 -52 -58 -40 -16 16 -15 29 1 22 8 -3 20 2 27 11 13 16 30 20 30 7z"/><path d="M3112 1613 l3 -58 55 0 55 0 3 58 3 57 -61 0 -61 0 3 -57z"/><path d="M2563 1636 c-46 -39 -9 -107 50 -92 52 13 59 83 11 105 -32 14 -28 15 -61 -13z"/><path d="M3110 1405 l0 -55 60 0 60 0 0 55 0 55 -60 0 -60 0 0 -55z"/><path d="M3328 1418 c-7 -63 -3 -68 58 -68 l54 0 0 55 0 55 -54 0 -54 0 -4 -42z"/><path d="M2282 1151 c3 -141 10 -159 72 -205 25 -19 44 -21 212 -24 l184 -3 0 60 0 61 -153 0 c-198 0 -191 -5 -192 132 l0 103 -63 3 -64 3 4 -130z"/><path d="M2575 1248 c-58 -33 -39 -108 28 -108 57 0 74 84 22 108 -30 14 -25 14 -50 0z"/><path d="M3114 1247 c-3 -8 -4 -34 -2 -58 l3 -44 58 -3 58 -3 -3 58 -3 58 -53 3 c-38 2 -54 -1 -58 -11z"/><path d="M3350 1242 c-43 -35 -23 -102 31 -102 56 0 82 73 37 104 -29 20 -41 20 -68 -2z"/></g></svg>
            <span class="text-[15px] font-semibold tracking-tight text-gray-900">Foresight</span>
          </a>

          <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white text-center shadow-sm">
            <div class="h-[3px] w-full" style="background: linear-gradient(90deg, #22407D, #3B62A6 45%, #5A86C8)" aria-hidden="true"></div>
            <div class="p-8">
            <h1 class="text-[24px] font-semibold tracking-tight text-gray-900">Chào mừng trở lại</h1>
            <p class="mx-auto mt-2 max-w-[260px] text-[14px] leading-relaxed text-gray-500">
              Đăng nhập để quản lý lịch trình và không bỏ lỡ điều quan trọng.
            </p>

            @if (errorMessage()) {
              <p class="auth-error-in mt-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-left text-[13px] leading-relaxed text-red-700">
                {{ errorMessage() }}
              </p>
            }

            <button
              type="button"
              (click)="loginWithGoogle()"
              [disabled]="isLoading()"
              class="mt-7 flex h-[50px] w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white text-[14px] font-semibold text-gray-700 transition-all duration-150 ease-out hover:-translate-y-px hover:border-gray-400 hover:shadow-md active:scale-[0.98] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
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

            <p class="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-gray-400">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              Dữ liệu của bạn được bảo mật.
            </p>
            </div>
          </div>

          <p class="mt-5 text-center text-[11.5px] leading-relaxed text-gray-400">
            Bằng việc tiếp tục, bạn đồng ý với Điều khoản &amp; Chính sách quyền riêng tư.
          </p>
        </div>
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
