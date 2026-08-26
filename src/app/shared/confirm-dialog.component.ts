// Hộp thoại xác nhận dùng chung — đặt 1 lần ở app.html, mọi nơi gọi qua ConfirmService.
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';
import { IconComponent } from './icon.component';
import { TranslateService } from '../i18n/translate.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.pending(); as p) {
      <div class="modal-backdrop-in fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/40" (click)="confirm.answer('no')">
        <div class="modal-card-in w-full max-w-sm !rounded-[var(--radius-lg)] bg-white p-5 !shadow-[var(--shadow-lg)]" (click)="$event.stopPropagation()">
          <div class="mb-4 flex items-start gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full" [class]="p.danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'">
              <app-icon [name]="p.danger ? 'trash' : 'alert'" class="h-5 w-5" />
            </span>
            <div class="min-w-0 flex-1 pt-1.5">
              <p class="break-words text-base font-semibold text-gray-900">{{ p.message }}</p>
              @if (p.detail) {
                <p class="mt-1 break-words text-sm text-gray-500">{{ p.detail }}</p>
              }
            </div>
          </div>
          <div class="flex flex-wrap justify-end gap-2">
            <button type="button" (click)="confirm.answer('no')" class="btn btn-secondary">{{ tr.t('del.cancel') }}</button>
            @if (p.secondaryText) {
              <button type="button" (click)="confirm.answer('secondary')" class="btn btn-danger">{{ p.secondaryText }}</button>
            }
            <button type="button" (click)="confirm.answer('yes')"
              class="btn text-white"
              [class]="p.danger ? '!bg-red-600 hover:!bg-red-700' : 'btn-primary'"
            >{{ p.confirmText || tr.t('detail.delete') }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);
  protected readonly tr = inject(TranslateService);
}
