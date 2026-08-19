// TranslateService: i18n nhẹ, không thư viện ngoài.
// Ngôn ngữ lấy từ SettingsService.language (vi/en). t('key') tra từ điển.
// Dùng trong template: {{ t('nav.today') }} — tự phản ứng khi đổi ngôn ngữ (signal).
// Thêm chuỗi mới: thêm key vào cả 2 ngôn ngữ dưới đây (kiến trúc không hard-code).

import { Injectable, computed, inject } from '@angular/core';
import { SettingsService } from '../settings/settings.service';

type Lang = 'vi' | 'en';

const DICT: Record<Lang, Record<string, string>> = {
  vi: {
    // Nav / calendar chrome
    'nav.calendar': 'Lịch', 'nav.today': 'Hôm nay', 'nav.create': 'Tạo',
    'nav.show': 'Hiển thị', 'nav.settings': 'Cài đặt', 'nav.trash': 'Thùng rác',
    'nav.export': 'Xuất file .ics', 'nav.import': 'Nhập file .ics',
    'nav.search': 'Tìm sự kiện...', 'nav.loading': 'Đang tải...',
    'view.day': 'Ngày', 'view.week': 'Tuần', 'view.month': 'Tháng', 'view.year': 'Năm',
    'kind.event': 'Sự kiện', 'kind.task': 'Việc cần làm', 'kind.appointment': 'Lịch hẹn',
    // Settings shell
    'settings.title': 'Cài đặt', 'settings.back': 'Quay lại', 'settings.saving': 'Đang lưu…',
    'sec.account': 'Tài khoản', 'sec.general': 'Chung', 'sec.calendar': 'Lịch',
    'sec.notifications': 'Thông báo', 'sec.appearance': 'Giao diện',
    'sec.privacy': 'Riêng tư & Bảo mật', 'sec.email': 'Email', 'sec.ai': 'Trợ lý AI',
    'common.preview': 'Xem trước',
    // Account
    'acc.profile': 'Hồ sơ', 'acc.displayName': 'Tên hiển thị', 'acc.save': 'Lưu',
    'acc.email': 'Email', 'acc.created': 'Tạo tài khoản',
    'acc.changePw': 'Đổi mật khẩu', 'acc.curPw': 'Mật khẩu hiện tại',
    'acc.newPw': 'Mật khẩu mới (≥ 6 ký tự)', 'acc.confirmPw': 'Xác nhận mật khẩu mới',
    'acc.googleNote': 'Bạn đăng nhập bằng Google — mật khẩu do Google quản lý, không đổi tại đây.',
    'acc.danger': 'Vùng nguy hiểm',
    'acc.deleteWarn': 'Xoá tài khoản sẽ xoá vĩnh viễn toàn bộ lịch, sự kiện và cài đặt của bạn. Không thể hoàn tác.',
    'acc.deleteBtn': 'Xoá tài khoản',
    'acc.pwShort': 'Mật khẩu mới cần ≥ 6 ký tự.',
    'acc.pwMismatch': 'Xác nhận mật khẩu không khớp.',
    'acc.pwWrong': 'Mật khẩu hiện tại không đúng.',
    'acc.pwOk': 'Đổi mật khẩu thành công.',
    'acc.nameSaved': 'Đã lưu tên hiển thị.',
    // General
    'gen.language': 'Ngôn ngữ', 'gen.timezone': 'Múi giờ',
    'gen.dateFormat': 'Định dạng ngày', 'gen.timeFormat': 'Định dạng giờ',
    'gen.time24': '24 giờ (15:00)', 'gen.time12': '12 giờ (3:00 PM)',
    'gen.startWeek': 'Ngày bắt đầu tuần', 'gen.monday': 'Thứ Hai', 'gen.sunday': 'Chủ Nhật',
    // Calendar
    'cal.defaultView': 'Chế độ xem mặc định', 'cal.workingDays': 'Ngày làm việc',
    'cal.workStart': 'Bắt đầu làm việc', 'cal.workEnd': 'Kết thúc làm việc',
    'cal.slot': 'Độ dài ô thời gian', 'cal.min': 'phút', 'cal.display': 'Hiển thị',
    'cal.showWeekends': 'Hiện cuối tuần', 'cal.showDeclined': 'Hiện sự kiện đã từ chối',
    'cal.showCompleted': 'Hiện task đã hoàn thành', 'cal.showCurrentTime': 'Hiện vạch thời gian hiện tại',
    'wd.0': 'CN', 'wd.1': 'T2', 'wd.2': 'T3', 'wd.3': 'T4', 'wd.4': 'T5', 'wd.5': 'T6', 'wd.6': 'T7',
    // Notifications
    'notif.browser': 'Thông báo trình duyệt', 'notif.defaultReminder': 'Nhắc mặc định cho sự kiện mới',
    'notif.none': 'Không', 'notif.min': 'phút trước', 'notif.hour': '1 giờ trước', 'notif.day': '1 ngày trước',
    'notif.reminderNote': 'Áp dụng khi tạo sự kiện mới; không ghi đè nhắc đã đặt riêng.',
    'notif.denied': 'Trình duyệt đã từ chối quyền thông báo.',
    'notif.blocked': 'Quyền thông báo đang bị chặn — mở cài đặt trình duyệt để bật lại.',
    // Appearance
    'theme.light': 'Sáng', 'theme.dark': 'Tối', 'theme.system': 'Theo hệ thống',
    // Privacy
    'priv.eventDefault': 'Quyền riêng tư mặc định của sự kiện', 'priv.private': 'Riêng tư',
    'priv.public': 'Hiển thị trên lịch chia sẻ', 'priv.booking': 'Đặt lịch công khai (Public Booking)',
    'priv.status': 'Trạng thái', 'priv.disabled': 'Chưa bật', 'priv.comingSoon': 'Sắp có',
    'priv.sessions': 'Phiên đăng nhập', 'priv.currentSession': 'Phiên hiện tại trên thiết bị này.',
    'priv.logout': 'Đăng xuất', 'priv.logoutAll': 'Đăng xuất mọi thiết bị',
    // Email prefs
    'email.note': 'Backend kiểm tra các tuỳ chọn này trước khi gửi email.',
    'email.event_invitation': 'Lời mời sự kiện', 'email.event_updated': 'Sự kiện được cập nhật',
    'email.event_cancelled': 'Sự kiện bị huỷ', 'email.event_reminder': 'Nhắc lịch',
    'email.rsvp_update': 'Cập nhật phản hồi (RSVP)', 'email.booking_confirmation': 'Xác nhận đặt lịch',
    'email.booking_notification': 'Thông báo đặt lịch mới',
    // AI
    'ai.enable': 'Bật Trợ lý AI', 'ai.permissions': 'Quyền của AI', 'ai.search': 'Tìm kiếm lịch',
    'ai.create': 'Tạo sự kiện', 'ai.update': 'Cập nhật sự kiện', 'ai.delete': 'Xoá sự kiện',
    'ai.note': 'Hành động phá huỷ (xoá, dời lịch lớn) luôn cần xác nhận, bất kể cài đặt.',
    // Delete modal
    'del.title': 'Xoá tài khoản?',
    'del.body': 'Hành động này xoá vĩnh viễn tài khoản và toàn bộ dữ liệu. Không thể hoàn tác. Gõ',
    'del.bodyEnd': 'để xác nhận.', 'del.cancel': 'Huỷ', 'del.confirm': 'Xoá vĩnh viễn', 'del.deleting': 'Đang xoá…',
    // Login
    'login.sub.signin': 'Đăng nhập để tiếp tục', 'login.sub.signup': 'Tạo tài khoản mới', 'login.sub.forgot': 'Đặt lại mật khẩu',
    'login.signin': 'Đăng nhập', 'login.signup': 'Đăng ký', 'login.email': 'Email', 'login.password': 'Mật khẩu',
    'login.min6': 'Tối thiểu 6 ký tự', 'login.confirmPw': 'Xác nhận mật khẩu', 'login.reenter': 'Nhập lại mật khẩu',
    'login.forgot': 'Quên mật khẩu?', 'login.resetSent': 'Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư (cả Spam) rồi bấm link trong đó.',
    'login.processing': 'Đang xử lý...', 'login.sendReset': 'Gửi link đặt lại', 'login.back': '← Quay lại đăng nhập',
    'login.or': 'hoặc', 'login.google': 'Đăng nhập bằng Google', 'login.enterEmail': 'Hãy nhập email.',
    'login.pwMismatch': 'Mật khẩu xác nhận không khớp.',
    'login.err.invalid': 'Email hoặc mật khẩu không đúng.', 'login.err.registered': 'Email này đã được đăng ký, hãy chuyển sang tab Đăng nhập.', 'login.err.pw6': 'Mật khẩu cần tối thiểu 6 ký tự.',
    // Trash
    'trash.empty': 'Thùng rác trống.', 'trash.desc': 'Sự kiện đã xóa được giữ ở đây. Bạn có thể khôi phục hoặc xóa vĩnh viễn.',
    'trash.confirmQ': 'Xóa hẳn?', 'trash.delete': 'Xóa', 'trash.restore': 'Khôi phục', 'trash.purge': 'Xóa vĩnh viễn', 'trash.deletedAt': 'đã xóa',
    // Toast + common
    'toast.upcoming': 'Sắp tới', 'toast.startsAt': 'Bắt đầu lúc',
    'common.untitled': '(Không có tiêu đề)', 'common.allDay': 'Cả ngày', 'common.close': 'Đóng',
  },
  en: {
    'nav.calendar': 'Calendar', 'nav.today': 'Today', 'nav.create': 'Create',
    'nav.show': 'Show', 'nav.settings': 'Settings', 'nav.trash': 'Trash',
    'nav.export': 'Export .ics', 'nav.import': 'Import .ics',
    'nav.search': 'Search events...', 'nav.loading': 'Loading...',
    'view.day': 'Day', 'view.week': 'Week', 'view.month': 'Month', 'view.year': 'Year',
    'kind.event': 'Event', 'kind.task': 'Task', 'kind.appointment': 'Appointment',
    'settings.title': 'Settings', 'settings.back': 'Back', 'settings.saving': 'Saving…',
    'sec.account': 'Account', 'sec.general': 'General', 'sec.calendar': 'Calendar',
    'sec.notifications': 'Notifications', 'sec.appearance': 'Appearance',
    'sec.privacy': 'Privacy & Security', 'sec.email': 'Email', 'sec.ai': 'AI Assistant',
    'common.preview': 'Preview',
    'acc.profile': 'Profile', 'acc.displayName': 'Display name', 'acc.save': 'Save',
    'acc.email': 'Email', 'acc.created': 'Account created',
    'acc.changePw': 'Change password', 'acc.curPw': 'Current password',
    'acc.newPw': 'New password (≥ 6 chars)', 'acc.confirmPw': 'Confirm new password',
    'acc.googleNote': 'You signed in with Google — your password is managed by Google, not here.',
    'acc.danger': 'Danger zone',
    'acc.deleteWarn': 'Deleting your account permanently removes all calendars, events and settings. This cannot be undone.',
    'acc.deleteBtn': 'Delete account',
    'acc.pwShort': 'New password must be at least 6 characters.',
    'acc.pwMismatch': 'Password confirmation does not match.',
    'acc.pwWrong': 'Current password is incorrect.',
    'acc.pwOk': 'Password changed successfully.',
    'acc.nameSaved': 'Display name saved.',
    'gen.language': 'Language', 'gen.timezone': 'Timezone',
    'gen.dateFormat': 'Date format', 'gen.timeFormat': 'Time format',
    'gen.time24': '24-hour (15:00)', 'gen.time12': '12-hour (3:00 PM)',
    'gen.startWeek': 'Start of week', 'gen.monday': 'Monday', 'gen.sunday': 'Sunday',
    'cal.defaultView': 'Default view', 'cal.workingDays': 'Working days',
    'cal.workStart': 'Start of work', 'cal.workEnd': 'End of work',
    'cal.slot': 'Time slot duration', 'cal.min': 'min', 'cal.display': 'Display',
    'cal.showWeekends': 'Show weekends', 'cal.showDeclined': 'Show declined events',
    'cal.showCompleted': 'Show completed tasks', 'cal.showCurrentTime': 'Show current time indicator',
    'wd.0': 'Sun', 'wd.1': 'Mon', 'wd.2': 'Tue', 'wd.3': 'Wed', 'wd.4': 'Thu', 'wd.5': 'Fri', 'wd.6': 'Sat',
    'notif.browser': 'Browser notifications', 'notif.defaultReminder': 'Default reminder for new events',
    'notif.none': 'None', 'notif.min': 'minutes before', 'notif.hour': '1 hour before', 'notif.day': '1 day before',
    'notif.reminderNote': 'Applied to new events; does not override reminders set per event.',
    'notif.denied': 'The browser denied notification permission.',
    'notif.blocked': 'Notifications are blocked — enable them in your browser settings.',
    'theme.light': 'Light', 'theme.dark': 'Dark', 'theme.system': 'System',
    'priv.eventDefault': 'Default event privacy', 'priv.private': 'Private',
    'priv.public': 'Visible on shared calendars', 'priv.booking': 'Public Booking',
    'priv.status': 'Status', 'priv.disabled': 'Disabled', 'priv.comingSoon': 'Coming soon',
    'priv.sessions': 'Sessions', 'priv.currentSession': 'Current session on this device.',
    'priv.logout': 'Log out', 'priv.logoutAll': 'Log out all devices',
    'email.note': 'The server checks these preferences before sending email.',
    'email.event_invitation': 'Event invitations', 'email.event_updated': 'Event updates',
    'email.event_cancelled': 'Event cancellations', 'email.event_reminder': 'Event reminders',
    'email.rsvp_update': 'RSVP updates', 'email.booking_confirmation': 'Booking confirmations',
    'email.booking_notification': 'New booking notifications',
    'ai.enable': 'Enable AI Assistant', 'ai.permissions': 'AI permissions', 'ai.search': 'Search calendar',
    'ai.create': 'Create events', 'ai.update': 'Update events', 'ai.delete': 'Delete events',
    'ai.note': 'Destructive actions (delete, major reschedule) always require confirmation, regardless of settings.',
    'del.title': 'Delete account?',
    'del.body': 'This permanently deletes your account and all data. This cannot be undone. Type',
    'del.bodyEnd': 'to confirm.', 'del.cancel': 'Cancel', 'del.confirm': 'Delete permanently', 'del.deleting': 'Deleting…',
    'login.sub.signin': 'Sign in to continue', 'login.sub.signup': 'Create a new account', 'login.sub.forgot': 'Reset password',
    'login.signin': 'Sign in', 'login.signup': 'Sign up', 'login.email': 'Email', 'login.password': 'Password',
    'login.min6': 'At least 6 characters', 'login.confirmPw': 'Confirm password', 'login.reenter': 'Re-enter password',
    'login.forgot': 'Forgot password?', 'login.resetSent': 'Password reset email sent. Check your inbox (and Spam) and click the link.',
    'login.processing': 'Processing...', 'login.sendReset': 'Send reset link', 'login.back': '← Back to sign in',
    'login.or': 'or', 'login.google': 'Sign in with Google', 'login.enterEmail': 'Please enter your email.',
    'login.pwMismatch': 'Password confirmation does not match.',
    'login.err.invalid': 'Incorrect email or password.', 'login.err.registered': 'This email is already registered — switch to the Sign in tab.', 'login.err.pw6': 'Password must be at least 6 characters.',
    'trash.empty': 'Trash is empty.', 'trash.desc': 'Deleted events are kept here. You can restore them or delete permanently.',
    'trash.confirmQ': 'Delete for good?', 'trash.delete': 'Delete', 'trash.restore': 'Restore', 'trash.purge': 'Delete permanently', 'trash.deletedAt': 'deleted',
    'toast.upcoming': 'Upcoming', 'toast.startsAt': 'Starts at',
    'common.untitled': '(Untitled)', 'common.allDay': 'All day', 'common.close': 'Close',
  },
};

@Injectable({ providedIn: 'root' })
export class TranslateService {
  private readonly settings = inject(SettingsService);
  readonly lang = computed<Lang>(() => this.settings.settings().language);

  /** Dịch 1 key theo ngôn ngữ hiện tại; thiếu key -> rơi về tiếng Việt -> chính key. */
  t(key: string): string {
    const l = this.lang();
    return DICT[l]?.[key] ?? DICT.vi[key] ?? key;
  }
}
