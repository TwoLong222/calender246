// Các kiểu dữ liệu dùng chung cho toàn bộ tính năng Calendar.
// Cố ý đặt tên field khớp với các cột trong calendar_schema.sql
// (title, start_time/end_time -> start/end, is_all_day -> isAllDay...)
// để Giai đoạn 2 (nối API thật) không phải đổi tên nhiều.

export type ViewMode = 'day' | 'week' | 'month' | 'year';

/** Khớp với 3 tab trong modal tạo mới: Sự kiện / Việc cần làm / Lên lịch hẹn */
export type EventKind = 'event' | 'task' | 'appointment';

/** Khớp với enum attendee_status trong database */
export type AttendeeStatus = 'needsAction' | 'accepted' | 'declined' | 'tentative';

export interface Guest {
  email: string;
  status: AttendeeStatus;
}

export interface CalendarEvent {
  id: string;
  kind: EventKind;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  guests: Guest[];
  /** Tên màu Tailwind dùng để tô sự kiện, vd: 'sky' | 'violet' | 'emerald' | 'rose' | 'amber' */
  color: string;
  /** Nếu là 1 mắt trong chuỗi lặp -> các occurrence cùng chuỗi có chung seriesId; null nếu không lặp */
  seriesId?: string | null;
  /** Email người tạo event (hiện "Người tạo" ở popover) */
  creatorEmail?: string;
  /** Thời điểm bị đưa vào thùng rác (chỉ có ở sự kiện trong thùng rác); null = chưa xóa */
  deletedAt?: Date | null;
}
