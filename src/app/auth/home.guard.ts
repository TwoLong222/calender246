// Guard riêng cho route gốc ("/"): đã đăng nhập -> vào thẳng Calendar.
// Chưa đăng nhập -> điều hướng full-page sang trang landing tĩnh (public/landing/index.html),
// KHÁC với authGuard (dùng cho các route cần đăng nhập khác, vốn đá thẳng về /login).

import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { SupabaseService } from './supabase.service';

export const homeGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);

  // Dùng getSessionAfterOAuth: nếu vừa quay về từ màn hình cấp quyền Google (URL còn
  // mang ?code=…) thì đợi đổi mã xong mới kết luận — tránh đá người dùng ra landing
  // ngay sau khi họ vừa bấm "Continue".
  const session = await supabase.getSessionAfterOAuth();

  if (session) return true;

  window.location.href = '/landing/index.html';
  return false;
};
