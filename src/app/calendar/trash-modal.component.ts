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
    <div class="evm-backdrop modal-backdrop-in" (click)="state.closeTrash()">
      <div class="modal-card-in trash-card" (click)="$event.stopPropagation()">
        <header class="trash-head">
          <h2 class="trash-title">
            <app-icon name="trash" class="h-5 w-5" /> {{ tr.t('nav.trash') }}
          </h2>
          <button type="button" (click)="state.closeTrash()" class="detail-icon-btn" [attr.aria-label]="tr.t('common.close')">
            <app-icon name="x" class="h-4 w-4" />
          </button>
        </header>

        <div class="trash-body">
          @if (state.isTrashLoading()) {
            <p class="trash-loading">{{ tr.t('nav.loading') }}</p>
          } @else if (state.trashedEvents().length === 0) {
            <div class="trash-empty">
              <app-icon name="trash" class="h-11 w-11" />
              <p>{{ tr.t('trash.empty') }}</p>
            </div>
          } @else {
            <p class="trash-desc">{{ tr.t('trash.desc') }}</p>
            <ul class="trash-list">
              @for (e of state.trashedEvents(); track e.id) {
                <li class="trash-item">
                  <span [class]="'trash-bar ' + colorBar(e.color)"></span>
                  <div class="trash-main">
                    <p class="trash-item-title">{{ e.title || tr.t('common.untitled') }}</p>
                    <p class="trash-item-meta">{{ dateLabel(e) }}</p>
                  </div>

                  @if (confirmingId() === e.id) {
                    <span class="trash-confirm-text">{{ tr.t('trash.confirmQ') }}</span>
                    <button type="button" (click)="state.purgeFromTrash(e.id); confirmingId.set(null)" class="trash-confirm-yes">
                      {{ tr.t('trash.delete') }}
                    </button>
                    <button type="button" (click)="confirmingId.set(null)" class="trash-confirm-no">
                      {{ tr.t('del.cancel') }}
                    </button>
                  } @else {
                    <button type="button" (click)="state.restoreFromTrash(e.id)" class="trash-restore" [title]="tr.t('trash.restore')">
                      <app-icon name="arrow-back" class="h-3.5 w-3.5" /> {{ tr.t('trash.restore') }}
                    </button>
                    <button type="button" (click)="confirmingId.set(e.id)" class="trash-purge" [title]="tr.t('trash.purge')" [attr.aria-label]="tr.t('trash.purge')">
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
      sky: 'dot-sky',
      violet: 'dot-violet',
      emerald: 'dot-emerald',
      rose: 'dot-rose',
      amber: 'dot-amber',
    };
    return map[color] ?? 'dot-sky';
  }
}
