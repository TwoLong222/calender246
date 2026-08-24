// Trang đăng nhập — CHỈ dùng tài khoản Google (OAuth).
// Không có đăng ký / đăng nhập bằng email-mật khẩu: toàn bộ xác thực đi qua Google,
// Supabase chỉ đóng vai trò xử lý phiên (session) phía sau.
//
// Thiết kế: "illustrated calendar world" — 1 scene thống nhất (không phải các component
// rời rạc đặt lên nền): sky + landscape nhiều lớp, linh vật lịch, login card làm trung tâm,
// 2 thẻ sự kiện mỗi bên (chỉ desktop rộng, cách mép + cách login đủ xa), timeline uốn nhẹ
// ở dưới. Bố cục dùng CSS GRID 3 cột (cards-trái | login | cards-phải) để đảm bảo khoảng
// cách luôn đúng, không bao giờ dính mép màn hình dù ở độ phân giải nào.
// Chỉ là PRESENTATION — không đổi logic xác thực (SupabaseService.signInWithGoogle giữ nguyên).
// Chưa có tên/logo chính thức nên KHÔNG hard-code brand name — chỉ dùng icon lịch trừu tượng.

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SupabaseService } from './supabase.service';

interface EventCard {
  title: string;
  meta: string;
  dot: string;
  iconColor: string;
  icon: 'people' | 'video' | 'flag' | 'monitor';
  delay: number;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-scene auth-fade-in relative min-h-screen w-full overflow-x-hidden" style="background: linear-gradient(180deg, #0d1130 0%, #182463 32%, #2c3480 60%, #443f96 82%, #55499f 100%);">
      <!-- ============ NỀN: bầu trời nhiều lớp chiều sâu ============ -->
      <!-- sao lấp lánh -->
      <div class="pointer-events-none absolute inset-0">
        @for (s of stars; track $index) {
          <span
            class="auth-star absolute rounded-full bg-white"
            [style.left.%]="s.x"
            [style.top.%]="s.y"
            [style.width.px]="s.size"
            [style.height.px]="s.size"
            [style.animation-delay.s]="s.delay"
          ></span>
        }
      </div>

      <!-- sao băng -->
      <div class="pointer-events-none absolute left-[10%] top-[10%] hidden lg:block">
        <div class="auth-shooting-star h-px w-28 bg-gradient-to-l from-white/90 to-transparent"></div>
      </div>

      <!-- trăng lưỡi liềm -->
      <div class="pointer-events-none absolute right-[8%] top-[7%] hidden sm:block">
        <div class="absolute -inset-5 rounded-full bg-amber-100/25 blur-2xl"></div>
        <svg width="44" height="44" viewBox="0 0 44 44" class="relative" aria-hidden="true">
          <path d="M30 3a19 19 0 1 0 0 38 15.5 15.5 0 0 1 0-38Z" fill="#fdf3d8" />
        </svg>
      </div>

      <!-- mây trôi rất chậm -->
      <div class="pointer-events-none absolute inset-0 hidden md:block">
        <div class="auth-cloud absolute left-[12%] top-[16%] h-8 w-40 rounded-full bg-white/[0.08] blur-xl"></div>
        <div class="auth-cloud absolute right-[18%] top-[24%] h-9 w-52 rounded-full bg-white/[0.07] blur-xl" style="animation-delay: -14s"></div>
      </div>

      <!-- đồi núi nhiều lớp (xa -> gần: đậm -> sáng dần), phủ ~38% chiều cao dưới cùng -->
      <div class="pointer-events-none absolute inset-x-0 bottom-0">
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" class="w-full" style="height: 30vh; min-height: 170px;" aria-hidden="true">
          <path d="M0,200 Q180,140 360,185 T720,175 T1080,195 T1440,165 L1440,320 L0,320 Z" fill="#232d6e" />
        </svg>
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" class="absolute inset-x-0 bottom-0 w-full" style="height: 21vh; min-height: 130px;" aria-hidden="true">
          <path d="M0,235 Q200,185 400,225 T800,215 T1200,235 T1440,205 L1440,320 L0,320 Z" fill="#2e3888" />
        </svg>
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" class="absolute inset-x-0 bottom-0 w-full" style="height: 13vh; min-height: 84px;" aria-hidden="true">
          <path d="M0,270 Q220,225 440,260 T880,250 T1320,270 L1440,260 L1440,320 L0,320 Z" fill="#4750ab" />
        </svg>

        <!-- cây + nhà nhỏ + đèn đom đóm trên lớp đồi gần nhất, chỉ hiện md+ -->
        <div class="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[13vh] min-h-[84px] md:block">
          <svg width="16" height="24" viewBox="0 0 16 24" class="absolute bottom-3 left-[5%] opacity-90" aria-hidden="true">
            <path d="M8 0 2 13h4l-4 11h12l-4-11h4Z" fill="#1c2456" />
          </svg>
          <svg width="13" height="19" viewBox="0 0 13 19" class="absolute bottom-2 left-[9%] opacity-80" aria-hidden="true">
            <path d="M6.5 0 2 10h3l-3 9h9l-3-9h3Z" fill="#1c2456" />
          </svg>
          <!-- nhà nhỏ có cửa sổ sáng đèn -->
          <svg width="30" height="26" viewBox="0 0 30 26" class="absolute bottom-2 left-[16%]" aria-hidden="true">
            <path d="M15 1 28 12v13H2V12Z" fill="#1c2456" />
            <rect x="12" y="16" width="6" height="7" rx="1" fill="#fbbf24" opacity="0.85" />
          </svg>
          <svg width="16" height="24" viewBox="0 0 16 24" class="absolute bottom-4 right-[8%] opacity-90" aria-hidden="true">
            <path d="M8 0 2 13h4l-4 11h12l-4-11h4Z" fill="#1c2456" />
          </svg>
          @for (f of fireflies; track $index) {
            <span
              class="auth-firefly absolute rounded-full bg-amber-200"
              [style.left.%]="f.x"
              [style.bottom.px]="f.y"
              [style.animation-delay.s]="f.delay"
            ></span>
          }
        </div>
      </div>

      <!-- ============ SCENE CHÍNH: linh vật + (thẻ sự kiện | login | thẻ sự kiện) + timeline ============ -->
      <div class="relative z-20 flex min-h-screen flex-col items-center px-4 pb-10 pt-8 sm:pt-10">
        <!-- Dây nét đứt nối 2 thẻ sự kiện mỗi bên: Team Meeting → Google Meet (trái),
             Project Deadline → Design Review (phải). Chỉ hiện cùng lúc với 2 cột thẻ (xl:).
             Trục X dùng hệ toạ độ CANH GIỮA rộng 1180px (giống hệt max-w-[1180px] của lưới
             thẻ/login) qua "left-1/2 -translate-x-1/2 max-w-[1180px]", KHÔNG kéo giãn theo
             toàn bộ chiều rộng scene — vì lưới thẻ canh giữa cố định ở 1180px bất kể viewport
             rộng bao nhiêu, còn nếu SVG kéo giãn theo chiều rộng scene thì toạ độ sẽ lệch
             hàng chục-hàng trăm px so với thẻ thật ở mọi độ rộng khác 1920px. -->
        <svg class="auth-wire-in pointer-events-none absolute left-1/2 top-0 hidden h-full w-full max-w-[1180px] -translate-x-1/2 xl:block" viewBox="0 0 1180 1000" preserveAspectRatio="none" aria-hidden="true">
          <path d="M214,471.8 V498" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4 4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          <path d="M966,471.8 V498" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4 4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>

        <!-- vùng giữa: chiếm phần lớn chiều cao, căn giữa linh vật + login -->
        <div class="flex w-full flex-1 flex-col items-center justify-center gap-6">
          <!-- LINH VẬT: dáng đứng bo tròn, 1 tay vẫy chào (bất đối xứng) + icon lịch trên bụng -->
          <div class="auth-mascot-float relative z-10 mb-[-18px] h-32 w-28 sm:h-36 sm:w-32" aria-hidden="true">
            <div class="absolute -bottom-2 left-1/2 h-3.5 w-16 -translate-x-1/2 rounded-full bg-indigo-300/35 blur-md"></div>
            <svg viewBox="0 0 100 100" class="relative h-full w-full drop-shadow-[0_10px_26px_rgba(99,102,241,0.45)]">
              <line x1="50" y1="17" x2="50" y2="5" stroke="#a5b4fc" stroke-width="3" stroke-linecap="round" />
              <circle cx="50" cy="4" r="3.8" fill="#fbbf24" />
              <!-- tay vẫy bên phải: mập + ngắn, gần sát thân để liền khối (không phải que gậy mảnh);
                   vẽ TRƯỚC thân để gốc tay khuất sau vai, chỉ đoạn nhô ra + bàn tay là thấy rõ -->
              <path d="M60 67q28 -8 25 -32" stroke="#6d6bf3" stroke-width="13" stroke-linecap="round" fill="none" />
              <circle cx="86" cy="35" r="9.5" fill="#b4b5f8" />
              <!-- thân: 2 hình ellipse cùng màu chồng nhau tạo dáng bầu bĩnh, phần bụng phình nhẹ -->
              <ellipse cx="50" cy="50" rx="28" ry="30" fill="#6d6bf3" />
              <ellipse cx="50" cy="74" rx="23" ry="15" fill="#6d6bf3" />
              <!-- icon lịch trên bụng -->
              <rect x="38" y="65" width="24" height="20" rx="4" fill="#4740c7" />
              <rect x="38" y="65" width="24" height="6.5" rx="2.5" fill="#f0b429" />
              <line x1="43.5" y1="62.5" x2="43.5" y2="67.5" stroke="#f0b429" stroke-width="2" stroke-linecap="round" />
              <line x1="56.5" y1="62.5" x2="56.5" y2="67.5" stroke="#f0b429" stroke-width="2" stroke-linecap="round" />
              <circle cx="45.5" cy="77" r="1.6" fill="#c7d2fe" />
              <circle cx="54.5" cy="77" r="1.6" fill="#c7d2fe" />
              <!-- má hồng -->
              <ellipse cx="30" cy="52" rx="4.2" ry="2.8" fill="#fda4af" opacity="0.55" />
              <ellipse cx="70" cy="52" rx="4.2" ry="2.8" fill="#fda4af" opacity="0.55" />
              <!-- mắt: chấm đen tròn to kiểu hoạt hình, có chấm sáng nhỏ -->
              <ellipse cx="40" cy="45" rx="4.3" ry="5.2" fill="#181433" />
              <ellipse cx="60" cy="45" rx="4.3" ry="5.2" fill="#181433" />
              <circle cx="41.6" cy="42.4" r="1.2" fill="white" />
              <circle cx="61.6" cy="42.4" r="1.2" fill="white" />
              <!-- miệng cười -->
              <path d="M42 57q8 6 16 0" stroke="white" stroke-width="2.6" fill="none" stroke-linecap="round" />
            </svg>
          </div>

          <!-- LƯỚI 3 CỘT: thẻ trái | login | thẻ phải — grid tự đảm bảo khoảng cách, không bao giờ dính mép -->
          <div class="relative grid w-full max-w-[1180px] grid-cols-1 items-center justify-center gap-6 xl:grid-cols-[224px_400px_224px] xl:gap-x-16">
            <!-- Dây nét đứt nối mỗi thẻ sự kiện vào login card — chỉ hiện khi 2 cột thẻ hiện
                 (xl:), toạ độ đo thực tế: mỗi thẻ cách login card đúng 64px (đúng bằng gap-x-16),
                 thẳng theo tâm dọc của thẻ đó (xem measure2.js nếu cần tính lại). Kéo dài thêm
                 ~6px qua khỏi mép login card/thẻ (ẩn phía sau) để tránh dash-phase làm dây nhìn
                 hụt trước đích (xem comment chi tiết ở dây nối cờ/ghim bên trên). -->
            <svg class="auth-wire-in pointer-events-none absolute inset-0 z-0 hidden h-full w-full xl:block" viewBox="0 0 1180 373" preserveAspectRatio="none" aria-hidden="true">
              <path d="M326,140 H396" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4 4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
              <path d="M326,233 H396" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4 4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
              <path d="M790,140 H860" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4 4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
              <path d="M790,233 H860" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4 4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            </svg>

            <!-- cột trái -->
            <div class="hidden flex-col gap-6 xl:flex">
              @for (c of leftCards; track c.title) {
                <div class="auth-card-float flex w-full items-center gap-3 rounded-2xl border border-white/[0.14] bg-white/[0.09] px-4 py-3.5 shadow-lg shadow-black/25 backdrop-blur-md" [style.--card-delay]="c.delay + 's'">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl {{ c.iconColor }}">
                    @switch (c.icon) {
                      @case ('people') {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="3" /><path d="M14.5 20a5.5 5 0 0 1 8 -3.5" /></svg>
                      }
                      @case ('video') {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>
                      }
                      @case ('flag') {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18" /><path d="M5 4h13l-3 4 3 4H5" /></svg>
                      }
                      @case ('monitor') {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></svg>
                      }
                    }
                  </span>
                  <span class="min-w-0">
                    <span class="block truncate text-[13px] font-medium text-white">{{ c.title }}</span>
                    <span class="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/50">
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full {{ c.dot }}"></span>{{ c.meta }}
                    </span>
                  </span>
                </div>
              }
            </div>

            <!-- LOGIN CARD -->
            <div class="auth-rise-in relative z-10 mx-auto w-full max-w-[400px] rounded-[26px] border border-white/[0.14] bg-[#0c1030]/80 p-9 text-center shadow-2xl shadow-[#0c1030]/60 ring-1 ring-indigo-400/10 backdrop-blur-xl" style="animation-delay: 0.15s; box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 25px 60px -15px rgba(0,0,0,0.6), 0 0 80px -20px rgba(129,140,248,0.35);">
              <div class="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08]">
                <svg width="26" height="26" viewBox="0 0 96 96" aria-hidden="true">
                  <defs>
                    <linearGradient id="fsGradLogin" x1="8" y1="88" x2="90" y2="6" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stop-color="#a5b4fc" />
                      <stop offset=".55" stop-color="#c4b5fd" />
                      <stop offset="1" stop-color="#67e8f9" />
                    </linearGradient>
                  </defs>
                  <path d="M58 14 L58 82 M58 52 L16 52 L42 14" fill="none" stroke="url(#fsGradLogin)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M50 20 C60 6 86 6 94 20 C86 34 60 34 50 20 Z" fill="url(#fsGradLogin)" />
                  <circle cx="79" cy="20" r="7" fill="#0c1030" />
                  <circle cx="82" cy="17" r="1.8" fill="#fff" opacity=".9" />
                </svg>
              </div>

              <p class="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-white/50">Foresight</p>
              <h1 class="text-[25px] font-semibold tracking-tight text-white">Welcome back</h1>
              <p class="mx-auto mt-2 max-w-[250px] text-[14px] leading-relaxed text-white/55">
                Organize your time.<br />Make every moment count.
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
                class="mt-7 flex h-[50px] w-full items-center justify-center gap-3 rounded-xl bg-white text-[14px] font-semibold text-gray-800 transition-all duration-150 ease-out hover:-translate-y-px hover:bg-white hover:shadow-[0_8px_24px_-6px_rgba(129,140,248,0.55)] active:scale-[0.98] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
              >
                @if (isLoading()) {
                  <span class="spin h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600"></span>
                  <span>Redirecting…</span>
                } @else {
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                  </svg>
                  <span>Continue with Google</span>
                }
              </button>

              <p class="mt-5 flex items-center justify-center gap-1.5 text-[11.5px] text-white/45">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                Your data is safe with us.
              </p>
              <p class="mt-1.5 text-[11.5px] leading-relaxed text-white/30">
                By continuing, you agree to our Terms and Privacy Policy.
              </p>
            </div>

            <!-- cột phải -->
            <div class="hidden flex-col gap-6 xl:flex">
              @for (c of rightCards; track c.title) {
                <div class="auth-card-float flex w-full items-center gap-3 rounded-2xl border border-white/[0.14] bg-white/[0.09] px-4 py-3.5 shadow-lg shadow-black/25 backdrop-blur-md" [style.--card-delay]="c.delay + 's'">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl {{ c.iconColor }}">
                    @switch (c.icon) {
                      @case ('people') {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="3" /><path d="M14.5 20a5.5 5 0 0 1 8 -3.5" /></svg>
                      }
                      @case ('video') {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>
                      }
                      @case ('flag') {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18" /><path d="M5 4h13l-3 4 3 4H5" /></svg>
                      }
                      @case ('monitor') {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></svg>
                      }
                    }
                  </span>
                  <span class="min-w-0">
                    <span class="block truncate text-[13px] font-medium text-white">{{ c.title }}</span>
                    <span class="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/50">
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full {{ c.dot }}"></span>{{ c.meta }}
                    </span>
                  </span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- ============ TIMELINE — tuần thành 1 con đường, uốn nhẹ ============ -->
        <div class="mt-8 hidden w-full shrink-0 md:block" style="margin-bottom: clamp(50px, 8vh, 100px);">
          <div class="relative mx-auto flex max-w-2xl items-start justify-between px-10">
            <!-- Dây nối chạy đúng qua TÂM từng icon MON→FRI (toạ độ đo thực tế từ layout,
                 xem measure.js khi cần tính lại nếu đổi kích thước icon/offset). -->
            <svg class="pointer-events-none absolute -top-1.5 left-0 h-9 w-full" viewBox="0 0 672 36" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M56,32 Q193,26 264.5,27 Q336,28 407.5,27 Q479,26 616,32"
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                stroke-width="1.5"
                vector-effect="non-scaling-stroke"
              />
            </svg>

            @for (d of week; track d.label) {
              <div class="relative z-10 flex flex-col items-center gap-2.5" [style.transform]="'translateY(' + d.offset + 'px)'">
                @if (d.active) {
                  <span class="auth-node-glow absolute -top-3 h-14 w-14 rounded-full bg-indigo-400/50 blur-md"></span>
                }
                <span
                  [class]="'relative flex shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-black/30 ' + d.bg + (d.active ? ' h-11 w-11 ring-[3px] ring-indigo-200/50' : ' h-8 w-8 ring-1 ring-white/10')"
                >
                  @switch (d.icon) {
                    @case ('notes') {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>
                    }
                    @case ('check') {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                    }
                    @case ('calendar') {
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4M16 3v4M4 11h16" /></svg>
                    }
                    @case ('dice') {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="9" cy="9" r="0.6" fill="white" /><circle cx="15" cy="9" r="0.6" fill="white" /><circle cx="12" cy="12" r="0.6" fill="white" /><circle cx="9" cy="15" r="0.6" fill="white" /><circle cx="15" cy="15" r="0.6" fill="white" /></svg>
                    }
                    @case ('star') {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.6 6.6-.9z" /></svg>
                    }
                  }
                </span>
                <span [class]="'text-[11px] font-semibold tracking-wide ' + (d.active ? 'text-white' : 'text-white/45')">{{ d.label }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginPageComponent {
  private readonly supabase = inject(SupabaseService);

  errorMessage = signal<string | null>(null);
  isLoading = signal(false);

  /** MON→FRI, WED nhấn mạnh + hơi nhô cao hơn (uốn nhẹ theo landscape) — chỉ trang trí */
  protected readonly week: {
    label: string;
    active: boolean;
    offset: number;
    icon: 'notes' | 'check' | 'calendar' | 'dice' | 'star';
    bg: string;
  }[] = [
    { label: 'MON', active: false, offset: 10, icon: 'notes', bg: 'bg-blue-500' },
    { label: 'TUE', active: false, offset: 4, icon: 'check', bg: 'bg-emerald-500' },
    { label: 'WED', active: true, offset: 0, icon: 'calendar', bg: 'bg-indigo-500' },
    { label: 'THU', active: false, offset: 4, icon: 'dice', bg: 'bg-blue-500' },
    { label: 'FRI', active: false, offset: 10, icon: 'star', bg: 'bg-rose-500' },
  ];

  /** Sao trên nền trời — vị trí tính giả-ngẫu-nhiên (deterministic) từ index */
  protected readonly stars = Array.from({ length: 30 }, (_, i) => ({
    x: (i * 37.5) % 100,
    y: (i * 21.3) % 55,
    size: 1 + (i % 3),
    delay: (i % 9) * 0.35,
  }));

  protected readonly fireflies = Array.from({ length: 6 }, (_, i) => ({
    x: 12 + ((i * 61) % 76),
    y: 6 + ((i * 23) % 40),
    delay: i * 0.6,
  }));

  /** Dữ liệu MOCK thuần trang trí — không gọi API, không liên quan Calendar thật */
  protected readonly leftCards: EventCard[] = [
    { title: 'Team Meeting', meta: '10:00 AM', icon: 'people', iconColor: 'bg-violet-500/80', dot: 'bg-violet-400', delay: 0 },
    { title: 'Google Meet', meta: '01:30 PM', icon: 'video', iconColor: 'bg-cyan-500/80', dot: 'bg-cyan-400', delay: 0.5 },
  ];
  protected readonly rightCards: EventCard[] = [
    { title: 'Project Deadline', meta: 'Friday', icon: 'flag', iconColor: 'bg-amber-500/80', dot: 'bg-amber-400', delay: 1 },
    { title: 'Design Review', meta: '03:00 PM', icon: 'monitor', iconColor: 'bg-indigo-500/80', dot: 'bg-indigo-400', delay: 1.5 },
  ];

  async loginWithGoogle(): Promise<void> {
    this.errorMessage.set(null);
    this.isLoading.set(true);

    const { error } = await this.supabase.signInWithGoogle();

    // Nếu gọi thành công, trình duyệt sẽ tự chuyển hướng sang trang đăng nhập Google.
    // Chỉ khi có lỗi (vd cấu hình OAuth sai) mới cần hiển thị lại thông báo ở đây.
    if (error) {
      this.isLoading.set(false);
      this.errorMessage.set('Could not open Google sign-in. Check the OAuth configuration in Supabase.');
    }
  }
}
