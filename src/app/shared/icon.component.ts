// IconComponent: render icon dạng SVG (nét mảnh, đồng bộ mọi máy).
// Bộ icon lấy từ Tabler Icons (giấy phép MIT) — copy sẵn vào code
// để không phụ thuộc thư viện ngoài / CDN / mạng.
//
// Cách dùng:
//   <app-icon name="trash" />                    -> mặc định 20px
//   <app-icon name="settings" class="h-6 w-6" /> -> tùy chỉnh cỡ
//   <app-icon name="moon" class="h-5 w-5 text-amber-500" /> -> theo màu chữ
// Icon tô theo màu chữ hiện tại (stroke=currentColor).

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'trash' | 'settings' | 'moon' | 'sun' | 'search' | 'calendar' | 'robot'
  | 'download' | 'upload' | 'inbox' | 'alarm' | 'arrow-back' | 'check'
  | 'alert' | 'x' | 'chevron-left' | 'chevron-right' | 'chevron-up' | 'chevron-down' | 'plus' | 'pencil'
  | 'notes' | 'target' | 'palette' | 'message' | 'send'
  | 'user' | 'world' | 'bell' | 'mail' | 'shield' | 'dots' | 'logout'
  | 'lock' | 'eye' | 'eye-off' | 'adjustments' | 'menu';

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // "class" từ ngoài truyền vào (vd "h-6 w-6 text-red-500") sẽ merge với các class mặc định
  host: { '[class]': '"inline-block shrink-0 " + (hostClass() ?? "")' },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-full w-full"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.aria-hidden]="true"
    >
      @switch (name()) {
        @case ('trash') {
          <path d="M4 7h16" />
          <path d="M10 11v6 M14 11v6" />
          <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
          <path d="M9 7V4a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
        }
        @case ('settings') {
          <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
          <circle cx="12" cy="12" r="3" />
        }
        @case ('moon') {
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path d="M3 12h1 M12 3v1 M20 12h1 M12 20v1 M5.6 5.6l.7 .7 M18.4 5.6l-.7 .7 M17.7 17.7l.7 .7 M6.3 17.7l-.7 .7" />
        }
        @case ('search') {
          <circle cx="10" cy="10" r="7" />
          <path d="M21 21l-6 -6" />
        }
        @case ('calendar') {
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M16 3v4 M8 3v4 M4 11h16" />
        }
        @case ('robot') {
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M12 2v3 M9 12v0 M15 12v0 M9 16c1 .667 2 1 3 1s2 -.333 3 -1" />
        }
        @case ('download') {
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
          <path d="M7 11l5 5l5 -5 M12 4v12" />
        }
        @case ('upload') {
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
          <path d="M7 9l5 -5l5 5 M12 4v12" />
        }
        @case ('inbox') {
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M4 13h3l3 3h4l3 -3h3" />
        }
        @case ('alarm') {
          <circle cx="12" cy="13" r="7" />
          <path d="M12 10v3l2 2" />
          <path d="M7 4l-2.75 2 M17 4l2.75 2" />
        }
        @case ('arrow-back') {
          <path d="M9 14l-4 -4l4 -4" />
          <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
        }
        @case ('check') {
          <path d="M5 12l5 5l10 -10" />
        }
        @case ('alert') {
          <path d="M12 9v4 M12 16h.01" />
          <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
        }
        @case ('x') {
          <path d="M18 6l-12 12 M6 6l12 12" />
        }
        @case ('chevron-left') {
          <path d="M15 6l-6 6l6 6" />
        }
        @case ('chevron-right') {
          <path d="M9 6l6 6l-6 6" />
        }
        @case ('chevron-up') {
          <path d="M6 15l6-6l6 6" />
        }
        @case ('chevron-down') {
          <path d="M6 9l6 6l6-6" />
        }
        @case ('plus') {
          <path d="M12 5v14 M5 12h14" />
        }
        @case ('pencil') {
          <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
          <path d="M13.5 6.5l4 4" />
        }
        @case ('notes') {
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 7h6 M9 11h6 M9 15h4" />
        }
        @case ('target') {
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        }
        @case ('palette') {
          <path d="M12 21a9 9 0 1 1 0 -18a9 8 0 0 1 9 8a4.5 4 0 0 1 -4.5 4h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" />
          <circle cx="8.5" cy="10.5" r="1" />
          <circle cx="12.5" cy="7.5" r="1" />
          <circle cx="16.5" cy="10.5" r="1" />
        }
        @case ('message') {
          <path d="M8 9h8 M8 13h6" />
          <path d="M9 18h-3a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-3l-3 3l-3 -3z" />
        }
        @case ('send') {
          <path d="M10 14l11 -11 M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" />
        }
        @case ('user') {
          <circle cx="12" cy="7" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
        }
        @case ('world') {
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8 M3.6 15h16.8 M11.5 3a17 17 0 0 0 0 18 M12.5 3a17 17 0 0 1 0 18" />
        }
        @case ('bell') {
          <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
          <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
        }
        @case ('mail') {
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6l9 -6" />
        }
        @case ('shield') {
          <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" />
          <path d="M12 11v2" />
          <circle cx="12" cy="11" r="0.5" />
        }
        @case ('dots') {
          <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
        }
        @case ('logout') {
          <path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
          <path d="M9 12h12l-3 -3 M18 15l3 -3" />
        }
        @case ('lock') {
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11v-4a4 4 0 0 1 8 0v4" />
        }
        @case ('eye') {
          <circle cx="12" cy="12" r="2" />
          <path d="M22 12c-2.667 4.667 -6 7 -10 7s-7.333 -2.333 -10 -7c2.667 -4.667 6 -7 10 -7s7.333 2.333 10 7" />
        }
        @case ('eye-off') {
          <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
          <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-4 0 -7.333 -2.333 -10 -7c1.407 -2.463 3 -4.246 4.777 -5.349m2.24 -1.71a9.533 9.533 0 0 1 2.983 -.474c4 0 7.333 2.333 10 7c-.778 1.361 -1.612 2.524 -2.503 3.489" />
          <path d="M3 3l18 18" />
        }
        @case ('adjustments') {
          <circle cx="6" cy="10" r="2" />
          <circle cx="12" cy="16" r="2" />
          <circle cx="18" cy="7" r="2" />
          <path d="M6 4v4 M6 12v8 M12 4v10 M12 18v2 M18 4v1 M18 9v11" />
        }
        @case ('menu') {
          <path d="M4 6h16 M4 12h16 M4 18h16" />
        }
      }
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  /** Class Tailwind cho kích thước/màu icon — mặc định 20px */
  readonly hostClass = input<string>('h-5 w-5', { alias: 'class' });
}
