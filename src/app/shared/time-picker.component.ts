// TimePickerComponent: chọn giờ 24h bằng 2 dropdown (giờ 00–23, phút 00–59).
// KHÔNG cuộn vòng vô tận như picker native. Là ControlValueAccessor nên dùng
// thả vào [(ngModel)] y như <input type="time"> (giá trị "HH:mm").

import { ChangeDetectionStrategy, Component, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-time-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimePickerComponent), multi: true },
  ],
  template: `
    <span class="inline-flex items-center gap-1">
      <select
        [value]="hour()"
        (change)="setHour($event)"
        [disabled]="disabled()"
        class="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
      >
        @for (h of hours; track h) { <option [value]="h">{{ h }}</option> }
      </select>
      <span class="text-gray-400">:</span>
      <select
        [value]="minute()"
        (change)="setMinute($event)"
        [disabled]="disabled()"
        class="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
      >
        @for (m of minutes; track m) { <option [value]="m">{{ m }}</option> }
      </select>
    </span>
  `,
})
export class TimePickerComponent implements ControlValueAccessor {
  protected readonly hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  protected readonly minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
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

  protected setHour(e: Event): void { this.hour.set((e.target as HTMLSelectElement).value); this.emit(); }
  protected setMinute(e: Event): void { this.minute.set((e.target as HTMLSelectElement).value); this.emit(); }
  private emit(): void { this.onChange(`${this.hour()}:${this.minute()}`); this.onTouched(); }
}
