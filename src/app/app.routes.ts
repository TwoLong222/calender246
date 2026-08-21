import { Routes } from '@angular/router';
import { CalendarPageComponent } from './calendar/calendar-page.component';
import { AuthCallbackComponent } from './auth/auth-callback.component';
import { authGuard } from './auth/auth.guard';
import { LoginPageComponent } from './auth/login-page.component';
import { ResetPasswordComponent } from './auth/reset-password.component';
import { SettingsPageComponent } from './settings/settings-page.component';
import { PublicBookingComponent } from './booking/public-booking.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'book/:slug', component: PublicBookingComponent },
  { path: 'settings', component: SettingsPageComponent, canActivate: [authGuard] },
  { path: '', component: CalendarPageComponent, canActivate: [authGuard] },
];
