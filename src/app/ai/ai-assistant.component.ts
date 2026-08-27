// Widget trợ lý AI nổi góc phải. Người dùng gõ câu tiếng Việt, backend (Gemini)
// phân tích ra Ý ĐỊNH (tạo/tìm/dời/xóa). Frontend TÌM event thật từ dữ liệu đã tải
// (đúng quyền), hiện PREVIEW, người dùng bấm Xác nhận thì mới thực thi qua các
// service có sẵn (auth + RLS). AI không bao giờ chạm thẳng database.

import { ChangeDetectionStrategy, Component, ElementRef, HostListener, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiApiService } from './ai-api.service';
import { CalendarStateService } from '../calendar/calendar-state.service';
import { GroupsStateService } from '../groups/groups-state.service';
import { CalendarEvent, EventKind } from '../calendar/calendar.types';
import { SupabaseService } from '../auth/supabase.service';
import { IconComponent } from '../shared/icon.component';
import { TranslateService } from '../i18n/translate.service';
import { ConfirmService } from '../shared/confirm.service';
import { NotesApiService, Note } from '../notes/notes-api.service';
import { SettingsService } from '../settings/settings.service';
import { ThemeService, ThemeMode } from '../theme.service';
import { ThemeBuilderService, ACCENT_PRESETS } from '../theme/theme-builder.service';
import { Group } from '../groups/groups.types';
import { IcsService } from '../calendar/ics.service';
import { PdfService } from '../calendar/pdf.service';

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
}

/** 1 cuộc trò chuyện với AI (lưu nhiều cuộc trên trình duyệt). */
interface Conversation {
  id: string;
  messages: ChatMsg[];
  updatedAt: number;
}

