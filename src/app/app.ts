import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeService } from './theme.service';

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
}
