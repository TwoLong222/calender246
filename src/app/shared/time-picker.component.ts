// TimePickerComponent: chọn giờ 24h bằng 2 dropdown (giờ 00–23, phút 00–59).
// KHÔNG cuộn vòng vô tận như picker native. Là ControlValueAccessor nên dùng
// thả vào [(ngModel)] y như <input type="time"> (giá trị "HH:mm").

import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectComponent, SelectOption } from './select.component';

const HOUR_OPTIONS: SelectOption[] = Array.from({ length: 24 }, (_, i) => {
  const v = String(i).padStart(2, '0');
  return { value: v, label: v };
});
const MINUTE_OPTIONS: SelectOption[] = Array.from({ length: 60 }, (_, i) => {
  const v = String(i).padStart(2, '0');
  return { value: v, label: v };
});

@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [SelectComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimePickerComponent), multi: true },
  ],
  template: `
    <span class="inline-flex shrink-0 items-center" [class.gap-1]="!compact()" [class.gap-0.5]="compact()">
      <app-select [options]="hourOptions" [ngModel]="hour()" (ngModelChange)="setHour($event)" [disabled]="disabled()" [class]="compact() ? 'w-12' : 'w-[4.5rem]'" />
      <span class="text-gray-400">:</span>
      <app-select [options]="minuteOptions" [ngModel]="minute()" (ngModelChange)="setMinute($event)" [disabled]="disabled()" [class]="compact() ? 'w-12' : 'w-[4.5rem]'" />
    </span>
  `,
})
export class TimePickerComponent implements ControlValueAccessor {
  /** Bản hẹp dùng trong popover w-80: nhãn + ngày + giờ nằm gọn trên MỘT dòng. */
  readonly compact = input(false);

  protected readonly hourOptions = HOUR_OPTIONS;
  protected readonly minuteOptions = MINUTE_OPTIONS;
  protected readonly hour = signal('00');
  protected readonly minute = signal('00');
  protected readonly disabled = signal(false);

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    if (v && /^\d{1,2}:\d{2}/.test(v)) {
      const [h, m] = v.split(':');
      this.hour.set(h.padStart(2, '0'));
      this.minute.set(m.slice(0, 2).padStart(2, '0'));
    }
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected setHour(v: string): void { this.hour.set(v); this.emit(); }
  protected setMinute(v: string): void { this.minute.set(v); this.emit(); }
  private emit(): void { this.onChange(`${this.hour()}:${this.minute()}`); this.onTouched(); }
}
