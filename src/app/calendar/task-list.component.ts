// Trang danh sách Công việc (Task) — gom mọi sự kiện kind='task' vào 1 danh sách,
// chia "Cần làm" / "Đã xong", tick để đổi trạng thái. Bấm 1 việc -> mở trên lịch.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CalendarStateService } from './calendar-state.service';
import { SettingsService } from '../settings/settings.service';
import { TranslateService } from '../i18n/translate.service';
import { IconComponent } from '../shared/icon.component';
import { CalendarEvent } from './calendar.types';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 text-gray-800">
      <header class="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <a routerLink="/" class="tap flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          <app-icon name="arrow-back" class="h-5 w-5" /> {{ tr.t('settings.back') }}
        </a>
        <h1 class="text-lg font-medium">{{ tr.t('tasks.title') }}</h1>
      </header>

      <div class="mx-auto max-w-2xl space-y-6 p-4">
        @if (todo().length === 0 && done().length === 0) {
          <p class="py-10 text-center text-sm text-gray-400">{{ tr.t('tasks.none') }}</p>
        }

        @if (todo().length > 0) {
          <section>
            <p class="mb-2 text-sm font-medium text-gray-500">{{ tr.t('tasks.todo') }} ({{ todo().length }})</p>
            <ul class="space-y-1 rounded-lg border border-gray-200 bg-white">
              @for (t of todo(); track t.id) {
                <li class="flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0">
                  <input type="checkbox" [checked]="false" (change)="toggle(t)" class="h-4 w-4 accent-emerald-600" />
                  <button type="button" (click)="open(t)" class="min-w-0 flex-1 text-left">
                    <span class="block truncate text-sm">{{ t.title || tr.t('common.untitled') }}</span>
                    <span class="block truncate text-xs text-gray-400">{{ dateLabel(t) }}</span>
                  </button>
                </li>
              }
            </ul>
          </section>
        }

        @if (done().length > 0) {
          <section>
            <p class="mb-2 text-sm font-medium text-gray-500">{{ tr.t('tasks.done') }} ({{ done().length }})</p>
            <ul class="space-y-1 rounded-lg border border-gray-200 bg-white">
              @for (t of done(); track t.id) {
                <li class="flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 opacity-60">
                  <input type="checkbox" [checked]="true" (change)="toggle(t)" class="h-4 w-4 accent-emerald-600" />
                  <button type="button" (click)="open(t)" class="min-w-0 flex-1 text-left">
                    <span class="block truncate text-sm line-through">{{ t.title || tr.t('common.untitled') }}</span>
                    <span class="block truncate text-xs text-gray-400">{{ dateLabel(t) }}</span>
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    </div>
  `,
})
export class TaskListComponent {
  protected readonly state = inject(CalendarStateService);
  protected readonly settings = inject(SettingsService);
  protected readonly tr = inject(TranslateService);
  private readonly router = inject(Router);

  private readonly tasks = computed(() =>
    this.state.events()
      .filter((e) => e.kind === 'task')
      .sort((a, b) => a.start.getTime() - b.start.getTime()),
  );
  protected readonly todo = computed(() => this.tasks().filter((t) => !t.completed));
  protected readonly done = computed(() => this.tasks().filter((t) => t.completed));

  protected dateLabel(t: CalendarEvent): string {
    return t.isAllDay
      ? this.settings.formatDate(t.start)
      : `${this.settings.formatDate(t.start)} · ${this.settings.formatTime(t.start)}`;
  }

  protected toggle(t: CalendarEvent): void {
    this.state.setTaskCompleted(t.id, !t.completed);
  }

  protected open(t: CalendarEvent): void {
    this.state.selectDate(t.start, true);
    this.state.selectEvent(t.id);
    void this.router.navigate(['/']);
  }
}
