// SeasonalDecorComponent: lớp phủ trang trí lễ hội (emoji rơi/lơ lửng).
// Hiện khi có dịp lễ đang diễn ra thật, HOẶC người dùng chọn tay 1 dịp.
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
    @if (flakes(); as list) {
      <div class="seasonal-decor" aria-hidden="true">
        @for (f of list; track $index) {
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

  /** Danh sách emoji rơi, tạo lại khi đổi dịp. null = không trang trí. */
  protected readonly flakes = computed<Flake[] | null>(() => {
    const season = this.seasonal.effectiveSeason();
    if (!season) return null;
    const emojis = season.decor;
    const N = 18;
    const out: Flake[] = [];
    for (let i = 0; i < N; i++) {
      out.push({
        emoji: emojis[i % emojis.length],
        left: Math.round((i / N) * 100 + (Math.random() * 6 - 3)),
        delay: +(Math.random() * 8).toFixed(2),
        dur: +(7 + Math.random() * 7).toFixed(2),
        size: 16 + Math.round(Math.random() * 16),
        drift: Math.round(Math.random() * 60 - 30),
      });
    }
    return out;
  });
}
