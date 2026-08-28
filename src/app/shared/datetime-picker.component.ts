// DateTimePickerComponent: chọn ngày (native date — lịch, không bị cuộn vòng) + giờ
// (TimePickerComponent tự làm). Giá trị "YYYY-MM-DDTHH:mm" giống <input datetime-local>.
// ControlValueAccessor -> thả vào [(ngModel)] thay cho datetime-local.

import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TimePickerComponent } from './time-picker.component';

@Component({
  selector: 'app-datetime-picker',
  standalone: true,
  imports: [TimePickerComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateTimePickerComponent), multi: true },
  ],
  template: `
    <!-- compact: KHÔNG cho xuống dòng (flex-nowrap) và thu nhỏ mọi thứ, để trong popover
         hẹp thì nhãn + ô ngày + ô giờ vẫn nằm trên một đường thẳng. -->
    <span class="inline-flex items-center gap-1" [class.flex-wrap]="!compact()" [class.flex-nowrap]="compact()">
      <input
        type="date"
        [value]="date()"
        (change)="setDate($event)"
        [disabled]="disabled()"
        class="shrink-0 rounded border border-gray-300 disabled:opacity-50"
        [class]="compact() ? 'w-[6.25rem] px-1 py-1 text-xs' : 'px-2 py-1 text-sm'"
      />
      <app-time-picker [ngModel]="time()" (ngModelChange)="setTime($event)" [disabled]="disabled()" [compact]="compact()" />
    </span>
  `,
})
export class DateTimePickerComponent implements ControlValueAccessor {
  /** Bản hẹp cho popover w-80 — xem TimePickerComponent.compact. */
  readonly compact = input(false);

  protected readonly date = signal('');
  protected readonly time = signal('');
  protected readonly disabled = signal(false);

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    if (v && v.includes('T')) {
      const [d, t] = v.split('T');
      this.date.set(d);
      this.time.set((t ?? '').slice(0, 5));
    } else {
      this.date.set('');
      this.time.set('');
    }
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected setDate(e: Event): void { this.date.set((e.target as HTMLInputElement).value); this.emit(); }
  protected setTime(t: string): void { this.time.set(t); this.emit(); }

  private emit(): void {
    // Chỉ phát khi có cả ngày (giờ mặc định 00:00 nếu bỏ trống); nếu chưa chọn ngày -> rỗng.
    if (!this.date()) { this.onChange(''); this.onTouched(); return; }
    const t = this.time() || '00:00';
    this.time.set(t);
    this.onChange(`${this.date()}T${t}`);
    this.onTouched();
  }
}
