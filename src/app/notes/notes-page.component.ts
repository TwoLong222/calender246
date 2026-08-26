// Trang Ghi chú (kiểu Google Keep): ô soạn nhanh ở trên, lưới thẻ bên dưới.
// - Ghim để đưa lên đầu; đổi màu thẻ; sửa tại chỗ (lưu khi rời ô); xoá.
// - Màu thẻ dùng hex inline (không dùng class blue-* để khỏi bị theme accent remap).

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateService } from '../i18n/translate.service';
import { IconComponent } from '../shared/icon.component';
import { Note, NoteColor, NotesApiService } from './notes-api.service';

/** Bảng màu thẻ (nền sáng, chữ luôn tối cho dễ đọc kể cả dark mode). */
const NOTE_BG: Record<NoteColor, string> = {
  default: '#ffffff',
  red: '#f28b82',
  orange: '#fbbc04',
  yellow: '#fff475',
  green: '#ccff90',
  teal: '#a7ffeb',
  blue: '#cbf0f8',
  purple: '#d7aefb',
  pink: '#fdcfe8',
};
const COLOR_ORDER: NoteColor[] = ['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

@Component({
  selector: 'app-notes-page',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view-fade min-h-screen bg-gray-50 text-gray-800">
      <header class="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <a routerLink="/" class="tap flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          <app-icon name="arrow-back" class="h-5 w-5" /> {{ tr.t('settings.back') }}
        </a>
        <app-icon name="notes" class="h-5 w-5 text-amber-500" />
        <h1 class="text-lg font-medium">{{ tr.t('notes.title') }}</h1>
      </header>

      <div class="mx-auto max-w-3xl p-4">
        <!-- Ô soạn ghi chú mới -->
        <div class="mx-auto mb-6 max-w-xl rounded-xl border border-gray-200 bg-white p-3 shadow-sm" [style.background-color]="bg(newColor())">
          <input
            [(ngModel)]="newTitle"
            maxlength="1000"
            [placeholder]="tr.t('notes.titlePlaceholder')"
            class="w-full bg-transparent text-sm font-medium outline-none placeholder:text-gray-500"
          />
          <textarea
            [(ngModel)]="newContent"
            maxlength="1000"
            [placeholder]="tr.t('notes.contentPlaceholder')"
            rows="2"
            class="mt-1 w-full resize-none bg-transparent text-sm outline-none placeholder:text-gray-500"
          ></textarea>
          <div class="mt-2 flex items-center justify-between">
            <div class="flex gap-1">
              @for (c of colors; track c) {
                <button
                  type="button"
                  (click)="newColor.set(c)"
                  [title]="c"
                  class="h-5 w-5 rounded-full border"
                  [style.background-color]="bg(c)"
                  [class.border-gray-800]="newColor() === c"
                  [class.border-gray-300]="newColor() !== c"
                ></button>
              }
            </div>
            <!-- Bỏ [disabled]="!canAdd()" — trước đây nút bị khóa (mờ đi) trong lúc gõ khiến
                 người dùng tưởng bị "lock". Vẫn an toàn: add() tự kiểm tra canAdd() bên trong,
                 bấm khi rỗng chỉ no-op chứ không tạo ghi chú trống. -->
            <button
              type="button"
              (click)="add()"
              class="tap rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >{{ tr.t('notes.add') }}</button>
          </div>
        </div>

        @if (error()) { <p class="mb-3 text-center text-sm text-red-600">{{ error() }}</p> }

        @if (loading()) {
          <!-- Khung xương giữ chỗ để không nhảy layout khi dữ liệu về -->
          <div class="[column-gap:0.75rem] sm:columns-2 lg:columns-3">
            @for (h of skeletons; track h) {
              <div class="mb-3 inline-block w-full break-inside-avoid rounded-xl border border-gray-200 bg-white p-3">
                <div class="h-4 w-2/3 animate-pulse rounded bg-gray-200"></div>
                <div class="mt-2 animate-pulse rounded bg-gray-100" [style.height.px]="h"></div>
              </div>
            }
          </div>
        } @else if (notes().length === 0) {
          <p class="py-10 text-center text-sm text-gray-400">{{ tr.t('notes.empty') }}</p>
        } @else {
          <!-- Lưới thẻ kiểu masonry bằng CSS columns -->
          <div class="[column-gap:0.75rem] sm:columns-2 lg:columns-3">
            @for (n of notes(); track n.id) {
              <div
                class="mb-3 inline-block w-full break-inside-avoid rounded-xl border border-black/10 p-3 text-gray-900 shadow-sm"
                [style.background-color]="bg(n.color)"
              >
                <div class="flex items-start justify-between gap-2">
                  <input
                    [ngModel]="n.title"
                    (ngModelChange)="n.title = $event"
                    (blur)="save(n)"
                    maxlength="1000"
                    [placeholder]="tr.t('notes.titlePlaceholder')"
                    class="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-gray-500"
                  />
                  <button type="button" (click)="togglePin(n)" [title]="tr.t('notes.pin')" class="shrink-0 text-gray-600 hover:text-gray-900">
                    <app-icon name="target" class="h-4 w-4" [class.text-amber-600]="n.pinned" />
                  </button>
                </div>
                <textarea
                  [ngModel]="n.content"
                  (ngModelChange)="n.content = $event"
                  (blur)="save(n)"
                  maxlength="1000"
                  [placeholder]="tr.t('notes.contentPlaceholder')"
                  rows="3"
                  class="mt-1 w-full resize-none bg-transparent text-sm outline-none placeholder:text-gray-500"
                ></textarea>
                <div class="mt-2 flex items-center justify-between">
                  <div class="flex flex-wrap gap-1">
                    @for (c of colors; track c) {
                      <button
                        type="button"
                        (click)="setColor(n, c)"
                        [title]="c"
                        class="h-4 w-4 rounded-full border"
                        [style.background-color]="bg(c)"
                        [class.border-gray-800]="n.color === c"
                        [class.border-gray-300]="n.color !== c"
                      ></button>
                    }
                  </div>
                  <button type="button" (click)="remove(n)" [title]="tr.t('notes.delete')" class="text-gray-600 hover:text-red-600">
                    <app-icon name="trash" class="h-4 w-4" />
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class NotesPageComponent {
  protected readonly tr = inject(TranslateService);
  private readonly api = inject(NotesApiService);

  protected readonly colors = COLOR_ORDER;
  /** Chiều cao (px) cho các thẻ skeleton — cao thấp xen kẽ cho giống thật. */
  protected readonly skeletons = [64, 96, 48, 80, 60, 72];
  protected readonly notes = signal<Note[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly newTitle = signal('');
  protected readonly newContent = signal('');
  protected readonly newColor = signal<NoteColor>('default');
  protected readonly canAdd = computed(() => this.newTitle().trim().length > 0 || this.newContent().trim().length > 0);

  constructor() {
    this.reload();
  }

  protected bg(c: NoteColor): string {
    return NOTE_BG[c] ?? NOTE_BG.default;
  }

  private reload(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (list) => {
        this.notes.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.tr.t('notes.loadError'));
        this.loading.set(false);
      },
    });
  }

  protected add(): void {
    if (!this.canAdd()) return;
    const draft = { title: this.newTitle().trim(), content: this.newContent().trim(), color: this.newColor() };
    this.api.create(draft).subscribe({
      next: (created) => {
        this.notes.update((list) => [created, ...list]);
        this.newTitle.set('');
        this.newContent.set('');
        this.newColor.set('default');
      },
      error: () => this.error.set(this.tr.t('notes.saveError')),
    });
  }

  /** Lưu tiêu đề/nội dung khi rời ô. */
  protected save(n: Note): void {
    this.api.update(n.id, { title: n.title, content: n.content }).subscribe({
      error: () => this.error.set(this.tr.t('notes.saveError')),
    });
  }

  protected setColor(n: Note, c: NoteColor): void {
    n.color = c;
    this.notes.update((list) => [...list]); // ép cập nhật nền
    this.api.update(n.id, { color: c }).subscribe({ error: () => this.error.set(this.tr.t('notes.saveError')) });
  }

  protected togglePin(n: Note): void {
    n.pinned = !n.pinned;
    this.api.update(n.id, { pinned: n.pinned }).subscribe({
      next: () => this.resort(),
      error: () => this.error.set(this.tr.t('notes.saveError')),
    });
  }

  protected remove(n: Note): void {
    this.api.remove(n.id).subscribe({
      next: () => this.notes.update((list) => list.filter((x) => x.id !== n.id)),
      error: () => this.error.set(this.tr.t('notes.saveError')),
    });
  }

  /** Sắp lại: ghim trước, mới cập nhật trước. */
  private resort(): void {
    this.notes.update((list) =>
      [...list].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updated_at.localeCompare(a.updated_at);
      }),
    );
  }
}
