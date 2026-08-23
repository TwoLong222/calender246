// Trang đặt lại mật khẩu — người dùng tới đây sau khi bấm link trong email "quên mật khẩu".
// Lúc đó Supabase đã tạo sẵn 1 phiên khôi phục (recovery session) từ token trên URL,
// nên chỉ cần nhập mật khẩu mới rồi gọi updateUser({ password }).

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { IconComponent } from '../shared/icon.component';
import { TranslateService } from '../i18n/translate.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 class="mb-1 flex items-center justify-center gap-2 text-center text-xl font-medium text-gray-800">
          <app-icon name="calendar" class="h-6 w-6 text-blue-600" /> {{ tr.t('nav.calendar') }}
        </h1>
        <p class="mb-6 text-center text-sm text-gray-500">{{ tr.t('reset.title') }}</p>

        @if (done()) {
          <p class="rounded-md bg-green-50 px-3 py-2 text-center text-sm text-green-700">
            {{ tr.t('reset.success') }}
          </p>
        } @else {
          <form (submit)="submit($event)" class="space-y-3">
            <div>
              <label class="mb-1 block text-xs text-gray-500">{{ tr.t('reset.newPw') }}</label>
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
            <div>
              <label class="mb-1 block text-xs text-gray-500">{{ tr.t('login.confirmPw') }}</label>
              <input
                type="password"
                required
                minlength="6"
                [(ngModel)]="confirmPassword"
                name="confirmPassword"
                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
                [placeholder]="tr.t('reset.reenter')"
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
              {{ isLoading() ? tr.t('login.processing') : tr.t('acc.changePw') }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class ResetPasswordComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  protected readonly tr = inject(TranslateService);

  password = signal('');
  confirmPassword = signal('');
  errorMessage = signal<string | null>(null);
  isLoading = signal(false);
  done = signal(false);

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    if (this.password().length < 6) {
      this.errorMessage.set(this.tr.t('login.err.pw6'));
      return;
    }
    if (this.password() !== this.confirmPassword()) {
      this.errorMessage.set(this.tr.t('login.pwMismatch'));
      return;
    }

    this.isLoading.set(true);
    const { error } = await this.supabase.updatePassword(this.password());
    this.isLoading.set(false);

    if (error) {
      this.errorMessage.set(error.message);
      return;
    }
    this.done.set(true);
    setTimeout(() => this.router.navigateByUrl('/'), 1500);
  }
}
