// Route guard: chặn không cho vào các trang cần đăng nhập (vd trang Calendar chính)
// nếu chưa có session hợp lệ — tự động đá về /login.

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();

  if (data.session) return true;

  router.navigateByUrl('/login');
  return false;
};
