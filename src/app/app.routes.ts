import { Routes } from '@angular/router';
import { CalendarPageComponent } from './calendar/calendar-page.component';
import { AuthCallbackComponent } from './auth/auth-callback.component';
import { authGuard } from './auth/auth.guard';
import { LoginPageComponent } from './auth/login-page.component';
import { ResetPasswordComponent } from './auth/reset-password.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: '', component: CalendarPageComponent, canActivate: [authGuard] },
];
