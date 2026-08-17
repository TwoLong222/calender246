import { Routes } from '@angular/router';
import { CalendarPageComponent } from './calendar/calendar-page.component';
import { AuthCallbackComponent } from './auth/auth-callback.component';
import { authGuard } from './auth/auth.guard';
import { LoginPageComponent } from './auth/login-page.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: '', component: CalendarPageComponent, canActivate: [authGuard] },
];
