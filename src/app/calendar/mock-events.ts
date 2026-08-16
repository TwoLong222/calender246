// Dữ liệu mẫu (seed data) để bạn nhìn thấy UI hoạt động ngay khi chưa nối API thật.
// Ở Giai đoạn 2, file này sẽ được thay bằng lời gọi HTTP tới NestJS
// (vd: EventsService.getEvents() gọi GET /api/events).

import { CalendarEvent } from './calendar.types';

/** Tạo 1 mốc thời gian cách "hôm nay" `daysFromToday` ngày, vào đúng giờ:phút chỉ định */
function at(daysFromToday: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'seed-1',
    kind: 'event',
    title: 'Họp sync team',
    description: 'Trao đổi tiến độ Ngày 2',
    location: 'Google Meet',
    start: at(0, 10, 0),
    end: at(0, 11, 0),
    isAllDay: false,
    guests: [
      { email: 'ban@example.com', status: 'accepted' },
      { email: 'dongnghiep@example.com', status: 'needsAction' },
    ],
    color: 'sky',
  },
  {
    id: 'seed-2',
    kind: 'event',
    title: 'Đi chơi game',
    start: at(1, 10, 0),
    end: at(1, 11, 0),
    isAllDay: false,
    guests: [],
    color: 'violet',
  },
  {
    id: 'seed-3',
    kind: 'task',
    title: 'Viết báo cáo tuần',
    start: at(2, 14, 0),
    end: at(2, 15, 0),
    isAllDay: false,
    guests: [],
    color: 'emerald',
  },
];
