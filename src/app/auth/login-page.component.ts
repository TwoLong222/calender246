// Trang đăng nhập / đăng ký. 1 form dùng chung cho cả 2 chế độ (chuyển qua lại bằng tab),
// cộng thêm nút "Đăng nhập bằng Google".

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

type Mode = 'signin' | 'signup';

/** Dịch vài lỗi phổ biến của Supabase Auth sang tiếng Việt cho dễ hiểu */
function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Email hoặc mật khẩu không đúng.',
    'User already registered': 'Email này đã được đăng ký, hãy chuyển sang tab Đăng nhập.',
    'Password should be at least 6 characters': 'Mật khẩu cần tối thiểu 6 ký tự.',
  };
  return map[message] ?? message;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 class="mb-1 text-center text-xl font-medium text-gray-800">📅 Lịch</h1>
        <p class="mb-6 text-center text-sm text-gray-500">
          {{ mode() === 'signin' ? 'Đăng nhập để tiếp tục' : 'Tạo tài khoản mới' }}
        </p>

        <div class="mb-4 flex rounded-lg bg-gray-100 p-1 text-sm">
          <button
            type="button"
            (click)="mode.set('signin')"
            class="flex-1 rounded-md py-1.5"
            [class.bg-white]="mode() === 'signin'"
            [class.shadow]="mode() === 'signin'"
          >
            Đăng nhập
          </button>
          <button
            type="button"
            (click)="mode.set('signup')"
            class="flex-1 rounded-md py-1.5"
            [class.bg-white]="mode() === 'signup'"
            [class.shadow]="mode() === 'signup'"
          >
            Đăng ký
          </button>
        </div>

        <form (submit)="submit($event)" class="space-y-3">
          <div>
            <label class="mb-1 block text-xs text-gray-500">Email</label>
            <input
              type="email"
              required
              [(ngModel)]="email"
              name="email"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
              placeholder="ban@example.com"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">Mật khẩu</label>
            <input
              type="password"
              required
              minlength="6"
              [(ngModel)]="password"
              name="password"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
              placeholder="Tối thiểu 6 ký tự"
            />
          </div>

          @if (errorMessage()) {
            <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage() }}</p>
          }

          <button
            type="submit"
            [disabled]="isLoading()"
            class="w-full rounded-md bg-blue-700 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {{ isLoading() ? 'Đang xử lý...' : mode() === 'signin' ? 'Đăng nhập' : 'Đăng ký' }}
          </button>
        </form>

        <div class="my-4 flex items-center gap-2 text-xs text-gray-400">
          <span class="h-px flex-1 bg-gray-200"></span>
          hoặc
          <span class="h-px flex-1 bg-gray-200"></span>
        </div>

        <button
          type="button"
          (click)="loginWithGoogle()"
          class="w-full rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Đăng nhập bằng Google
        </button>
      </div>
    </div>
  `,
})
export class LoginPageComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  mode = signal<Mode>('signin');
  email = signal('');
  password = signal('');
  errorMessage = signal<string | null>(null);
  isLoading = signal(false);

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);
    this.isLoading.set(true);

    const email = this.email().trim();
    const password = this.password();

    const { error } =
      this.mode() === 'signin'
        ? await this.supabase.signInWithPassword(email, password)
        : await this.supabase.signUp(email, password);

    this.isLoading.set(false);

    if (error) {
      this.errorMessage.set(translateAuthError(error.message));
      return;
    }

    this.router.navigateByUrl('/');
  }

  async loginWithGoogle(): Promise<void> {
    await this.supabase.signInWithGoogle();
    // Trình duyệt sẽ tự chuyển hướng sang trang đăng nhập Google, không cần xử lý thêm ở đây
  }
}
