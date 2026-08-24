// CommentsService: quản lý bình luận của event đang mở trong popover.
// Có REALTIME: khi bảng event_comments thay đổi (ai đó thêm/sửa/xóa comment),
// nếu đang mở đúng event thì tự tải lại -> thấy comment mới không cần reload.

import { Injectable, effect, inject, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { CommentsApiService, EventComment } from './comments-api.service';
import { SupabaseService } from '../auth/supabase.service';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly api = inject(CommentsApiService);
  private readonly supabase = inject(SupabaseService);

  readonly comments = signal<EventComment[]>([]);
  readonly loading = signal(false);
  private currentEventId: string | null = null;
  private realtimeChannel?: RealtimeChannel;

  constructor() {
    // Chỉ đăng ký Realtime SAU khi có token đăng nhập (và gắn token cho kênh) — nếu không,
    // kênh chạy quyền ẩn danh -> RLS chặn -> không nhận được bình luận mới của người khác.
    effect(() => {
      const token = this.supabase.session()?.access_token;
      if (!token) return;
      this.supabase.client.realtime.setAuth(token);
      if (this.realtimeChannel) this.supabase.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = this.supabase.client
        .channel('comments-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'event_comments' }, () => {
          if (this.currentEventId) this.reload();
        })
        .subscribe();
    });
  }

  /** Mở comment của 1 event (gọi khi popover chi tiết mở) */
  loadFor(eventId: string): void {
    if (this.currentEventId === eventId) return;
    this.currentEventId = eventId;
    this.reload();
  }

  clear(): void {
    this.currentEventId = null;
    this.comments.set([]);
  }

  private reload(): void {
    const id = this.currentEventId;
    if (!id) return;
    this.loading.set(true);
    this.api.list(id).subscribe({
      next: (cs) => {
        this.comments.set(cs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  add(content: string): void {
    const id = this.currentEventId;
    if (!id || !content.trim()) return;
    this.api.create(id, content.trim()).subscribe({ next: () => this.reload() });
  }

  edit(commentId: string, content: string): void {
    if (!content.trim()) return;
    this.api.update(commentId, content.trim()).subscribe({ next: () => this.reload() });
  }

  remove(commentId: string): void {
    this.api.delete(commentId).subscribe({ next: () => this.reload() });
  }

  /** Email user hiện tại — để biết comment nào của mình (hiện nút Sửa/Xóa) */
  myEmail(): string | undefined {
    return this.supabase.user()?.email ?? undefined;
  }
}
