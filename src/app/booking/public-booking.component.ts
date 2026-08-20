// Trang đặt lịch công khai — KHÔNG cần đăng nhập. Người ngoài mở /book/<slug>,
// chọn khung giờ trống rồi điền tên + email để đặt.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BookingApiService } from './booking-api.service';

interface DayGroup {
  label: string;
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
              @if (days().length === 0) {
                <p class="py-8 text-center text-sm text-gray-400">Hiện chưa có khung giờ trống trong 2 tuần tới.</p>
              }
              @for (d of days(); track d.label) {
                <div class="mb-4">
                  <p class="mb-2 text-sm font-medium text-gray-600">{{ d.label }}</p>
                  <div class="flex flex-wrap gap-2">
                    @for (s of d.slots; track s.iso) {
                      <button type="button" (click)="chosen.set(s.iso)"
                        class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:border-blue-600 hover:bg-blue-50">
                        {{ s.label }}
                      </button>
                    }
                  </div>
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

  readonly days = computed<DayGroup[]>(() => {
    const groups = new Map<string, DayGroup>();
    for (const iso of this.slotList()) {
      const d = new Date(iso);
      const key = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
      if (!groups.has(key)) groups.set(key, { label: key, slots: [] });
      groups.get(key)!.slots.push({
        iso,
        label: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      });
    }
    return [...groups.values()];
  });

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
          next: (s) => { this.slotList.set(s.slots); this.loading.set(false); },
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
