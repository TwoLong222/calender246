import { Component, effect, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeService } from './theme.service';
import { ThemeBuilderService } from './theme/theme-builder.service';
import { SupabaseService } from './auth/supabase.service';
import { SettingsService } from './settings/settings.service';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'web';
  // Khởi tạo theme ngay khi mở app (áp dụng cho cả trang đăng nhập)
  private readonly theme = inject(ThemeService);
  // Áp màu nhấn tùy chỉnh đã lưu (constructor tự đọc localStorage + set biến CSS)
  private readonly themeBuilder = inject(ThemeBuilderService);
  private readonly supabase = inject(SupabaseService);
  private readonly settings = inject(SettingsService);

  constructor() {
    // Đăng nhập -> tải settings (áp dụng theme + default view). Đăng xuất -> về mặc định.
    let lastUserId: string | null = null;
    effect(() => {
      const user = this.supabase.user();
      if (user && user.id !== lastUserId) {
        lastUserId = user.id;
        void this.settings.load();
      } else if (!user && lastUserId) {
        lastUserId = null;
        this.settings.reset();
      }
    });
  }
}
