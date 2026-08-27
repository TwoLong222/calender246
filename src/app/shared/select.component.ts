// SelectComponent: thay thế <select> gốc của trình duyệt.
//
// LÝ DO: phần list xổ xuống của <select> native do HỆ ĐIỀU HÀNH/trình duyệt vẽ, không
// thể chỉnh CSS (bo góc, màu nền kem, màu chọn theo accent...) — luôn hiện trắng trơn,
// font hệ thống, viền xanh mặc định, lệch hẳn với giao diện app. Component này tự vẽ toàn
// bộ (nút đóng + panel mở) bằng đúng token .field / .surface-panel / --accent-* đang dùng
// khắp app, nên đồng bộ 100% dù bạn đổi theme màu gì.
//
// Là ControlValueAccessor -> dùng y hệt <select> cũ: [(ngModel)] hoặc [ngModel]+(ngModelChange).
// KHÔNG đổi giá trị/kiểu dữ liệu (vẫn là string) nên không phải sửa logic ở nơi gọi.

import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from './icon.component';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true },
  ],
  host: { '[class]': '"relative inline-block " + (hostClass() ?? "")' },
  template: `
    <button
      type="button"
      (click)="toggle()"
      [disabled]="disabled()"
      class="field flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span class="truncate">{{ selectedLabel() }}</span>
      <app-icon name="chevron-right" class="h-3.5 w-3.5 shrink-0 rotate-90 text-gray-400" />
    </button>

    @if (open()) {
      <div class="fixed inset-0 z-30" (click)="open.set(false)"></div>
      <div class="surface-panel popup-in absolute left-0 top-full z-40 mt-1 max-h-60 w-max min-w-full max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden py-1">
        @for (o of options(); track o.value) {
          <button
            type="button"
            (click)="pick(o.value)"
            class="flex w-full items-center justify-between gap-3 rounded-[calc(var(--radius-md)-4px)] px-3 py-1.5 text-left text-sm hover:bg-gray-50"
            [class.text-blue-700]="o.value === value()"
            [class.font-medium]="o.value === value()"
            [class.text-gray-700]="o.value !== value()"
          >
            <span class="truncate">{{ o.label }}</span>
            @if (o.value === value()) { <app-icon name="check" class="h-3.5 w-3.5 shrink-0" /> }
          </button>
        }
      </div>
    }
  `,
})
export class SelectComponent implements ControlValueAccessor {
  /** Danh sách lựa chọn — thay cho các thẻ <option> gốc. */
  readonly options = input.required<SelectOption[]>();
  /** Class Tailwind cho wrapper ngoài (vd "w-28" để chỉnh bề rộng) — mặc định w-full qua .field. */
  readonly hostClass = input<string>('', { alias: 'class' });

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);

  protected readonly selectedLabel = computed(
    () => this.options().find((o) => o.value === this.value())?.label ?? '',
  );

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    this.value.set(v ?? '');
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
  }

  protected pick(v: string): void {
    this.value.set(v);
    this.open.set(false);
    this.onChange(v);
    this.onTouched();
  }
}
