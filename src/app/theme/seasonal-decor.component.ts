// SeasonalDecorComponent: lớp phủ trang trí lễ hội.
// - Vài emoji ĐỨNG YÊN ở 4 góc (lồng đèn, bí ngô, cây thông...).
// - Ít emoji RƠI nhẹ (cánh hoa, tuyết, dơi...) cho có không khí, không rối.
// Hiện khi có dịp (thật hoặc chọn tay) và công tắc đang bật.
// pointer-events: none nên không chặn thao tác. Tôn trọng prefers-reduced-motion.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SeasonalThemeService } from './seasonal-theme.service';

interface Flake {
  emoji: string;
  left: number;
  delay: number;
  dur: number;
  size: number;
  drift: number;
}

@Component({
  selector: 'app-seasonal-decor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (season(); as s) {
      <div class="seasonal-decor" aria-hidden="true">
        <!-- Chỉ emoji rơi nhẹ (đã bỏ trang trí đứng yên theo yêu cầu) -->
        @for (f of flakes(); track $index) {
          <span
            class="seasonal-flake"
            [style.left.%]="f.left"
            [style.animation-delay.s]="f.delay"
            [style.animation-duration.s]="f.dur"
            [style.font-size.px]="f.size"
            [style.--drift.px]="f.drift"
          >{{ f.emoji }}</span>
        }
      </div>
    }
  `,
})
export class SeasonalDecorComponent {
  private readonly seasonal = inject(SeasonalThemeService);

  protected readonly season = computed(() => this.seasonal.effectiveSeason());

  /** Danh sách emoji rơi (gộp emoji "rơi" + emoji đặc trưng của dịp cho phong phú). */
  protected readonly flakes = computed<Flake[]>(() => {
    const s = this.season();
    if (!s) return [];
    const pool = [...s.fall, ...s.pinned.map((p) => p.emoji)];
    if (pool.length === 0) return [];
    const N = 14;
    const out: Flake[] = [];
    for (let i = 0; i < N; i++) {
      out.push({
        emoji: pool[i % pool.length],
        left: Math.round((i / N) * 100 + (Math.random() * 6 - 3)),
        delay: +(Math.random() * 9).toFixed(2),
        dur: +(9 + Math.random() * 7).toFixed(2),
        size: 15 + Math.round(Math.random() * 12),
        drift: Math.round(Math.random() * 50 - 25),
      });
    }
    return out;
  });
}
