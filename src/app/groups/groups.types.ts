// Kiểu dữ liệu cho tính năng "Nhóm lên lịch cùng nhau".

export type GroupRole = 'owner' | 'member';

export interface GroupMember {
  user_id: string | null;
  email: string;
  role: GroupRole;
  joined_at: string | null;
}

export interface Group {
  id: string;
  name: string;
  owner_id: string;
  calendar_id: string;
  join_code: string;
  created_at: string;
  myRole: GroupRole;
  /** Số thành viên (chỉ có ở danh sách) */
  memberCount?: number;
  /** Chi tiết thành viên (chỉ có khi mở panel getGroup) */
  members?: GroupMember[];
}

/** 1 tin nhắn chat trong nhóm (khớp bảng group_messages ở backend). */
export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  sender_email: string | null;
  content: string;
  /** != null nghĩa là tin đã được chỉnh sửa */
  edited_at: string | null;
  /** != null nghĩa là tin đã bị thu hồi (hiển thị "đã thu hồi") */
  deleted_at: string | null;
  created_at: string;
}

/** Bảng màu gán cho từng nhóm để phân biệt trên lịch (xoay vòng theo thứ tự nhóm) */
export const GROUP_COLORS = ['violet', 'emerald', 'rose', 'amber', 'sky'] as const;
