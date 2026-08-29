// Bảng tra cứu DÙNG CHUNG cho mọi nơi hiển thị "loại thông báo" (toast góc màn hình,
// mục "Mặc định của app" trong Cài đặt, trang Lịch sử thông báo) — để badge/icon/màu
// luôn đồng bộ, chỉ sửa 1 chỗ khi cần đổi.

import { IconName } from '../shared/icon.component';
import { Toast } from './notification.service';

export type NotifKind = Toast['kind'];

const CAT_KEY: Record<NotifKind, string> = {
  event: 'toast.catReminder',
  invite: 'toast.catInvite',
  groupInvite: 'toast.catGroupInvite',
  changed: 'toast.catChanged',
  cancelled: 'toast.catCancelled',
  file: 'toast.catFile',
  chat: 'toast.catChat',
  shared: 'toast.catShared',
};

const ICON_NAME: Record<NotifKind, IconName> = {
  event: 'alarm',
  invite: 'mail',
  groupInvite: 'user', // khong co icon 'users' trong bo icon
  changed: 'pencil',
  cancelled: 'trash',
  file: 'notes',
  chat: 'message',
  shared: 'user',
};

const BADGE_CLASS: Record<NotifKind, string> = {
  event: 'bg-sky-50 text-sky-700',
  invite: 'bg-emerald-50 text-emerald-700',
  groupInvite: 'bg-teal-50 text-teal-700',
  changed: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-700',
  file: 'bg-violet-50 text-violet-700',
  chat: 'bg-indigo-50 text-indigo-700',
  shared: 'bg-teal-50 text-teal-700',
};

const BORDER_CLASS: Record<NotifKind, string> = {
  event: 'border-sky-200',
  invite: 'border-emerald-200',
  groupInvite: 'border-teal-200',
  changed: 'border-amber-200',
  cancelled: 'border-red-200',
  file: 'border-violet-200',
  chat: 'border-indigo-200',
  shared: 'border-teal-200',
};

export function notifCatKey(kind: NotifKind): string {
  return CAT_KEY[kind];
}
export function notifIconName(kind: NotifKind): IconName {
  return ICON_NAME[kind];
}
export function notifBadgeClass(kind: NotifKind): string {
  return BADGE_CLASS[kind];
}
export function notifBorderClass(kind: NotifKind): string {
  return BORDER_CLASS[kind];
}
