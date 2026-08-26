// Route guard: chặn không cho vào các trang cần đăng nhập (vd trang Calendar chính)
// nếu chưa có session hợp lệ — tự động đá về /login.

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Chờ nếu đang quay về từ màn hình cấp quyền Google (vd bấm "Tạo Meet" ở trang Cài đặt)
  // — lúc đó URL còn mang mã OAuth và session chỉ có sau khi đổi mã xong.
  const session = await supabase.getSessionAfterOAuth();

  if (session) return true;

  router.navigateByUrl('/login');
  return false;
};
