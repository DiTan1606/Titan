# Titan – Cài đặt tài khoản (làm 1 lần)

Những bước này **bạn tự làm**, vì chúng cần đăng nhập vào tài khoản của bạn. Không gửi mật khẩu, client secret hay API key qua chat: dán thẳng vào file hoặc trang cấu hình như hướng dẫn.

---

## 1. GitHub CLI (để tạo 2 repo và push code)

Chạy trong Terminal, chọn **GitHub.com → HTTPS → Login with a web browser**:

```bash
gh auth login
```

Xong thì báo mình, mình sẽ tạo `Titan-workspace` (private) và `Titan` rồi push.

## 2. Supabase CLI (để nối với project trên cloud)

```bash
supabase login
```

Sau đó vào [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**:
- Name: `titan`
- Region: **Southeast Asia (Singapore)** (gần Việt Nam nhất)
- Database password: tự đặt, **lưu vào trình quản lý mật khẩu** của bạn

Gửi mình **Project ref** (chuỗi trong URL `https://supabase.com/dashboard/project/<project-ref>`). Ref không phải bí mật.

## 3. Google OAuth (đăng nhập bằng Google)

Vào [console.cloud.google.com](https://console.cloud.google.com):

1. Tạo project mới tên **Titan**.
2. **APIs & Services → OAuth consent screen**: chọn **External**, App name `Titan`, điền email hỗ trợ. Ở mục **Test users**, thêm email Google bạn dùng để đăng nhập.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, Name: `Titan`
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - (thêm link Vercel sau khi deploy)
   - **Authorized redirect URIs**:
     - `http://127.0.0.1:54321/auth/v1/callback` (Supabase local)
     - `https://<project-ref>.supabase.co/auth/v1/callback` (Supabase cloud)
4. Copy **Client ID** và **Client secret**:
   - **Local:** dán vào file `supabase/.env` (file này không bị commit):
     ```
     SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
     SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
     ```
   - **Cloud:** Supabase Dashboard → **Authentication → Sign In / Providers → Google** → bật, dán Client ID và secret.

## 4. Anthropic API key (AI phân loại danh mục)

1. Vào [platform.claude.com](https://platform.claude.com), nạp một ít credit.
2. **API Keys → Create key**, đặt tên `titan`.
3. **Không dán key vào chat.** Khi tới Ngày 3, mình sẽ đưa lệnh để bạn tự chạy:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=<key-của-bạn>
   ```

## 5. Vercel (host frontend)

1. Vào [vercel.com](https://vercel.com), **đăng nhập bằng GitHub**.
2. Đợi mình tạo repo xong → **Add New → Project → Import `Titan-workspace`**:
   - Root Directory: `apps/web`
   - Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (lấy ở Supabase Dashboard → **Project Settings → API Keys**, là khóa *publishable*, công khai được)
3. Deploy → gửi mình link `*.vercel.app`, rồi thêm link này vào Google OAuth (bước 3) và Supabase (**Authentication → URL Configuration**: Site URL + Redirect URLs).

## 6. SMS Banking VCB

Đăng ký tại quầy, hoặc trên VCB Digibank nếu có. Khi có SMS, gửi mình vài mẫu **đã che số tài khoản**.
