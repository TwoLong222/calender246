// Trang đăng nhập — CHỈ dùng tài khoản Google (OAuth).
// Không có đăng ký / đăng nhập bằng email-mật khẩu: toàn bộ xác thực đi qua Google,
// Supabase chỉ đóng vai trò xử lý phiên (session) phía sau.

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 class="mb-1 text-center text-2xl font-medium text-gray-800">📅 Lịch</h1>
        <p class="mb-8 text-center text-sm text-gray-500">Đăng nhập bằng tài khoản Google để tiếp tục</p>

        @if (errorMessage()) {
          <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage() }}</p>
        }

        <button
          type="button"
          (click)="loginWithGoogle()"
          [disabled]="isLoading()"
          class="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          {{ isLoading() ? 'Đang chuyển hướng...' : 'Đăng nhập bằng Google' }}
        </button>
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