/** Key cũ (1 cuộc) — chỉ dùng để migrate sang danh sách nhiều cuộc. */
const AI_CHAT_KEY = 'ai-chat-history';
/** Danh sách cuộc trò chuyện + cuộc đang mở. */
const AI_CONVS_KEY = 'ai-conversations';
const AI_CURRENT_KEY = 'ai-current-conv';
/** Giữ tối đa 20 cuộc gần nhất để localStorage không phình. */
const MAX_CONVERSATIONS = 20;
interface PlannedSlot {
  start: Date;
  end: Date;
}
interface PlanPreferences {
  startHour: number;
  endHour: number;
  allowedWeekdays?: Set<number>;
}
type Pending =
  | { kind: 'create'; title: string; start: Date; end: Date; withMeet: boolean; emails: string[]; eventKind: EventKind }
  | { kind: 'plan'; title: string; slots: PlannedSlot[]; requestedCount: number }
  | { kind: 'reschedule'; event: CalendarEvent; start: Date; end: Date }
  | { kind: 'delete'; event: CalendarEvent }
  | { kind: 'invite'; event: CalendarEvent; emails: string[] }
  | { kind: 'completeTask'; task: CalendarEvent; completed: boolean }
  | { kind: 'createNote'; title: string; content: string }
  | { kind: 'deleteNote'; note: Note }
  | { kind: 'createGroup'; name: string }
  | { kind: 'joinGroup'; code: string }
  | { kind: 'inviteGroupMember'; group: Group; emails: string[] }
  | { kind: 'createGroupEvent'; group: Group; title: string; start: Date; end: Date; withMeet: boolean }
  | { kind: 'changeSetting'; settingKey: 'theme_mode' | 'language' | 'accent_color'; settingValue: string; label: string };

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!open()) {
      <button
        type="button"
        (click)="openPanel()"
        class="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg hover:bg-blue-800"
        [attr.aria-label]="tr.t('sec.ai')"
      >
        <app-icon name="robot" class="h-7 w-7" />
        <!-- Chấm đỏ: AI vừa trả lời khi panel đang đóng -->
        @if (unread()) {
          <span class="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
            <span class="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-500 ring-2 ring-white"></span>
          </span>
        }
      </button>
    } @else {
      <div class="popup-in fixed bottom-6 right-6 z-40 flex h-[460px] w-80 flex-col rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span class="flex items-center gap-2 font-medium text-gray-800">
            <app-icon name="robot" class="h-5 w-5 text-blue-700" /> {{ tr.t('ai.title') }}
          </span>
          <div class="flex items-center gap-1">
            <button type="button" (click)="newConversation()" class="rounded-full p-1.5 text-gray-500 hover:bg-gray-100" [attr.aria-label]="tr.t('ai.newChat')" [title]="tr.t('ai.newChat')">
              <app-icon name="plus" class="h-4 w-4" />
            </button>
            <button type="button" (click)="showList.set(!showList())" class="rounded-full p-1.5 text-gray-500 hover:bg-gray-100" [class.bg-gray-100]="showList()" [attr.aria-label]="tr.t('ai.history')" [title]="tr.t('ai.history')">
              <app-icon name="menu" class="h-4 w-4" />
            </button>
            <button type="button" (click)="open.set(false)" class="btn-icon !p-1.5 text-gray-500" [attr.aria-label]="tr.t('common.close')">
              <app-icon name="x" class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- Bảng LỊCH SỬ các cuộc trò chuyện (đè lên phần chat khi mở) -->
        @if (showList()) {
          <div class="absolute inset-0 z-10 flex flex-col rounded-xl bg-white">
            <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span class="font-medium text-gray-800">{{ tr.t('ai.history') }}</span>
              <div class="flex items-center gap-1">
                <button type="button" (click)="newConversation()" class="rounded-full p-1.5 text-gray-500 hover:bg-gray-100" [title]="tr.t('ai.newChat')"><app-icon name="plus" class="h-4 w-4" /></button>
                <button type="button" (click)="showList.set(false)" class="btn-icon !p-1.5 text-gray-500" [attr.aria-label]="tr.t('common.close')"><app-icon name="x" class="h-4 w-4" /></button>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto py-1">
              @for (c of conversations(); track c.id) {
                <div class="flex items-center gap-1 px-2" [class.bg-blue-50]="c.id === currentId()">
                  <button type="button" (click)="switchConversation(c.id)" class="min-w-0 flex-1 truncate rounded px-2 py-2 text-left text-sm text-gray-800 hover:bg-gray-50">{{ conversationTitle(c) }}</button>
                  <button type="button" (click)="deleteConversation(c.id)" class="tap shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-600" [attr.aria-label]="tr.t('detail.delete')"><app-icon name="trash" class="h-3.5 w-3.5" /></button>
                </div>
              }
            </div>
          </div>
        }

        <div #scrollBox class="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          @for (m of messages(); track $index) {
            <div [class]="m.role === 'user'
              ? 'ml-auto max-w-[85%] rounded-lg bg-blue-600 px-3 py-2 text-sm text-white'
              : 'mr-auto max-w-[90%] whitespace-pre-wrap rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800'">
              {{ m.text }}
            </div>
          }
          @if (loading()) {
            <div class="mr-auto rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-400">{{ tr.t('ai.thinking') }}</div>
          }
          @if (pending(); as p) {
            <div
              class="mr-auto w-full rounded-lg border px-3 py-2 text-sm"
              [class]="p.kind === 'delete' || p.kind === 'deleteNote' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'"
            >
              @switch (p.kind) {
                @case ('create') {
                  <p class="mb-1 font-medium text-gray-800">
                    {{ p.eventKind === 'task' ? tr.t('ai.createTask') : p.eventKind === 'appointment' ? tr.t('ai.createAppointment') : tr.t('ai.createEvent') }}
                  </p>
                  <p class="text-gray-700">📌 {{ p.title }}</p>
                  <p class="text-gray-700">🕐 {{ rangeLabel(p.start, p.end) }}</p>
                  @if (p.withMeet) {
                    <p class="text-gray-700">📹 {{ tr.t('ai.withMeet') }}</p>
                  }
                  @if (p.emails.length) {
                    <p class="text-gray-700">👤 {{ p.emails.join(', ') }}</p>
                  }
                }
                @case ('plan') {
                  <p class="mb-1 font-medium text-gray-800">{{ tr.t('ai.planSuggest') }} {{ p.title }}</p>
                  <p class="mb-1 text-xs text-gray-600">{{ tr.t('ai.foundA') }} {{ p.slots.length }}/{{ p.requestedCount }} {{ tr.t('ai.foundB') }}</p>
                  @for (slot of p.slots; track slot.start.getTime()) {
                    <p class="text-gray-700">🕐 {{ rangeLabel(slot.start, slot.end) }}</p>
                  }
                }
                @case ('reschedule') {
                  <p class="mb-1 font-medium text-gray-800">{{ tr.t('ai.reschedule') }}</p>
                  <p class="text-gray-700">📌 {{ p.event.title }}</p>
                  <p class="text-gray-700">🕐 {{ tr.t('ai.to') }} {{ rangeLabel(p.start, p.end) }}</p>
                }
                @case ('delete') {
                  <p class="mb-1 font-medium text-red-800">{{ tr.t('ai.deleteEvent') }}</p>
                  <p class="text-gray-700">📌 {{ p.event.title }} — {{ eventLabel(p.event) }}</p>
                }
                @case ('invite') {
                  <p class="mb-1 font-medium text-gray-800">{{ tr.t('ai.inviteGuest') }}</p>
                  <p class="text-gray-700">📌 {{ p.event.title }} — {{ eventLabel(p.event) }}</p>
                  <p class="text-gray-700">👤 {{ p.emails.join(', ') }}</p>
                }
                @case ('completeTask') {
                  <p class="mb-1 font-medium text-gray-800">{{ tr.t('ai.completeTask') }}</p>
                  <p class="text-gray-700">📌 {{ p.task.title }}</p>
                  <p class="text-gray-700">{{ p.completed ? '✅ ' + tr.t('ai.taskDone') : '↩️ ' + tr.t('ai.taskNotDone') }}</p>
                }
                @case ('createNote') {
                  <p class="mb-1 font-medium text-gray-800">{{ tr.t('ai.createNote') }}</p>
                  @if (p.title) { <p class="text-gray-700">📌 {{ p.title }}</p> }
                  <p class="text-gray-700">📝 {{ p.content }}</p>
                }
                @case ('deleteNote') {
                  <p class="mb-1 font-medium text-red-800">{{ tr.t('ai.deleteNote') }}</p>
                  <p class="text-gray-700">📝 {{ p.note.title || p.note.content }}</p>
                }
                @case ('createGroup') {
                  <p class="mb-1 font-medium text-gray-800">{{ tr.t('ai.createGroup') }}</p>
                  <p class="text-gray-700">👥 {{ p.name }}</p>
                }
                @case ('joinGroup') {
                  <p class="mb-1 font-medium text-gray-800">{{ tr.t('ai.joinGroup') }}</p>
                  <p class="text-gray-700">🔑 {{ p.code }}</p>
                }
                @case ('inviteGroupMember') {
                  <p class="mb-1 font-medium text-gray-800">{{ tr.t('ai.inviteGroupMember') }}</p>
                  <p class="text-gray-700">👥 {{ p.group.name }}</p>
                  <p class="text-gray-700">👤 {{ p.emails.join(', ') }}</p>
                }
                @case ('createGroupEvent') {
                  <p class="mb-1 font-medium text-gray-800">{{ tr.t('ai.createGroupEvent') }} {{ p.group.name }}</p>
                  <p class="text-gray-700">📌 {{ p.title }}</p>
                  <p class="text-gray-700">🕐 {{ rangeLabel(p.start, p.end) }}</p>
                  @if (p.withMeet) { <p class="text-gray-700">📹 {{ tr.t('ai.withMeet') }}</p> }
                }
                @case ('changeSetting') {
                  <p class="mb-1 font-medium text-gray-800">{{ tr.t('ai.changeSetting') }}</p>
                  <p class="text-gray-700">⚙️ {{ tr.t('ai.settingKey.' + p.settingKey) }} → {{ p.label }}</p>
                }
              }
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  (click)="confirm()"
                  class="rounded px-3 py-1 text-xs font-medium text-white"
                  [class]="pending()?.kind === 'delete' || pending()?.kind === 'deleteNote' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'"
                >{{ tr.t('ai.confirm') }}</button>
                <button type="button" (click)="cancel()" class="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">{{ tr.t('del.cancel') }}</button>
              </div>
            </div>
          }
        </div>

        <!-- Gợi ý câu hỏi bấm nhanh — người dùng không phải tự nghĩ ra câu lệnh.
             Ẩn khi đang có việc chờ xác nhận để không che mất nút Xác nhận/Huỷ. -->
        @if (!pending() && !loading()) {
          <div class="flex shrink-0 flex-wrap gap-1.5 border-t border-gray-100 px-3 pt-2.5">
            @for (s of suggestions(); track s.text) {
              <button
                type="button"
                (click)="useSuggestion(s)"
                class="tap rounded-full border border-gray-300 px-2.5 py-1 text-[11px] text-gray-600 transition-colors hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
              >{{ s.label }}</button>
            }
          </div>
        }

        <div class="flex gap-2 border-t border-gray-100 p-3">
          <input
            #chatInput
            [(ngModel)]="input"
            (keydown.enter)="send()"
            [disabled]="loading()"
            [placeholder]="tr.t('ai.placeholder')"
            class="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-600"
          />
          <button
            type="button"
            (click)="send()"
            [disabled]="loading() || !input().trim()"
            class="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40"
          >{{ tr.t('ai.send') }}</button>
        </div>
      </div>
    }
  `,
})
export class AiAssistantComponent {
  private readonly ai = inject(AiApiService);
  private readonly state = inject(CalendarStateService);
  private readonly groupsState = inject(GroupsStateService);
  private readonly supabase = inject(SupabaseService);
  protected readonly tr = inject(TranslateService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notesApi = inject(NotesApiService);
  private readonly settingsSvc = inject(SettingsService);
  private readonly themeSvc = inject(ThemeService);
  private readonly themeBuilder = inject(ThemeBuilderService);
  private readonly icsSvc = inject(IcsService);
  private readonly pdfSvc = inject(PdfService);

  /** Bấm ra ngoài panel -> tự đóng chatbox (nút nổi + panel đều nằm trong host nên bấm chúng không bị đóng). */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(ev: Event): void {
    if (!this.open()) return;
    const target = ev.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.open.set(false);
  }

  open = signal(false);
  readonly chatInput = viewChild<ElementRef<HTMLInputElement>>('chatInput');
  input = signal('');
  loading = signal(false);

  /**
   * Câu hỏi gợi ý bấm nhanh.
   *
   * Gợi ý gửi đi NGÀY ĐẦY ĐỦ (dd/mm/yyyy) chứ không phải "hôm nay"/"ngày 26" — nói mơ hồ
   * thì AI phải tự đoán tháng/năm, dễ tra nhầm.
   *
   * `send`:
   *  - true  : loại chỉ ĐỌC (hỏi lịch) -> bấm là gửi luôn, không hại gì.
   *  - false : loại TẠO/SỬA lịch -> chỉ điền sẵn mẫu vào ô nhập rồi để con trỏ ở đó.
   *    Không tự gửi, vì tên sự kiện và giờ giấc là do NGƯỜI DÙNG quyết, không phải tôi
   *    viết cứng sẵn trong nút.
   */
  protected suggestions(): { label: string; text: string; send: boolean }[] {
    const d = (offset: number) => {
      const x = new Date();
      x.setDate(x.getDate() + offset);
      return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
    };
    return [
      { label: 'Hôm nay có gì?', text: `Ngày ${d(0)} có sự kiện gì?`, send: true },
      { label: 'Ngày mai có gì?', text: `Ngày ${d(1)} có sự kiện gì?`, send: true },
      { label: '7 ngày tới', text: `Liệt kê sự kiện từ ngày ${d(0)} đến ngày ${d(7)}`, send: true },
      { label: 'Tìm chỗ trống…', text: `Xếp giúp tôi 1 buổi họp 60 phút từ ngày ${d(0)} đến ngày ${d(7)}`, send: false },
      { label: 'Tạo sự kiện…', text: `Tạo sự kiện  ngày ${d(1)} lúc 14:00 trong 1 tiếng`, send: false },
    ];
  }

  /**
   * Bấm 1 gợi ý. Loại chỉ đọc thì gửi luôn; loại tạo/sửa thì chỉ điền mẫu vào ô nhập và
   * focus để người dùng sửa tên + giờ trước khi bấm Gửi.
   */
  protected useSuggestion(s: { text: string; send: boolean }): void {
    if (this.loading()) return;
    this.input.set(s.text);
    if (s.send) {
      this.send();
      return;
    }
    // Đặt con trỏ vào đúng chỗ cần điền (2 dấu cách sau "Tạo sự kiện") nếu có, không thì cuối câu.
    setTimeout(() => {
      const el = this.chatInput()?.nativeElement;
      if (!el) return;
      el.focus();
      const gap = s.text.indexOf('  ');
      const pos = gap >= 0 ? gap + 1 : s.text.length;
      el.setSelectionRange(pos, pos);
    });
  }
  pending = signal<Pending | null>(null);
  /** Danh sách cuộc trò chuyện (mới nhất lên đầu) + cuộc đang mở. */
  protected readonly conversations = signal<Conversation[]>(this.loadConversations());
  protected readonly currentId = signal<string>(this.initialCurrentId());
  /** Bật/tắt bảng lịch sử các cuộc trò chuyện. */
  protected readonly showList = signal(false);
  messages = signal<ChatMsg[]>(this.currentMessages());
  /** true khi AI vừa trả lời trong lúc panel đóng -> hiện chấm đỏ trên nút nổi. */
  unread = signal(false);

  /** Mở panel + xoá chấm đỏ chưa đọc. */
  openPanel(): void {
    this.open.set(true);
    this.unread.set(false);
  }

  private readonly scrollBox = viewChild<ElementRef<HTMLElement>>('scrollBox');

  constructor() {
    // Tự lưu tin nhắn vào cuộc đang mở mỗi khi đổi -> rời trang/mở lại vẫn còn.
    effect(() => {
      const msgs = this.messages();
      const id = this.currentId();
      this.conversations.update((list) => {
        const rest = list.filter((c) => c.id !== id);
        return [{ id, messages: msgs.slice(-50), updatedAt: Date.now() }, ...rest].slice(0, MAX_CONVERSATIONS);
      });
      this.persist();
    });
    // Tự cuộn xuống tin mới nhất mỗi khi có tin/loading/mở panel.
    effect(() => {
      this.messages();
      this.loading();
      this.pending();
      if (this.open()) this.scrollToBottom();
    });
  }

  private scrollToBottom(): void {
    // Đợi DOM cập nhật xong rồi cuộn mượt xuống cuối.
    setTimeout(() => {
      const el = this.scrollBox()?.nativeElement;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, 0);
  }

  // ---------- Nhiều cuộc trò chuyện (lưu localStorage) ----------
  private uid(): string {
    return `c${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  }
  private greeting(): ChatMsg {
    return { role: 'ai', text: this.tr.t('ai.greeting') };
  }
  private loadConversations(): Conversation[] {
    try {
      const raw = localStorage.getItem(AI_CONVS_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr) && arr.length) return arr as Conversation[];
    } catch { /* bỏ qua */ }
    // Migrate dữ liệu cũ (1 cuộc) nếu có.
    try {
      const old = localStorage.getItem(AI_CHAT_KEY);
      const msgs = old ? JSON.parse(old) : null;
      if (Array.isArray(msgs) && msgs.length) {
        return [{ id: this.uid(), messages: msgs as ChatMsg[], updatedAt: Date.now() }];
      }
    } catch { /* bỏ qua */ }
    return [{ id: this.uid(), messages: [this.greeting()], updatedAt: Date.now() }];
  }
  private initialCurrentId(): string {
    const saved = (() => { try { return localStorage.getItem(AI_CURRENT_KEY); } catch { return null; } })();
    const list = this.conversations();
    return (saved && list.some((c) => c.id === saved)) ? saved : list[0].id;
  }
  private currentMessages(): ChatMsg[] {
    return this.conversations().find((c) => c.id === this.currentId())?.messages ?? [this.greeting()];
  }
  private persist(): void {
    try {
      localStorage.setItem(AI_CONVS_KEY, JSON.stringify(this.conversations()));
      localStorage.setItem(AI_CURRENT_KEY, this.currentId());
    } catch { /* bỏ qua */ }
  }

  /** Tiêu đề cuộc trò chuyện = câu đầu tiên của người dùng (hoặc "Cuộc mới"). */
  protected conversationTitle(c: Conversation): string {
    const firstUser = c.messages.find((m) => m.role === 'user');
    return firstUser?.text.trim().slice(0, 40) || this.tr.t('ai.newChat');
  }
  /** Bắt đầu 1 cuộc trò chuyện MỚI (giữ các cuộc cũ). */
  newConversation(): void {
    const id = this.uid();
    this.conversations.update((list) => [{ id, messages: [this.greeting()], updatedAt: Date.now() }, ...list]);
    this.pending.set(null);
    this.currentId.set(id);
    this.messages.set([this.greeting()]);
    this.showList.set(false);
  }
  /** Mở lại 1 cuộc trò chuyện cũ. */
  switchConversation(id: string): void {
    const c = this.conversations().find((x) => x.id === id);
    if (!c) return;
    this.pending.set(null);
    this.currentId.set(id);
    this.messages.set(c.messages);
    this.showList.set(false);
  }
  /** Xoá 1 cuộc trò chuyện (hỏi xác nhận trước). */
  async deleteConversation(id: string): Promise<void> {
    const c = this.conversations().find((x) => x.id === id);
    const ok = await this.confirmSvc.ask({
      message: this.tr.t('confirm.delChat'),
      detail: c ? this.conversationTitle(c) : undefined,
    });
    if (!ok) return;
    this.conversations.update((list) => list.filter((c) => c.id !== id));
    if (this.conversations().length === 0) {
      this.newConversation();
      return;
    }
    if (this.currentId() === id) {
      this.switchConversation(this.conversations()[0].id);
    } else {
      this.persist();
    }
  }

  private push(text: string): void {
    this.messages.update((m) => [...m, { role: 'ai', text }]);
    // AI trả lời khi panel đóng -> báo chấm đỏ để người dùng biết.
    if (!this.open()) this.unread.set(true);
  }

  /**
   * Tập sự kiện trợ lý được phép tìm — phải GIỐNG HỆT cái đang vẽ trên lịch.
   *
   * Trước đây chỉ lấy state.events() (lịch CÁ NHÂN) nên mọi sự kiện của NHÓM đều bị bỏ sót:
   * hỏi "ngày 26 có gì" thì màn hình có 3 sự kiện mà trợ lý chỉ kể 1.
   */
  private searchableEvents(): CalendarEvent[] {
    return [...this.state.visibleEvents(), ...this.groupsState.visibleGroupEvents()];
  }

  /** Tìm event thật từ dữ liệu đã tải (đúng quyền), theo từ khóa + khoảng thời gian */
  private findEvents(query?: string, rangeStart?: string, rangeEnd?: string): CalendarEvent[] {
    const q = (query ?? '').trim().toLowerCase();
    const rs = rangeStart ? new Date(rangeStart).getTime() : null;
    const re = rangeEnd ? new Date(rangeEnd).getTime() : null;
    return this.searchableEvents()
      .filter((e) => {
        const matchQ =
          !q ||
          e.title.toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q) ||
          (e.location ?? '').toLowerCase().includes(q);
        // So khớp theo GIAO NHAU của 2 khoảng, không chỉ theo giờ bắt đầu: sự kiện bắt đầu
        // hôm trước mà kéo dài sang ngày đang hỏi (hoặc sự kiện cả ngày) vẫn phải được kể.
        const matchRange =
          (rs === null || e.end.getTime() >= rs) && (re === null || e.start.getTime() <= re);
        return matchQ && matchRange;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private listMsg(events: CalendarEvent[]): string {
    return events.slice(0, 8).map((e) => `• ${e.title || '(không tiêu đề)'} — ${this.eventLabel(e)}`).join('\n');
  }

  /** Dự phòng khi AI hiểu câu nhưng trả về thiếu dữ liệu có cấu trúc. */
  private planFromText(text: string): { title: string; count: number; durationMinutes: number } | null {
    const countMatch = text.match(/(?:xếp|sắp xếp|lên kế hoạch)\s+(\d+)\s*(?:buổi|lần|phiên)/i);
    if (!countMatch) return null;

    const durationMatch = text.match(/mỗi\s*(?:buổi|lần|phiên)?\s*(\d+(?:[.,]\d+)?)\s*(tiếng|giờ|phút)/i);
    const durationValue = durationMatch ? Number(durationMatch[1].replace(',', '.')) : 1;
    const durationMinutes = durationMatch?.[2].toLowerCase() === 'phút' ? durationValue : durationValue * 60;
    const title = text
      .replace(/^.*?(?:xếp|sắp xếp|lên kế hoạch)\s+\d+\s*(?:buổi|lần|phiên)\s*/i, '')
      .replace(/(?:,|\s)+(?:mỗi\s*(?:buổi|lần|phiên)?.*|trong\s+tuần.*|tuần\s+(?:này|tới|sau).*|trong\s+tháng.*|tháng\s+này.*)$/i, '')
      .trim();
    return title ? { title, count: Number(countMatch[1]), durationMinutes } : null;
  }

  /** Dùng khung thời gian AI trả về; nếu thiếu thì hiểu các mốc phổ biến trong câu tiếng Việt. */
  private planWindow(text: string, planStart?: string, planEnd?: string): { start?: string; end?: string } {
    if (planStart || planEnd) return { start: planStart, end: planEnd };
    const now = new Date();
    const lower = text.toLowerCase();
    if (lower.includes('tuần này')) {
      const end = new Date(now);
      end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
      end.setHours(21, 0, 0, 0);
      return { start: now.toISOString(), end: end.toISOString() };
    }
    if (lower.includes('tuần tới') || lower.includes('tuần sau')) {
      const start = new Date(now);
      start.setDate(start.getDate() + ((8 - start.getDay()) % 7));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(21, 0, 0, 0);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (lower.includes('tháng này')) {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 21, 0, 0, 0);
      return { start: now.toISOString(), end: end.toISOString() };
    }
    return {};
  }

  /** Kết hợp ràng buộc AI trả về với các cách nói thời gian thông dụng bằng tiếng Việt. */
  private planPreferences(
    text: string,
    aiStartHour?: number,
    aiEndHour?: number,
    aiWeekdays?: number[],
  ): PlanPreferences {
    let startHour = aiStartHour ?? 7;
    let endHour = aiEndHour ?? 21;
    const lower = text.toLowerCase();

    if (lower.includes('buổi sáng')) {
      startHour = Math.max(startHour, 7);
      endHour = Math.min(endHour, 12);
    } else if (lower.includes('buổi chiều')) {
      startHour = Math.max(startHour, 13);
      endHour = Math.min(endHour, 18);
    } else if (lower.includes('buổi tối')) {
      startHour = Math.max(startHour, 18);
      endHour = Math.min(endHour, 21);
    }

    const hourFrom = (match: RegExpMatchArray | null): number | null => {
      if (!match) return null;
      let hour = Number(match[1]);
      if (/(chiều|tối)/.test(match[0]) && hour < 12) hour += 12;
      return hour >= 0 && hour <= 23 ? hour : null;
    };
    const after = hourFrom(lower.match(/sau\s+(\d{1,2})\s*(?:giờ|h)?(?:\s*(?:chiều|tối|sáng))?/));
    const before = hourFrom(lower.match(/trước\s+(\d{1,2})\s*(?:giờ|h)?(?:\s*(?:chiều|tối|sáng))?/));
    if (after !== null) startHour = Math.max(startHour, after);
    if (before !== null) endHour = Math.min(endHour, before);

    let allowedWeekdays = aiWeekdays?.length ? new Set(aiWeekdays.filter((d) => d >= 0 && d <= 6)) : undefined;
    const range = lower.match(/(?:thứ|t)\s*([2-7])\s*(?:đến|-|tới)\s*(?:thứ|t)\s*([2-7])/);
    if (range) {
      allowedWeekdays = new Set<number>();
      for (let d = Number(range[1]) - 1; d <= Number(range[2]) - 1; d++) allowedWeekdays.add(d);
    }
    if (/không\s+(?:xếp\s+)?(?:thứ\s*7|t7).*(?:chủ\s*nhật|cn)|không\s+xếp\s+cuối\s+tuần/.test(lower)) {
      allowedWeekdays ??= new Set([0, 1, 2, 3, 4, 5, 6]);
      allowedWeekdays.delete(6);
      allowedWeekdays.delete(0);
    }
    return { startHour, endHour, allowedWeekdays };
  }

  /** Tìm các khoảng trống 30 phút trong giờ sinh hoạt 07:00–21:00, ưu tiên sớm và không đè lên lịch đã có. */
  private findFreeSlots(
    planStart: string | undefined,
    planEnd: string | undefined,
    count: number,
    durationMinutes: number,
    preferences: PlanPreferences = { startHour: 7, endHour: 21 },
  ): PlannedSlot[] {
    const now = new Date();
    const start = planStart && !Number.isNaN(new Date(planStart).getTime()) ? new Date(planStart) : now;
    const defaultEnd = new Date(start);
    defaultEnd.setDate(defaultEnd.getDate() + 7);
    const end = planEnd && !Number.isNaN(new Date(planEnd).getTime()) ? new Date(planEnd) : defaultEnd;
    if (end <= start) return [];

    const slots: PlannedSlot[] = [];
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    const limit = new Date(end);
    limit.setHours(0, 0, 0, 0);

    while (day <= limit && slots.length < count) {
      if (preferences.allowedWeekdays && !preferences.allowedWeekdays.has(day.getDay())) {
        day.setDate(day.getDate() + 1);
        continue;
      }
      const candidate = new Date(day);
      candidate.setHours(preferences.startHour, 0, 0, 0);
      if (candidate < start) {
        candidate.setTime(start.getTime());
        candidate.setMinutes(Math.ceil(candidate.getMinutes() / 30) * 30, 0, 0);
      }
      const closing = new Date(day);
      closing.setHours(Math.max(preferences.startHour, preferences.endHour), 0, 0, 0);

      while (candidate < closing && slots.length < count) {
        const finish = new Date(candidate.getTime() + durationMinutes * 60_000);
        const collidesWithEvent = this.state.events().some((e) => candidate < e.end && finish > e.start);
        const collidesWithSuggestion = slots.some((s) => candidate < s.end && finish > s.start);
        if (finish <= closing && finish <= end && !collidesWithEvent && !collidesWithSuggestion) {
          slots.push({ start: new Date(candidate), end: finish });
          candidate.setTime(finish.getTime() + 30 * 60_000);
        } else {
          candidate.setMinutes(candidate.getMinutes() + 30);
        }
      }
      day.setDate(day.getDate() + 1);
    }
    return slots;
  }

  send(): void {
    const text = this.input().trim();
    if (!text || this.loading()) return;
    // Lịch sử vài lượt gần nhất (trước tin hiện tại) để AI nhớ ngữ cảnh.
    const history = this.messages()
      .slice(-8)
      .map((m) => ({ role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', text: m.text }));
    this.messages.update((m) => [...m, { role: 'user', text }]);
    this.input.set('');
    this.pending.set(null);
    this.loading.set(true);

    this.ai.chat(text, history).subscribe({
      next: (res) => {
        this.loading.set(false);

        if (res.intent === 'create_event' && res.title && res.startTime && res.endTime) {
          const emails = (res.guestEmails ?? []).map((e) => e.trim()).filter((e) => e.includes('@'));
          this.push(res.reply);
          this.pending.set({ kind: 'create', title: res.title, start: new Date(res.startTime), end: new Date(res.endTime), withMeet: !!res.withMeet, emails, eventKind: res.kind ?? 'event' });
          return;
        }

        const fallbackPlan = this.planFromText(text);
        if ((res.intent === 'plan_schedule' && res.title) || fallbackPlan) {
          const title = res.title ?? fallbackPlan!.title;
          const requestedCount = Math.min(Math.max(res.count ?? fallbackPlan!.count, 1), 12);
          const durationMinutes = Math.min(Math.max(res.durationMinutes ?? fallbackPlan!.durationMinutes, 15), 240);
          const window = this.planWindow(text, res.planStart, res.planEnd);
          const preferences = this.planPreferences(text, res.preferredStartHour, res.preferredEndHour, res.allowedWeekdays);
          const slots = this.findFreeSlots(window.start, window.end, requestedCount, durationMinutes, preferences);
          if (slots.length === 0) {
            this.push('Mình chưa tìm được khung giờ trống phù hợp trong khoảng bạn chọn. Bạn thử nới rộng thời gian nhé.');
            return;
          }
          this.push(res.reply || 'Mình đã tìm các khung giờ trống để bạn xem trước.');
          this.pending.set({ kind: 'plan', title, slots, requestedCount });
          return;
        }

        if (res.intent === 'search_events') {
          const found = this.findEvents(res.query, res.rangeStart, res.rangeEnd);
          this.push(found.length ? `${res.reply}\n${this.listMsg(found)}` : `${res.reply}\n(Không tìm thấy sự kiện nào.)`);
          return;
        }

        if (res.intent === 'invite_guest') {
          const emails = (res.guestEmails ?? []).map((e) => e.trim()).filter((e) => e.includes('@'));
          if (emails.length === 0) {
            this.push('Bạn muốn mời email nào? Nhập kèm địa chỉ email nhé.');
            return;
          }
          const found = this.findEvents(res.query);
          if (found.length === 0) {
            this.push(`Không tìm thấy sự kiện "${res.query ?? ''}".`);
            return;
          }
          if (found.length > 1) {
            this.push(`Có ${found.length} sự kiện khớp:\n${this.listMsg(found)}\nBạn nói rõ hơn (ngày nào?) nhé.`);
            return;
          }
          const e = found[0];
          // Chỉ chủ event mới được thêm khách
          if (e.creatorEmail && e.creatorEmail.toLowerCase() !== this.supabase.user()?.email?.toLowerCase()) {
            this.push('Bạn chỉ có thể mời người vào sự kiện của chính mình.');
            return;
          }
          // Bỏ những email đã có sẵn trong danh sách khách
          const existing = new Set(e.guests.map((g) => g.email.toLowerCase()));
          const toAdd = emails.filter((em) => !existing.has(em.toLowerCase()));
          if (toAdd.length === 0) {
            this.push('Những người này đã có trong sự kiện rồi.');
            return;
          }
          this.push(res.reply);
          this.pending.set({ kind: 'invite', event: e, emails: toAdd });
          return;
        }

        if (res.intent === 'reschedule_event' || res.intent === 'delete_event') {
          const found = this.findEvents(res.query);
          if (found.length === 0) {
            this.push(`Không tìm thấy sự kiện "${res.query ?? ''}".`);
            return;
          }
          if (found.length > 1) {
            this.push(`Có ${found.length} sự kiện khớp:\n${this.listMsg(found)}\nBạn nói rõ hơn (ngày nào?) nhé.`);
            return;
          }
          const e = found[0];
          // Chỉ chủ event mới được dời/xóa
          if (e.creatorEmail && e.creatorEmail.toLowerCase() !== this.supabase.user()?.email?.toLowerCase()) {
            this.push('Bạn chỉ có thể dời/xóa sự kiện của chính mình.');
            return;
          }
          if (res.intent === 'reschedule_event') {
            if (!res.newStartTime) {
              this.push('Bạn muốn dời sang lúc nào?');
              return;
            }
            const start = new Date(res.newStartTime);
            const dur = e.end.getTime() - e.start.getTime();
            const end = res.newEndTime ? new Date(res.newEndTime) : new Date(start.getTime() + dur);
            this.push(res.reply);
            this.pending.set({ kind: 'reschedule', event: e, start, end });
          } else {
            this.push(res.reply);
            this.pending.set({ kind: 'delete', event: e });
          }
          return;
        }

        if (res.intent === 'complete_task') {
          const tasks = this.searchableEvents().filter((e) => e.kind === 'task');
          const q = (res.query ?? '').trim().toLowerCase();
          const found = q ? tasks.filter((t) => t.title.toLowerCase().includes(q)) : [];
          if (found.length === 0) {
            this.push(`Không tìm thấy việc cần làm "${res.query ?? ''}".`);
            return;
          }
          if (found.length > 1) {
            this.push(`Có ${found.length} việc khớp:\n${this.listMsg(found)}\nBạn nói rõ hơn nhé.`);
            return;
          }
          this.push(res.reply);
          this.pending.set({ kind: 'completeTask', task: found[0], completed: res.completed ?? true });
          return;
        }

        if (res.intent === 'create_note') {
          if (!res.noteTitle && !res.noteContent) {
            this.push('Bạn muốn ghi chú nội dung gì?');
            return;
          }
          this.push(res.reply);
          this.pending.set({ kind: 'createNote', title: res.noteTitle ?? '', content: res.noteContent ?? '' });
          return;
        }

        if (res.intent === 'search_notes' || res.intent === 'delete_note') {
          const q = (res.query ?? '').trim().toLowerCase();
          this.notesApi.list().subscribe({
            next: (notes) => {
              const found = q ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) : notes;
              if (res.intent === 'search_notes') {
                if (found.length === 0) {
                  this.push(`${res.reply}\n(Không tìm thấy ghi chú nào.)`);
                  return;
                }
                const list = found.slice(0, 8).map((n) => `• ${n.title || '(không tiêu đề)'} — ${n.content.slice(0, 40)}`).join('\n');
                this.push(`${res.reply}\n${list}`);
                return;
              }
              // delete_note
              if (found.length === 0) {
                this.push(`Không tìm thấy ghi chú "${res.query ?? ''}".`);
                return;
              }
              if (found.length > 1) {
                this.push(`Có ${found.length} ghi chú khớp, bạn nói rõ hơn nhé.`);
                return;
              }
              this.push(res.reply);
              this.pending.set({ kind: 'deleteNote', note: found[0] });
            },
            error: () => this.push('Không tải được danh sách ghi chú.'),
          });
          return;
        }

        if (res.intent === 'create_group') {
          if (!res.groupName?.trim()) {
            this.push('Bạn muốn đặt tên nhóm là gì?');
            return;
          }
          this.push(res.reply);
          this.pending.set({ kind: 'createGroup', name: res.groupName.trim() });
          return;
        }

        if (res.intent === 'join_group') {
          if (!res.groupCode?.trim()) {
            this.push('Bạn có mã tham gia nhóm không?');
            return;
          }
          this.push(res.reply);
          this.pending.set({ kind: 'joinGroup', code: res.groupCode.trim() });
          return;
        }

        if (res.intent === 'invite_group_member' || res.intent === 'create_group_event') {
          const gq = (res.groupQuery ?? '').trim().toLowerCase();
          const groups = gq ? this.groupsState.groups().filter((g) => g.name.toLowerCase().includes(gq)) : [];
          if (groups.length === 0) {
            this.push(`Không tìm thấy nhóm "${res.groupQuery ?? ''}".`);
            return;
          }
          if (groups.length > 1) {
            this.push(`Có ${groups.length} nhóm khớp: ${groups.map((g) => g.name).join(', ')}. Bạn nói rõ hơn nhé.`);
            return;
          }
          const g = groups[0];
          if (res.intent === 'invite_group_member') {
            const emails = (res.guestEmails ?? []).map((e) => e.trim()).filter((e) => e.includes('@'));
            if (emails.length === 0) {
              this.push('Bạn muốn mời email nào vào nhóm?');
              return;
            }
            this.push(res.reply);
            this.pending.set({ kind: 'inviteGroupMember', group: g, emails });
          } else {
            if (!res.title || !res.startTime || !res.endTime) {
              this.push('Bạn muốn tạo sự kiện gì, lúc mấy giờ?');
              return;
            }
            this.push(res.reply);
            this.pending.set({ kind: 'createGroupEvent', group: g, title: res.title, start: new Date(res.startTime), end: new Date(res.endTime), withMeet: !!res.withMeet });
          }
          return;
        }

        if (res.intent === 'change_setting') {
          const key = res.settingKey;
          const value = res.settingValue?.trim();
          if (!key || !value) {
            this.push(res.reply || 'Bạn muốn đổi cài đặt nào?');
            return;
          }
          if (key === 'accent_color' && !ACCENT_PRESETS.some((p) => p.id === value)) {
            this.push(`App chưa có màu "${value}". Các màu có sẵn: ${ACCENT_PRESETS.map((p) => p.id).join(', ')}.`);
            return;
          }
          if ((key === 'theme_mode' && !['light', 'dark', 'system'].includes(value)) || (key === 'language' && !['vi', 'en'].includes(value))) {
            this.push(res.reply || 'Mình chưa hiểu giá trị bạn muốn đổi.');
            return;
          }
          const label = key === 'theme_mode' || key === 'language' ? this.tr.t(`ai.settingValue.${value}`) : (ACCENT_PRESETS.find((p) => p.id === value)?.name ?? value);
          this.push(res.reply);
          this.pending.set({ kind: 'changeSetting', settingKey: key, settingValue: value, label });
          return;
        }

        if (res.intent === 'export_calendar') {
          if (res.exportFormat !== 'pdf' && res.exportFormat !== 'ics') {
            this.push(res.reply || 'Bạn muốn xuất định dạng PDF hay ICS?');
            return;
          }
          // Không phá huỷ gì (chỉ tải file về máy) -> thực thi luôn, không cần bấm Xác nhận.
          this.push(res.reply);
          if (res.exportFormat === 'ics') {
            this.icsSvc.exportToFile(this.state.events());
            this.push(`${this.tr.t('ai.msg.created')} file .ics ✅`);
          } else {
            this.pdfSvc.exportToFile(this.state.events())
              .then(() => this.push(`${this.tr.t('ai.msg.created')} file PDF ✅`))
              .catch(() => this.push('Xuất PDF thất bại.'));
          }
          return;
        }

        this.push(res.reply);
      },
      error: () => {
        this.loading.set(false);
        this.push(this.tr.t('ai.msg.error'));
      },
    });
  }

  confirm(): void {
    const p = this.pending();
    if (!p) return;
    if (p.kind === 'create') {
      this.state.saveEvent(
        {
          kind: p.eventKind,
          title: p.title,
          description: undefined,
          location: undefined,
          start: p.start,
          end: p.end,
          isAllDay: false,
          // Vừa tạo vừa mời: gắn khách ngay lúc tạo -> backend tự thêm attendee + gửi email mời.
          guests: p.emails.map((email) => ({ email, status: 'needsAction' as const })),
          color: 'sky',
        },
        undefined,
        // Sau khi lưu xong mới có id thật -> nếu người dùng muốn kèm Meet thì tạo phòng luôn.
        // createMeetForEvent tự lo việc xin quyền Google nếu chưa cấp (chuyển hướng rồi tạo tiếp).
        p.withMeet
          ? (event) => {
              this.push(this.tr.t('ai.msg.creatingMeet'));
              void this.state.createMeetForEvent(event.id);
            }
          : undefined,
      );
      this.push(`${this.tr.t('ai.msg.created')} "${p.title}" ✅`);
    } else if (p.kind === 'plan') {
      for (const slot of p.slots) {
        this.state.saveEvent({
          kind: 'event',
          title: p.title,
          description: undefined,
          location: undefined,
          start: slot.start,
          end: slot.end,
          isAllDay: false,
          guests: [],
          color: 'emerald',
        });
      }
      this.push(`${this.tr.t('ai.msg.addedSessions')} ${p.slots.length} ${this.tr.t('ai.msg.sessions')} "${p.title}" ✅`);
    } else if (p.kind === 'reschedule') {
      this.state.updateEventTimes({ ...p.event, start: p.start, end: p.end });
      this.push(`${this.tr.t('ai.msg.moved')} "${p.event.title}" ✅`);
    } else if (p.kind === 'invite') {
      // Gộp khách cũ + khách mới rồi lưu -> backend tự thêm attendee + gửi email mời.
      const merged = [
        ...p.event.guests,
        ...p.emails.map((email) => ({ email, status: 'needsAction' as const })),
      ];
      this.state.saveEvent({ ...p.event, guests: merged });
      this.push(`${this.tr.t('ai.msg.invited')} ${p.emails.join(', ')} → "${p.event.title}" ✅`);
    } else if (p.kind === 'delete') {
      this.state.deleteEvent(p.event.id);
      this.push(`${this.tr.t('ai.msg.deleted')} "${p.event.title}" ✅`);
    } else if (p.kind === 'completeTask') {
      this.state.setTaskCompleted(p.task.id, p.completed);
      this.push(`${this.tr.t('ai.msg.taskUpdated')}: "${p.task.title}" ✅`);
    } else if (p.kind === 'createNote') {
      this.notesApi.create({ title: p.title, content: p.content }).subscribe({
        next: () => this.push(`${this.tr.t('ai.msg.created')} "${p.title || p.content}" ✅`),
        error: () => this.push('Tạo ghi chú thất bại.'),
      });
    } else if (p.kind === 'deleteNote') {
      this.notesApi.remove(p.note.id).subscribe({
        next: () => this.push(`${this.tr.t('ai.msg.noteDeleted')} "${p.note.title || p.note.content}" ✅`),
        error: () => this.push('Xóa ghi chú thất bại.'),
      });
    } else if (p.kind === 'createGroup') {
      this.groupsState.createGroup(p.name);
      this.push(`${this.tr.t('ai.msg.created')} "${p.name}" ✅`);
    } else if (p.kind === 'joinGroup') {
      this.groupsState.joinByCode(p.code);
      this.push(`${this.tr.t('ai.msg.joinedGroup')} ✅`);
    } else if (p.kind === 'inviteGroupMember') {
      for (const email of p.emails) this.groupsState.invite(p.group.id, email);
      this.push(`${this.tr.t('ai.msg.invited')} ${p.emails.join(', ')} → "${p.group.name}" ✅`);
    } else if (p.kind === 'createGroupEvent') {
      this.groupsState.createGroupEvent(p.group.id, {
        kind: 'event',
        title: p.title,
        description: undefined,
        location: undefined,
        start: p.start,
        end: p.end,
        isAllDay: false,
        guests: [],
        color: 'sky',
      });
      this.push(`${this.tr.t('ai.msg.created')} "${p.title}" (${p.group.name}) ✅`);
    } else if (p.kind === 'changeSetting') {
      if (p.settingKey === 'theme_mode') {
        this.themeSvc.setMode(p.settingValue as ThemeMode);
      } else if (p.settingKey === 'language') {
        void this.settingsSvc.update({ language: p.settingValue as 'vi' | 'en' });
      } else {
        this.themeBuilder.setPreset(p.settingValue);
      }
      this.push(`${this.tr.t('ai.msg.settingChanged')}: ${this.tr.t(`ai.settingKey.${p.settingKey}`)} → ${p.label} ✅`);
    }
    this.pending.set(null);
  }

  cancel(): void {
    this.pending.set(null);
    this.push(this.tr.t('ai.msg.cancelled'));
  }

  /**
   * Nhãn ngày giờ của 1 sự kiện khi liệt kê trong chat.
   * Sự kiện CẢ NGÀY thì ghi "Cả ngày" thay vì "00:00 – 00:00" (vô nghĩa với người đọc);
   * cả ngày mà kéo dài nhiều ngày thì ghi luôn khoảng "ngày đầu → ngày cuối".
   */
  eventLabel(e: CalendarEvent): string {
    if (!e.isAllDay) return this.rangeLabel(e.start, e.end);
    const d = (x: Date) => x.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
    const sameDay =
      e.start.getFullYear() === e.end.getFullYear() &&
      e.start.getMonth() === e.end.getMonth() &&
      e.start.getDate() === e.end.getDate();
    const when = sameDay ? d(e.start) : `${d(e.start)} → ${d(e.end)}`;
    return `${when} · ${this.tr.t('common.allDay')}`;
  }

  rangeLabel(start: Date, end: Date): string {
    const date = start.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
    const t = (x: Date) => x.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${t(start)} – ${t(end)}`;
  }
}
