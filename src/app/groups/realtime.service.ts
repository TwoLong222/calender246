// RealtimeService: kết nối WebSocket (socket.io) tới NestJS gateway cho tính năng nhóm.
// - Kết nối kèm access token của Supabase để backend xác thực.
// - joinGroup/leaveGroup: vào/ra "phòng" của từng nhóm.
// - groupEvents$: luồng sự kiện nhóm real-time (created/updated/deleted).
// - presence: signal map groupId -> danh sách email đang online.

import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { SupabaseService } from '../auth/supabase.service';
import { CalendarEvent } from '../calendar/calendar.types';
import { ApiEvent, fromApiEvent } from '../calendar/events-api.service';
import { GroupMessage } from './groups.types';

export interface GroupEventMessage {
  type: 'created' | 'updated' | 'deleted';
  groupId: string;
  event?: CalendarEvent;
  eventId?: string;
}

/** Tin nhắn chat đến real-time (mới / sửa / thu hồi) */
export interface ChatMessage {
  type: 'new' | 'updated' | 'deleted';
  message: GroupMessage;
}

/** Sự kiện "đang gõ" của 1 người trong 1 nhóm */
export interface TypingSignal {
  groupId: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly supabase = inject(SupabaseService);

  private socket?: Socket;
  private readonly joinedRooms = new Set<string>();

  /** Luồng sự kiện nhóm real-time — GroupsStateService lắng nghe để cập nhật lịch */
  readonly groupEvents$ = new Subject<GroupEventMessage>();
  /** Email đang online theo từng nhóm */
  readonly presence = signal<Record<string, string[]>>({});
  /** Bắn khi danh sách/thành viên nhóm của CHÍNH mình vừa đổi (tạo/tham gia/mời/xóa/giải tán)
   *  — kể cả từ tab khác hoặc do người khác thao tác — để tự tải lại, không cần F5. */
  readonly groupsChanged$ = new Subject<void>();

  /** Luồng tin nhắn chat real-time — ChatService lắng nghe để cập nhật khung chat */
  readonly chat$ = new Subject<ChatMessage>();
  /** Luồng "đang gõ" — ChatService gom lại thành trạng thái hiển thị tạm thời */
  readonly typing$ = new Subject<TypingSignal>();

  /** Địa chỉ socket = origin của apiUrl (bỏ hậu tố /api) */
  private origin(): string {
    return environment.apiUrl.replace(/\/api\/?$/, '');
  }

  private ensureConnected(): void {
    if (this.socket) return;
    const token = this.supabase.session()?.access_token;
    if (!token) return; // chưa đăng nhập xong -> để joinGroup gọi lại sau

    this.socket = io(this.origin(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('group-event:created', (m: { groupId: string; payload: ApiEvent }) =>
      this.groupEvents$.next({ type: 'created', groupId: m.groupId, event: fromApiEvent(m.payload) }),
    );
    this.socket.on('group-event:updated', (m: { groupId: string; payload: ApiEvent }) =>
      this.groupEvents$.next({ type: 'updated', groupId: m.groupId, event: fromApiEvent(m.payload) }),
    );
    this.socket.on('group-event:deleted', (m: { groupId: string; payload: { id: string } }) =>
      this.groupEvents$.next({ type: 'deleted', groupId: m.groupId, eventId: m.payload?.id }),
    );
    this.socket.on('presence', (m: { groupId: string; online: string[] }) =>
      this.presence.update((p) => ({ ...p, [m.groupId]: m.online })),
    );
    this.socket.on('groups:changed', () => this.groupsChanged$.next());

    // Chat real-time
    this.socket.on('group-message:new', (m: GroupMessage) => this.chat$.next({ type: 'new', message: m }));
    this.socket.on('group-message:updated', (m: GroupMessage) => this.chat$.next({ type: 'updated', message: m }));
    this.socket.on('group-message:deleted', (m: GroupMessage) => this.chat$.next({ type: 'deleted', message: m }));
    this.socket.on('group-message:typing', (m: TypingSignal) => this.typing$.next(m));

    // Vào lại các phòng đã đăng ký nếu bị mất kết nối rồi kết nối lại
    this.socket.on('connect', () => {
      for (const id of this.joinedRooms) this.socket?.emit('join-group', { groupId: id });
    });
  }

  /**
   * Đảm bảo đã kết nối socket, kể cả khi CHƯA thuộc nhóm nào — để nhận được 'groups:changed'
   * ngay từ lần đầu (vd vừa được mời vào 1 nhóm mới). Gọi 1 lần lúc mở trang lịch.
   */
  connect(): void {
    this.ensureConnected();
  }

  joinGroup(groupId: string): void {
    this.ensureConnected();
    this.joinedRooms.add(groupId);
    this.socket?.emit('join-group', { groupId });
  }

  leaveGroup(groupId: string): void {
    this.joinedRooms.delete(groupId);
    this.socket?.emit('leave-group', { groupId });
  }

  /** Báo cho các thành viên khác biết mình "đang gõ" trong nhóm (sự kiện tạm thời, không lưu). */
  sendTyping(groupId: string): void {
    this.socket?.emit('typing', { groupId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.joinedRooms.clear();
  }
}
