// Mô tả hình dạng các dữ liệu của tính năng nhóm (để code gợi ý và bắt lỗi giúp).

// Vai trò trong nhóm: 'owner' = chủ nhóm, 'member' = thành viên thường.
export type GroupRole = 'owner' | 'member';

// Trạng thái lời mời/tham gia: pending = đang chờ đồng ý, accepted = đã vào, declined = đã từ chối.
export type GroupMemberStatus = 'pending' | 'accepted' | 'declined';

// GroupMember — Một thành viên trong nhóm.
export interface GroupMember {
  user_id: string | null;
  email: string;
  role: GroupRole;
  joined_at: string | null;
  status?: GroupMemberStatus;
}

// PendingGroupInvite — Một lời mời nhóm đang chờ mình đồng ý.
export interface PendingGroupInvite {
  group_id: string;
  name: string;
  invited_at: string;
}

// Group — Thông tin một nhóm.
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

// GroupMessage — Một tin nhắn trong khung trò chuyện của nhóm.
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

  // ----- Phase 13: trả lời tin -----
  /** Tin này trả lời tin nào (id trong cùng nhóm); null = tin thường. */
  reply_to_id?: string | null;
}

/** Dữ liệu gửi kèm khi tạo 1 tin nhắn mới. */
export interface SendMessagePayload {
  content: string;
  replyToId?: string;
}

// (Đã bỏ GROUP_COLORS: nhóm không còn màu riêng — sự kiện giữ đúng màu người tạo chọn.)
