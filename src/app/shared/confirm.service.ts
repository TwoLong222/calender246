// ConfirmService: hộp thoại "Bạn chắc chắn muốn xóa?" dùng CHUNG cho cả app.
//
// Cách dùng trong component bất kỳ:
//   if (await this.confirm.ask({ message: 'Xóa mục này?' })) { ...xóa... }
//
// Hộp thoại được vẽ 1 lần duy nhất ở app.html (<app-confirm-dialog />), nên mọi
// nơi gọi ask() đều dùng chung 1 popup — không phải tự viết lại ở từng chỗ.

import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  /** Câu hỏi chính, vd "Xóa sự kiện này?" */
  message: string;
  /** Dòng mô tả thêm (tuỳ chọn), vd "Hành động này không thể hoàn tác." */
  detail?: string;
  /** Nhãn nút xác nhận; để trống = "Xóa". */
  confirmText?: string;
  /** true (mặc định) = nút đỏ (hành động xoá/nguy hiểm). */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  /** null = đang không hỏi gì. */
  readonly pending = signal<PendingConfirm | null>(null);

  /** Mở hộp thoại, trả về true nếu người dùng bấm xác nhận. */
  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pending.set({ danger: true, ...options, resolve });
    });
  }

  /** Người dùng chọn xong -> đóng hộp thoại và trả kết quả cho nơi gọi. */
  answer(ok: boolean): void {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(ok);
  }
}
