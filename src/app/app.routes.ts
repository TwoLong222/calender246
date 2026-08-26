import { Routes } from '@angular/router';
import { CalendarPageComponent } from './calendar/calendar-page.component';
import { AuthCallbackComponent } from './auth/auth-callback.component';
import { authGuard } from './auth/auth.guard';
import { homeGuard } from './auth/home.guard';
import { LoginPageComponent } from './auth/login-page.component';
import { ResetPasswordComponent } from './auth/reset-password.component';
import { SettingsPageComponent } from './settings/settings-page.component';
import { PublicBookingComponent } from './booking/public-booking.component';
import { TaskListComponent } from './calendar/task-list.component';
import { LunarPageComponent } from './lunar/lunar-page.component';
import { NotesPageComponent } from './notes/notes-page.component';
import { InvitationsPageComponent } from './calendar/invitations-page.component';
import { NotificationHistoryPageComponent } from './notifications/notification-history-page.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'book/:slug', component: PublicBookingComponent },
  { path: 'settings', component: SettingsPageComponent, canActivate: [authGuard] },
  { path: 'tasks', component: TaskListComponent, canActivate: [authGuard] },
  { path: 'am-lich', component: LunarPageComponent, canActivate: [authGuard] },
  { path: 'notes', component: NotesPageComponent, canActivate: [authGuard] },
  { path: 'invitations', component: InvitationsPageComponent, canActivate: [authGuard] },
  { path: 'notification-history', component: NotificationHistoryPageComponent, canActivate: [authGuard] },
  { path: '', component: CalendarPageComponent, canActivate: [homeGuard] },
];
