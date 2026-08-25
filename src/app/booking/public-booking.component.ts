// Trang đặt lịch công khai — KHÔNG cần đăng nhập. Người ngoài mở /book/<slug>,
// chọn khung giờ trống rồi điền tên + email để đặt.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BookingApiService } from './booking-api.service';

/** Nhãn thứ ngắn theo getDay(): 0=CN..6=T7. */
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

interface DayGroup {
  /** Khoá theo ngày (yyyy-mm-dd) để chọn/so sánh. */
  key: string;
  /** Nhãn đầy đủ, vd "Thứ Hai, 25/8". */
  label: string;
  /** Nhãn ngắn trên thẻ ngày: "T2" và "25". */
  weekday: string;
  dayNum: number;
  slots: { iso: string; label: string }[];
}

@Component({
  selector: 'app-public-booking',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen justify-center bg-gray-50 px-4 py-10 text-gray-800">
      <div class="w-full max-w-lg">
        @if (loadError()) {
          <div class="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p class="text-lg font-medium">Không mở được trang đặt lịch</p>
            <p class="mt-1 text-sm text-gray-500">{{ loadError() }}</p>
          </div>
        } @else if (booked()) {
          <div class="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
            <p class="text-lg font-medium">Đặt lịch thành công!</p>
            <p class="mt-1 text-sm text-gray-500">{{ chosenLabel() }}. Email xác nhận đã được gửi tới {{ email() }}.</p>
          </div>
        } @else {
          <div class="rounded-xl border border-gray-200 bg-white p-6">
            <h1 class="text-xl font-semibold">{{ page()?.title || 'Đặt lịch hẹn' }}</h1>
            <p class="mb-4 mt-1 text-sm text-gray-500">Thời lượng: {{ page()?.durationMinutes }} phút</p>

            @if (loading()) {
              <p class="py-8 text-center text-sm text-gray-400">Đang tải khung giờ…</p>
            } @else if (!chosen()) {
              <!-- Giải thích QUY LUẬT: chỉ nhận hẹn trong giờ làm việc, bỏ khung đã bận -->
              <p class="mb-3 rounded-md bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500">
                📌 Chỉ hiện khung còn trống trong giờ nhận hẹn:
                <strong>{{ workingDaysLabel() }}</strong>, {{ workingStart() }}–{{ workingEnd() }}.
                Ngày nghỉ và khung đã có lịch sẽ không hiện.
              </p>

              @if (days().length === 0) {
                <p class="py-8 text-center text-sm text-gray-400">Hiện chưa có khung giờ trống trong {{ daysAhead() }} ngày tới.</p>
              } @else {
                <!-- BƯỚC 1: chọn NGÀY (dải ngang, cuộn được) -->
                <p class="mb-2 text-sm font-medium text-gray-600">1. Chọn ngày</p>
                <div class="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2">
                  @for (d of days(); track d.key) {
                    <button type="button" (click)="pickedDay.set(d.key)"
                      class="flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-2"
                      [class]="d.key === activeDay() ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
                    >
                      <span class="text-[11px] uppercase">{{ d.weekday }}</span>
                      <span class="text-lg font-semibold leading-tight">{{ d.dayNum }}</span>
                      <span class="text-[10px] text-gray-400">{{ d.slots.length }} giờ</span>
                    </button>
                  }
                </div>

                <!-- BƯỚC 2: chọn GIỜ trong ngày đã chọn -->
                <p class="mb-2 text-sm font-medium text-gray-600">2. Chọn giờ — {{ activeDayLabel() }}</p>
                <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  @for (s of activeSlots(); track s.iso) {
                    <button type="button" (click)="chosen.set(s.iso)"
                      class="rounded-md border border-gray-300 px-2 py-2 text-sm hover:border-blue-600 hover:bg-blue-50">
                      {{ s.label }}
                    </button>
                  }
                </div>
              }
            } @else {
              <p class="mb-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{{ chosenLabel() }}</p>
              <label class="mb-1 block text-sm text-gray-600">Tên của bạn</label>
              <input [(ngModel)]="name" class="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <label class="mb-1 block text-sm text-gray-600">Email</label>
              <input type="email" [(ngModel)]="email" class="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              @if (bookError()) { <p class="mb-2 text-sm text-red-600">{{ bookError() }}</p> }
              <div class="flex gap-2">
                <button type="button" (click)="chosen.set(null)" class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">← Chọn giờ khác</button>
                <button type="button" (click)="submit()" [disabled]="submitting() || !name().trim() || !email().trim()"
                  class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {{ submitting() ? 'Đang đặt…' : 'Xác nhận đặt lịch' }}
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class PublicBookingComponent {
  private readonly api = inject(BookingApiService);
  private readonly route = inject(ActivatedRoute);

  private readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly page = signal<{ title: string; durationMinutes: number } | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  private readonly slotList = signal<string[]>([]);

  readonly chosen = signal<string | null>(null);
  name = signal('');
  email = signal('');
  readonly submitting = signal(false);
  readonly bookError = signal<string | null>(null);
  readonly booked = signal(false);

  /** Ngày người dùng đang chọn ở bước 1 (null = tự lấy ngày đầu tiên còn trống). */
  readonly pickedDay = signal<string | null>(null);
  /** Giờ nhận hẹn của chủ trang — để giải thích vì sao một số ngày không hiện. */
  readonly workingDays = signal<number[]>([1, 2, 3, 4, 5]);
  readonly workingStart = signal('08:00');
  readonly workingEnd = signal('17:00');
  readonly daysAhead = signal(14);

  readonly days = computed<DayGroup[]>(() => {
    const groups = new Map<string, DayGroup>();
    for (const iso of this.slotList()) {
      const d = new Date(iso);
      // Khoá theo NGÀY địa phương (không dùng ISO/UTC để khỏi lệch múi giờ)
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' }),
          weekday: WEEKDAY_SHORT[d.getDay()],
          dayNum: d.getDate(),
          slots: [],
        });
      }
      groups.get(key)!.slots.push({
        iso,
        label: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      });
    }
    // Sắp xếp ngày tăng dần cho chắc (không phụ thuộc thứ tự backend trả về)
    return [...groups.values()].sort((a, b) => (a.slots[0].iso < b.slots[0].iso ? -1 : 1));
  });

  /** Ngày đang xem: ưu tiên ngày đã bấm, không thì ngày trống gần nhất. */
  readonly activeDay = computed(() => {
    const picked = this.pickedDay();
    const list = this.days();
    if (picked && list.some((d) => d.key === picked)) return picked;
    return list[0]?.key ?? '';
  });
  readonly activeSlots = computed(() => this.days().find((d) => d.key === this.activeDay())?.slots ?? []);
  activeDayLabel(): string {
    return this.days().find((d) => d.key === this.activeDay())?.label ?? '';
  }
  /** "T2, T3, T4, T5, T6" — các thứ chủ trang nhận hẹn. */
  workingDaysLabel(): string {
    const ds = [...this.workingDays()].sort((a, b) => ((a || 7) - (b || 7)));
    return ds.map((d) => WEEKDAY_SHORT[d]).join(', ');
  }

  chosenLabel(): string {
    const iso = this.chosen();
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  constructor() {
    this.api.getPublicPage(this.slug).subscribe({
      next: (p) => {
        this.page.set({ title: p.title, durationMinutes: p.durationMinutes });
        this.api.getSlots(this.slug).subscribe({
          next: (s) => {
            this.slotList.set(s.slots);
            if (s.workingDays?.length) this.workingDays.set(s.workingDays);
            if (s.workingStart) this.workingStart.set(s.workingStart);
            if (s.workingEnd) this.workingEnd.set(s.workingEnd);
            if (s.daysAhead) this.daysAhead.set(s.daysAhead);
            this.loading.set(false);
          },
          error: () => { this.slotList.set([]); this.loading.set(false); },
        });
      },
      error: (e) => {
        this.loading.set(false);
        this.loadError.set(e?.error?.message ?? 'Trang không tồn tại hoặc đang tắt.');
      },
    });
  }

  submit(): void {
    const iso = this.chosen();
    if (!iso) return;
    this.submitting.set(true);
    this.bookError.set(null);
    this.api.book(this.slug, { name: this.name().trim(), email: this.email().trim(), startTime: iso }).subscribe({
      next: () => { this.submitting.set(false); this.booked.set(true); },
      error: (e) => {
        this.submitting.set(false);
        this.bookError.set(e?.error?.message ?? 'Đặt lịch thất bại. Thử lại nhé.');
      },
    });
  }
}
