// TrashModalComponent: cửa sổ Thùng rác — xem các sự kiện đã xóa,
// khôi phục lại hoặc xóa vĩnh viễn.

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CalendarStateService } from './calendar-state.service';
import { CalendarEvent } from './calendar.types';
import { IconComponent } from '../shared/icon.component';
import { TranslateService } from '../i18n/translate.service';

@Component({
  selector: 'app-trash-modal',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Nền mờ: bấm ra ngoài để đóng -->
    <div
      class="modal-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      (click)="state.closeTrash()"
    >
      <!-- Thẻ modal: chặn click lan ra nền -->
      <div
        class="modal-card-in flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 class="flex items-center gap-2 text-lg font-medium text-gray-800">
            <app-icon name="trash" class="h-5 w-5 text-gray-600" /> {{ tr.t('nav.trash') }}
          </h2>
          <button type="button" (click)="state.closeTrash()" class="btn-icon !p-1.5 text-gray-500" [attr.aria-label]="tr.t('common.close')">
            <app-icon name="x" class="h-5 w-5" />
          </button>
        </header>

        <div class="flex-1 overflow-y-auto p-4">
          @if (state.isTrashLoading()) {
            <p class="py-8 text-center text-sm text-gray-400">{{ tr.t('nav.loading') }}</p>
          } @else if (state.trashedEvents().length === 0) {
            <div class="py-10 text-center">
              <app-icon name="trash" class="mx-auto h-12 w-12 text-gray-300" />
              <p class="mt-2 text-sm text-gray-500">{{ tr.t('trash.empty') }}</p>
            </div>
          } @else {
            <p class="mb-3 text-xs text-gray-500">
              {{ tr.t('trash.desc') }}
            </p>
            <ul class="space-y-2">
              @for (e of state.trashedEvents(); track e.id) {
                <li class="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                  <span class="h-8 w-1.5 shrink-0 rounded-full" [class]="colorBar(e.color)"></span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-gray-800">{{ e.title || tr.t('common.untitled') }}</p>
                    <p class="truncate text-xs text-gray-500">{{ dateLabel(e) }}</p>
                  </div>

                  @if (confirmingId() === e.id) {
                    <span class="text-xs text-red-600">{{ tr.t('trash.confirmQ') }}</span>
                    <button type="button" (click)="state.purgeFromTrash(e.id); confirmingId.set(null)" class="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700">
                      {{ tr.t('trash.delete') }}
                    </button>
                    <button type="button" (click)="confirmingId.set(null)" class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
                      {{ tr.t('del.cancel') }}
                    </button>
                  } @else {
                    <button type="button" (click)="state.restoreFromTrash(e.id)" class="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" [title]="tr.t('trash.restore')">
                      <app-icon name="arrow-back" class="h-3.5 w-3.5" /> {{ tr.t('trash.restore') }}
                    </button>
                    <button type="button" (click)="confirmingId.set(e.id)" class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" [title]="tr.t('trash.purge')" [attr.aria-label]="tr.t('trash.purge')">
                      <app-icon name="trash" class="h-4 w-4" />
                    </button>
                  }
                </li>
              }
            </ul>
          }
        </div>
      </div>
    </div>
  `,
})
export class TrashModalComponent {
  protected readonly state = inject(CalendarStateService);
  protected readonly tr = inject(TranslateService);
  /** Id sự kiện đang chờ xác nhận xóa vĩnh viễn (hiện nút Xóa/Hủy ngay tại dòng đó) */
  protected readonly confirmingId = signal<string | null>(null);

  /** Nhãn ngày giờ gốc của sự kiện + thời điểm đã xóa */
  dateLabel(e: CalendarEvent): string {
    const loc = this.tr.lang() === 'en' ? 'en-GB' : 'vi-VN';
    const d = e.start.toLocaleDateString(loc, { day: 'numeric', month: 'numeric', year: 'numeric' });
    const base = e.isAllDay
      ? `${d} · ${this.tr.t('common.allDay')}`
      : `${d} · ${e.start.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`;
    if (e.deletedAt) {
      return `${base}  ·  ${this.tr.t('trash.deletedAt')} ${e.deletedAt.toLocaleDateString(loc, { day: 'numeric', month: 'numeric' })}`;
    }
    return base;
  }

  /** Thanh màu bên trái theo màu sự kiện */
  colorBar(color: string): string {
    const map: Record<string, string> = {
      sky: 'bg-sky-500',
      violet: 'bg-violet-500',
      emerald: 'bg-emerald-500',
      rose: 'bg-rose-500',
      amber: 'bg-amber-500',
    };
    return map[color] ?? 'bg-sky-500';
  }
}
