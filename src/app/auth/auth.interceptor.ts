// Interceptor: tự động gắn header "Authorization: Bearer <token>" vào MỌI request
// gọi tới backend NestJS (environment.apiUrl), để SupabaseAuthGuard bên NestJS xác thực được.
// Request gọi tới nơi khác (vd chính Supabase, hay API bên thứ 3) sẽ không bị đụng tới.

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { SupabaseService } from './supabase.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const supabase = inject(SupabaseService);

  return from(supabase.client.auth.getSession()).pipe(
    switchMap(({ data }) => {
      const token = data.session?.access_token;
      const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
      return next(authReq);
    }),
  );
};
