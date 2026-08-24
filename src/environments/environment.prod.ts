// Cấu hình PRODUCTION — dùng khi build `ng build` (configuration production).
// angular.json đã khai báo fileReplacements: khi build prod sẽ thay environment.ts bằng file này.
//
// ⚠️ TRƯỚC KHI DEPLOY: đổi `apiUrl` bên dưới thành URL BACKEND thật (đã deploy, có https),
// KÈM hậu tố /api. Ví dụ: 'https://lich-backend.onrender.com/api'
//
// LƯU Ý: supabaseAnonKey (publishable key) được THIẾT KẾ để lộ ra client -> an toàn khi commit.
// Socket.io realtime tự nối tới origin của apiUrl (bỏ /api) nên chỉ cần đặt đúng apiUrl là đủ.

export const environment = {
  production: true,
  supabaseUrl: 'https://rjkkoujpfvlnzmmgecsl.supabase.co',
  supabaseAnonKey: 'sb_publishable_Ilm9VJqq74pBrOQmbl26SA_fvUtPL0A',
  // URL backend thật đã deploy trên Render (đã xác nhận chạy).
  apiUrl: 'https://lich-backend.onrender.com/api',
};
