// Cấu hình môi trường cho Angular — điền giá trị thật lấy từ:
// Supabase Dashboard > Project Settings > Data API (Project URL + anon/public key)
//
// LƯU Ý: anon key được THIẾT KẾ để lộ ra ở phía client (trình duyệt) — nó an toàn vì
// mọi quyền truy cập dữ liệu qua key này đều bị chặn bởi RLS. Đây KHÔNG phải secret
// như service_role key. Vẫn nên tránh commit thẳng giá trị thật lên repo public để gọn gàng,
// nhưng không phải rủi ro bảo mật nghiêm trọng như service_role key.

export const environment = {
  production: false,
  supabaseUrl: 'https://rjkkoujpfvlnzmmgecsl.supabase.co',
  supabaseAnonKey: 'sb_publishable_Ilm9VJqq74pBrOQmbl26SA_fvUtPL0A',
  /** Base URL của NestJS backend. Dùng đường TƯƠNG ĐỐI '/api' + proxy của Angular
   *  (proxy.conf.json) -> request đi CÙNG origin với trang web nên:
   *   - Không dính CORS (kể cả khi mở từ máy khác trong mạng LAN).
   *   - Không cần sửa gì khi đổi máy: ai mở http://<ip>:4200 cũng chạy.
   *  Socket.io cũng tự nối cùng origin (realtime.service dùng origin rỗng). */
  apiUrl: '/api',
};
