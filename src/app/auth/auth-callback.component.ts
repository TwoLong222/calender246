// Trang trung gian: Google OAuth sau khi xác thực xong sẽ redirect trình duyệt về
// đúng URL này (đã khai báo trong SupabaseService.signInWithGoogle và trong Supabase
// Dashboard > Authentication > URL Configuration).
//
// supabase-js tự đọc "code" nằm trong URL và tạo session (cơ chế PKCE flow mặc định)
// ngay khi client được khởi tạo — ta chỉ cần đợi rồi điều hướng về trang chính.

import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { TranslateService } from '../i18n/translate.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="p-10 text-center text-sm text-gray-500">{{ tr.t('auth.signingIn') }}</p>`,
})
export class AuthCallbackComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  protected readonly tr = inject(TranslateService);

  async ngOnInit(): Promise<void> {
    await this.supabase.client.auth.getSession();
    this.router.navigateByUrl('/');
  }
}
