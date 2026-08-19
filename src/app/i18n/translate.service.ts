// TranslateService: i18n nhẹ, không thư viện ngoài.
// Ngôn ngữ lấy từ SettingsService.language (vi/en). t('key') tra từ điển.
// Dùng trong template: {{ t('nav.today') }} — tự phản ứng khi đổi ngôn ngữ (signal).
//
// Phạm vi hiện tại: chrome điều hướng + trang Cài đặt. Các chuỗi khác dịch dần
// bằng cách thêm key vào DICT (kiến trúc không hard-code, mở rộng dễ).

import { Injectable, computed, inject } from '@angular/core';
import { SettingsService } from '../settings/settings.service';

type Lang = 'vi' | 'en';

const DICT: Record<Lang, Record<string, string>> = {
  vi: {
    'nav.calendar': 'Lịch',
    'nav.today': 'Hôm nay',
    'nav.create': 'Tạo',
    'nav.show': 'Hiển thị',
    'nav.settings': 'Cài đặt',
    'nav.trash': 'Thùng rác',
    'nav.export': 'Xuất file .ics',
    'nav.import': 'Nhập file .ics',
    'view.day': 'Ngày',
    'view.week': 'Tuần',
    'view.month': 'Tháng',
    'view.year': 'Năm',
    'kind.event': 'Sự kiện',
    'kind.task': 'Việc cần làm',
    'kind.appointment': 'Lịch hẹn',
    'settings.title': 'Cài đặt',
    'settings.back': 'Quay lại',
    'settings.saving': 'Đang lưu…',
    'sec.account': 'Tài khoản',
    'sec.general': 'Chung',
    'sec.calendar': 'Lịch',
    'sec.notifications': 'Thông báo',
    'sec.appearance': 'Giao diện',
    'sec.privacy': 'Riêng tư & Bảo mật',
    'sec.email': 'Email',
    'sec.ai': 'Trợ lý AI',
  },
  en: {
    'nav.calendar': 'Calendar',
    'nav.today': 'Today',
    'nav.create': 'Create',
    'nav.show': 'Show',
    'nav.settings': 'Settings',
    'nav.trash': 'Trash',
    'nav.export': 'Export .ics',
    'nav.import': 'Import .ics',
    'view.day': 'Day',
    'view.week': 'Week',
    'view.month': 'Month',
    'view.year': 'Year',
    'kind.event': 'Event',
    'kind.task': 'Task',
    'kind.appointment': 'Appointment',
    'settings.title': 'Settings',
    'settings.back': 'Back',
    'settings.saving': 'Saving…',
    'sec.account': 'Account',
    'sec.general': 'General',
    'sec.calendar': 'Calendar',
    'sec.notifications': 'Notifications',
    'sec.appearance': 'Appearance',
    'sec.privacy': 'Privacy & Security',
    'sec.email': 'Email',
    'sec.ai': 'AI Assistant',
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
