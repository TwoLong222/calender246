// Khối "Nhóm" dùng CHUNG: danh sách nhóm + lời mời + tạo nhóm + tham gia bằng mã.
//
// Dùng ở 2 nơi:
//   - Desktop: trong sidebar trang lịch.
//   - Mobile: trong panel nổi riêng (nút bong bóng góc phải, giống trợ lý AI),
//     vì sidebar trên điện thoại chật, cuộn xuống tận cuối mới thấy nhóm.

import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { GroupsStateService } from './groups-state.service';
import { GroupChatService } from './chat.service';

@Component({
  selector: 'app-groups-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Lời mời nhóm đang chờ mình đồng ý -->
    @if (groupsState.pendingInvites().length > 0) {
      <div class="mb-3 space-y-1.5 rounded-lg border border-blue-200 bg-blue-50 p-2">
        <p class="text-xs font-medium text-blue-800">📩 Lời mời vào nhóm</p>
        @for (inv of groupsState.pendingInvites(); track inv.group_id) {
          <div class="flex items-center gap-2 text-sm">
            <span class="min-w-0 flex-1 truncate text-gray-700">{{ inv.name }}</span>
            <button type="button" (click)="groupsState.acceptInvite(inv.group_id)" class="tap shrink-0 rounded bg-blue-700 px-2 py-1 text-xs font-medium text-white hover:bg-blue-800">Đồng ý</button>
            <button type="button" (click)="groupsState.declineInvite(inv.group_id)" class="tap shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">Từ chối</button>
          </div>
        }
      </div>
    }

    <!-- Mỗi nhóm là 1 THẺ riêng cho dễ phân biệt (trước đây các dòng dính liền nhau) -->
    <ul class="space-y-2 text-sm text-gray-700">
      @for (g of groupsState.groups(); track g.id) {
        <!-- Bấm BẤT KỲ chỗ nào trong thẻ (kể cả rìa) đều mở nhóm; ô tick và nút 💬 có
             xử lý riêng nên chặn nổi bọt để không mở nhầm. -->
        <li class="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 hover:border-gray-300"
            (click)="openGroup(g.id)">
          <div class="flex items-center gap-2">
            <!-- Ô tick = HIỆN/ẨN sự kiện của nhóm này trên lịch (không phải tham gia/rời nhóm) -->
            <input
              type="checkbox"
              [checked]="groupsState.isVisible(g.id)"
              (change)="groupsState.toggleVisible(g.id)"
              (click)="$event.stopPropagation()"
              [class]="groupAccent(g.id)"
              title="Hiện/ẩn sự kiện của nhóm này trên lịch"
            />
            <span class="min-w-0 flex-1 truncate py-1 text-left font-medium">{{ g.name }}</span>
            @if (groupsState.onlineCount(g.id) > 0) {
              <span class="shrink-0 text-xs text-emerald-600" title="Đang online">● {{ groupsState.onlineCount(g.id) }}</span>
            }
            <button
              type="button"
              (click)="$event.stopPropagation(); openGroup(g.id, 'chat')"
              class="relative shrink-0 p-1.5 text-gray-500 opacity-70 transition hover:opacity-100"
              title="Mở trò chuyện"
            >
              💬
              @if (chat.unreadOf(g.id) > 0) {
                <span class="absolute -right-1 -top-1 min-w-[1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-medium leading-4 text-white">{{ chat.unreadOf(g.id) }}</span>
              }
            </button>
          </div>
        </li>
      } @empty {
        <li class="rounded-lg border border-dashed border-gray-300 px-3 py-3 text-center text-xs text-gray-400">Chưa có nhóm nào.</li>
      }
    </ul>
    @if (groupsState.groups().length > 0) {
      <p class="mt-2 text-[11px] leading-relaxed text-gray-400">
        ☑️ Ô tick = hiện/ẩn sự kiện của nhóm đó trên lịch. Bỏ tick chỉ ẩn đi, bạn vẫn ở trong nhóm.
      </p>
    }

    <!-- Tạo nhóm -->
    <div class="mt-2 flex gap-1">
      <input #gname type="text" placeholder="Tên nhóm mới" class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" (keydown.enter)="createGroup(gname.value); gname.value=''" />
      <button type="button" (click)="createGroup(gname.value); gname.value=''" class="shrink-0 rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800">Tạo</button>
    </div>
    <!-- Tham gia bằng mã -->
    <div class="mt-1 flex gap-1">
      <input #gcode type="text" placeholder="Nhập mã tham gia" class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" (keydown.enter)="joinGroup(gcode.value); gcode.value=''" />
      <button type="button" (click)="joinGroup(gcode.value); gcode.value=''" class="shrink-0 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Vào</button>
    </div>
    @if (groupsState.error(); as err) {
      <p class="mt-1 text-xs text-red-600">{{ err }}</p>
    }
  `,
})
export class GroupsSectionComponent {
  protected readonly groupsState = inject(GroupsStateService);
  protected readonly chat = inject(GroupChatService);

  /** Phát ra khi người dùng mở 1 nhóm — trang cha dùng để đóng panel nổi trên mobile. */
  readonly opened = output<void>();

  protected openGroup(id: string, tab?: 'chat'): void {
    this.groupsState.openPanel(id, tab);
    this.opened.emit();
  }

  protected groupAccent(groupId: string): string {
    const map: Record<string, string> = {
      violet: 'accent-violet-600',
      emerald: 'accent-emerald-600',
      rose: 'accent-rose-600',
      amber: 'accent-amber-600',
      sky: 'accent-sky-600',
    };
    return map[this.groupsState.colorFor(groupId)] ?? 'accent-violet-600';
  }

  protected createGroup(name: string): void {
    const n = name.trim();
    if (n) this.groupsState.createGroup(n);
  }

  protected joinGroup(code: string): void {
    const c = code.trim();
    if (c) this.groupsState.joinByCode(c);
  }
}
