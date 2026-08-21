// Trang đăng nhập / đăng ký. 1 form dùng chung cho cả 2 chế độ (chuyển qua lại bằng tab),
// cộng thêm nút "Đăng nhập bằng Google".

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { IconComponent } from '../shared/icon.component';
import { TranslateService } from '../i18n/translate.service';

type Mode = 'signin' | 'signup' | 'forgot';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 class="mb-1 flex items-center justify-center gap-2 text-center text-xl font-medium text-gray-800">
          <app-icon name="calendar" class="h-6 w-6 text-blue-600" /> {{ tr.t('nav.calendar') }}
        </h1>
        <p class="mb-6 text-center text-sm text-gray-500">
          {{ tr.t('login.sub.' + mode()) }}
        </p>

        @if (mode() !== 'forgot') {
          <div class="mb-4 flex rounded-lg bg-gray-100 p-1 text-sm">
            <button
              type="button"
              (click)="switchMode('signin')"
              class="flex-1 rounded-md py-1.5" [class.bg-white]="mode() === 'signin'" [class.shadow]="mode() === 'signin'" > {{ tr.t('login.signin') }}
            </button>
            <button
              type="button"
              (click)="switchMode('signup')"
              class="flex-1 rounded-md py-1.5"
              [class.bg-white]="mode() === 'signup'"
              [class.shadow]="mode() === 'signup'"
            >{{ tr.t('login.signup') }}</button>
          </div>
        }

        <form (submit)="submit($event)" class="space-y-3">
          <div>
            <label class="mb-1 block text-xs text-gray-500">{{ tr.t('login.email') }}</label>
            <input
              type="email"
              required
              [(ngModel)]="email"
              name="email"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
              placeholder="ban@example.com"
            />
          </div>
          @if (mode() !== 'forgot') {
            <div>
              <label class="mb-1 block text-xs text-gray-500">{{ tr.t('login.password') }}</label>
              <input
                type="password"
                required
                minlength="6"
                [(ngModel)]="password"
                name="password"
                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
                [placeholder]="tr.t('login.min6')"
              />
            </div>
          }

          @if (mode() === 'signup') {
            <div>
              <label class="mb-1 block text-xs text-gray-500">{{ tr.t('login.confirmPw') }}</label>
              <input
                type="password"
                required
                minlength="6"
                [(ngModel)]="confirmPassword"
                name="confirmPassword"
                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
                [placeholder]="tr.t('login.reenter')"
              />
            </div>
          }

          @if (mode() === 'signin') {
            <div class="text-right">
              <button type="button" (click)="switchMode('forgot')" class="text-xs text-blue-700 hover:underline">{{ tr.t('login.forgot') }}</button>
            </div>
          }

          @if (mode() === 'forgot' && resetSent()) {
            <p class="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              {{ tr.t('login.resetSent') }}
            </p>
          }

          @if (errorMessage()) {
            <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage() }}</p>
          }

          <button
            type="submit"
            [disabled]="isLoading()"
            class="w-full rounded-md bg-blue-700 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {{ isLoading() ? tr.t('login.processing') : mode() === 'signin' ? tr.t('login.signin') : mode() === 'signup' ? tr.t('login.signup') : tr.t('login.sendReset') }}
          </button>

          @if (mode() === 'forgot') {
            <button type="button" (click)="switchMode('signin')" class="w-full text-center text-xs text-gray-500 hover:underline">
              {{ tr.t('login.back') }}
            </button>
          }
        </form>

        @if (mode() !== 'forgot') {
          <div class="my-4 flex items-center gap-2 text-xs text-gray-400">
            <span class="h-px flex-1 bg-gray-200"></span>
            {{ tr.t('login.or') }}
            <span class="h-px flex-1 bg-gray-200"></span>
          </div>

          <button
            type="button"
            (click)="loginWithGoogle()"
            class="w-full rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >{{ tr.t('login.google') }}</button>
        }
      </div>
    </div>
  `,
})
export class LoginPageComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  protected readonly tr = inject(TranslateService);

  /** Dịch vài lỗi phổ biến của Supabase Auth theo ngôn ngữ hiện tại. */
  private authError(message: string): string {
    const map: Record<string, string> = {
      'Invalid login credentials': 'login.err.invalid',
      'User already registered': 'login.err.registered',
      'Password should be at least 6 characters': 'login.err.pw6',
    };
    return map[message] ? this.tr.t(map[message]) : message;
  }

  mode = signal<Mode>('signin');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  errorMessage = signal<string | null>(null);
  isLoading = signal(false);
  /** true khi đã gửi email đặt lại mật khẩu (hiện thông báo thành công) */
  resetSent = signal(false);

  /** Đổi chế độ (đăng nhập / đăng ký / quên mật khẩu) và xóa thông báo cũ */
  switchMode(m: Mode): void {
    this.mode.set(m);
    this.errorMessage.set(null);
    this.resetSent.set(false);
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    const email = this.email().trim();
    const password = this.password();

    // Chế độ QUÊN MẬT KHẨU: gửi email đặt lại rồi dừng
    if (this.mode() === 'forgot') {
      if (!email) {
        this.errorMessage.set(this.tr.t('login.enterEmail'));
        return;
      }
      this.isLoading.set(true);
      const { error } = await this.supabase.resetPasswordForEmail(email);
      this.isLoading.set(false);
      if (error) {
        this.errorMessage.set(this.authError(error.message));
        return;
      }
      this.resetSent.set(true);
      return;
    }

    // Khi đăng ký: kiểm tra 2 ô mật khẩu khớp nhau trước khi gọi API
    if (this.mode() === 'signup' && password !== this.confirmPassword()) {
      this.errorMessage.set(this.tr.t('login.pwMismatch'));
      return;
    }

    this.isLoading.set(true);

    const { error } =
      this.mode() === 'signin'
        ? await this.supabase.signInWithPassword(email, password)
        : await this.supabase.signUp(email, password);

    this.isLoading.set(false);

    if (error) {
      this.errorMessage.set(this.authError(error.message));
      return;
    }

    this.router.navigateByUrl('/');
  }

  async loginWithGoogle(): Promise<void> {
    await this.supabase.signInWithGoogle();
    // Trình duyệt sẽ tự chuyển hướng sang trang đăng nhập Google, không cần xử lý thêm ở đây
  }
}
