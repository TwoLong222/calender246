# Hướng dẫn deploy lên https công khai

App gồm 3 phần. Cách deploy miễn phí, khuyến nghị:

| Phần | Deploy ở đâu (free) | Ghi chú |
|---|---|---|
| **Frontend** (Angular) | **Vercel** | tĩnh, nhanh, đã có sẵn `vercel.json` |
| **Backend** (NestJS) | **Render** | Node + WebSocket, đã có sẵn `render.yaml` |
| **Database/Auth** | **Supabase** | đã sẵn trên cloud, không cần deploy |

> Điều kiện: code đã đẩy lên GitHub (đã có `hoangcuongquoc/calender246` và `hoangcuongquoc/calenderwebbapp246-be`).

---

## Bước 1 — Deploy BACKEND lên Render

1. Vào https://dashboard.render.com → đăng nhập bằng GitHub.
2. **New → Blueprint** → chọn repo backend (`calenderwebbapp246-be`). Render đọc `render.yaml` sẵn có.
3. Điền các biến môi trường (mục **Environment**), lấy giá trị GIỐNG file `.env` đang chạy local:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (email Foresight)
   - `CORS_ORIGIN` → **để trống tạm**, điền ở Bước 3 sau khi có domain frontend
   - `PUBLIC_API_URL` → điền sau khi biết URL backend (dạng `https://<tên>.onrender.com/api`)
4. Bấm **Apply / Deploy**. Đợi build xong → Render cho URL, vd `https://lich-backend.onrender.com`.
5. Kiểm tra: mở `https://lich-backend.onrender.com/api/mail/test?to=email-của-bạn@gmail.com` (lần đầu chờ ~30-50s vì gói free ngủ dậy).

---

## Bước 2 — Trỏ frontend tới backend & deploy lên Vercel

1. Sửa file `src/environments/environment.prod.ts`, đổi `apiUrl` thành URL backend Bước 1 **kèm `/api`**:
   ```ts
   apiUrl: 'https://lich-backend.onrender.com/api',
   ```
   Commit + push.
2. Vào https://vercel.com → đăng nhập GitHub → **Add New → Project** → chọn repo `calender246`.
3. Vercel tự nhận Angular; đã có `vercel.json` nên build command / output đã đúng. Bấm **Deploy**.
4. Xong → Vercel cho URL, vd `https://calender246.vercel.app`.

---

## Bước 3 — Nối CORS + OAuth cho domain thật

1. **Render** (backend) → Environment → đặt:
   ```
   CORS_ORIGIN = https://calender246.vercel.app
   PUBLIC_API_URL = https://lich-backend.onrender.com/api
   ```
   → **Save**, Render tự deploy lại.
2. **Supabase** → Authentication → **URL Configuration**:
   - **Site URL**: `https://calender246.vercel.app`
   - **Redirect URLs**: thêm `https://calender246.vercel.app/**`
3. **Google Cloud Console** → OAuth client: **Authorized redirect URIs** giữ nguyên
   `https://<project>.supabase.co/auth/v1/callback` (không đổi — Supabase lo phần này).

---

## Bước 4 — Chạy migration (nếu chưa)

Vào **Supabase → SQL Editor**, chạy các file trong `calenderwebbapp246-be/migrations/` chưa chạy
(đặc biệt `phase11` nhắc email chủ sự kiện, `phase12` lời mời nhóm cần đồng ý).

---

## Kiểm tra cuối

Mở `https://calender246.vercel.app` (tab ẩn danh) → đăng nhập Google → dùng thử: tạo sự kiện,
chat nhóm (2 tài khoản), nhận email. Xong! 🎉

## Lưu ý
- **Render free ngủ dậy chậm**: request đầu sau thời gian rảnh chờ ~30-50s. Muốn luôn thức thì nâng gói trả phí.
- **Đổi domain**: mỗi lần đổi URL frontend/backend phải cập nhật lại `CORS_ORIGIN`, `apiUrl`, và Redirect URLs Supabase cho khớp.
- **Bí mật**: `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, `GEMINI_API_KEY` chỉ đặt ở Environment của Render — KHÔNG commit lên git.
