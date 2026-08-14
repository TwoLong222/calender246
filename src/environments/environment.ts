// Cấu hình môi trường cho Angular — điền giá trị thật lấy từ:
// Supabase Dashboard > Project Settings > Data API (Project URL + anon/public key)
//
// LƯU Ý: anon key được THIẾT KẾ để lộ ra ở phía client (trình duyệt) — nó an toàn vì
// mọi quyền truy cập dữ liệu qua key này đều bị chặn bởi RLS. Đây KHÔNG phải secret
// như service_role key. Vẫn nên tránh commit thẳng giá trị thật lên repo public để gọn gàng,
// nhưng không phải rủi ro bảo mật nghiêm trọng như service_role key.

export const environment = {
  production: false,
  supabaseUrl: 'https://elpvpflgssbqrasmmdtk.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscHZwZmxnc3NicXJhc21tZHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTgxMjksImV4cCI6MjEwMTA3NDEyOX0.sG9j9dWITsbadZEsQKHKbt9z-U0V-X6m5VV2LCQe7xs',
  /** Base URL của NestJS backend — dùng để interceptor biết request nào cần gắn kèm token */
  apiUrl: 'http://localhost:3000/api',
};
