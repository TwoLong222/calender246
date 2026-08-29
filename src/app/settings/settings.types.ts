// Kiểu dữ liệu Settings — khớp bảng user_settings (backend trả snake_case).

export type ThemePref = 'light' | 'dark' | 'system';
export type CalendarView = 'day' | 'week' | 'month' | 'year';

export interface EmailPreferences {
  event_reminder: boolean;
  event_invitation: boolean;
  /** Email báo được mời vào NHÓM (khác lời mời sự kiện). */
  group_invitation: boolean;
  rsvp_update: boolean;
  event_updated: boolean;
  event_cancelled: boolean;
  booking_confirmation: boolean;
  booking_notification: boolean;
}

export interface AiSettings {
  enabled: boolean;
  allow_search: boolean;
  allow_create: boolean;
  allow_update: boolean;
  allow_delete: boolean;
}

export interface UserSettings {
  language: 'vi' | 'en';
  timezone: string;
  date_format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  time_format: '12h' | '24h';
  start_of_week: 0 | 1; // 0 = CN, 1 = T2

  default_calendar_view: CalendarView;
  default_calendar_id: string | null;
  working_days: number[]; // 0..6
  working_start: string; // HH:MM
  working_end: string;
  show_weekends: boolean;
  show_declined_events: boolean;
  show_completed_tasks: boolean;
  show_current_time: boolean;
  time_slot_duration: 15 | 30 | 60;

  theme: ThemePref;

  default_reminder: number | null; // phút; null = không
  browser_notifications: boolean;

  event_default_privacy: 'private' | 'public';

  email_preferences: EmailPreferences;
  ai_settings: AiSettings;
}

/** Mặc định dùng trước khi tải xong từ server (tránh undefined khi render). */
export const DEFAULT_SETTINGS: UserSettings = {
  language: 'vi',
  timezone: 'Asia/Ho_Chi_Minh',
  date_format: 'DD/MM/YYYY',
  time_format: '24h',
  start_of_week: 1,
  default_calendar_view: 'week',
  default_calendar_id: null,
  working_days: [1, 2, 3, 4, 5],
  working_start: '08:00',
  working_end: '17:00',
  show_weekends: true,
  show_declined_events: false,
  show_completed_tasks: true,
  show_current_time: true,
  time_slot_duration: 30,
  theme: 'system',
  default_reminder: null,
  browser_notifications: false,
  event_default_privacy: 'private',
  email_preferences: {
    event_reminder: true,
    event_invitation: true,
    group_invitation: true,
    rsvp_update: true,
    event_updated: true,
    event_cancelled: true,
    booking_confirmation: true,
    booking_notification: true,
  },
  ai_settings: {
    enabled: true,
    allow_search: true,
    allow_create: true,
    allow_update: true,
    allow_delete: false,
  },
};

/** Danh sách timezone phổ biến cho dropdown (user có thể mở rộng sau). */
export const COMMON_TIMEZONES = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Seoul',
  'Asia/Shanghai',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];
