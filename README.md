# Microservice: AI Image Generation API

Chào mừng đến với hệ thống API tạo và chỉnh sửa ảnh bằng AI, chạy độc lập trên kiến trúc Serverless của **Cloudflare Workers**. 

Dự án này đóng vai trò là một Microservice (dịch vụ vệ tinh) phục vụ trực tiếp cho nền tảng chính **AI Video Platform** (`AIVideoPaltfom`). Nền tảng video chính (chạy backend Laravel) sẽ gọi gọi sang API này để tạo các ảnh nền, avatar, hoặc ảnh đầu vào (input) trước khi đưa vào luồng render AI Video.

## 🚀 Tính năng
- **Tạo ảnh từ Text (Text-to-Image):** Sử dụng model cực nhanh `stable-diffusion-xl-lightning` giúp sinh ảnh tức thì với chi phí tối ưu nhất (tiết kiệm Neurons).
- **Chỉnh sửa ảnh (Image-to-Image):** Sử dụng model `stable-diffusion-v1-5-img2img` để biến đổi phong cách hoặc áp dụng prompt lên một bức ảnh gốc do user tải lên.
- **Bảo mật & Tối ưu:** 
  - Tích hợp chuẩn `CORS` để có thể gọi an toàn từ frontend React/Vue hoặc gọi nội bộ từ hệ thống Laravel backend.
  - Xác thực bằng `API_KEY` (gửi qua Header `Authorization`).
  - Chặn đứng các file rác quá 5MB để bảo vệ giới hạn RAM 128MB của Cloudflare Worker.

## 🛠 Cách hệ thống hoạt động cùng AI Video Platform
1. Backend Laravel (hoặc Frontend Dashboard) gửi request HTTP POST đến endpoint của Worker này.
2. Worker nhận tín hiệu, xác thực API_KEY.
3. Chuyển tiếp lệnh sinh ảnh tới GPU của Cloudflare (Workers AI).
4. Worker trả thẳng file nhị phân (`image/jpeg`) về cho Backend.
5. Backend Laravel có thể upload ảnh này lên hệ thống lưu trữ **Cloudflare R2** của dự án để đồng bộ Asset Path.

## 💻 Hướng dẫn Test API (Dùng cURL)

### 1. Tạo ảnh mới (Gửi JSON)
```bash
curl -X POST https://image-generation.[tên-miền-của-bạn].workers.dev \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A cute robot cooking breakfast, cyberpunk style"}' \
  --output result_image.jpg
```

### 2. Edit ảnh (Gửi FormData)
```bash
curl -X POST https://image-generation.[tên-miền-của-bạn].workers.dev \
  -H "Authorization: Bearer <API_KEY>" \
  -F "prompt=make it look like a cyberpunk city, neon lights" \
  -F "image=@/path/to/your/local_image.jpg" \
  --output edited_image.jpg
```

## ⚙️ Hướng dẫn Deploy

Dự án đang được thiết lập quy trình CI/CD qua GitHub.
Để cập nhật code:
1. Bạn mở terminal tại thư mục này, chuyển sang nhánh `backend`.
2. Gõ lệnh:
   ```bash
   git add .
   git commit -m "Update code"
   git push origin backend
   ```
3. Cloudflare sẽ **tự động Deploy** ngay khi nhánh `backend` có code mới (vì Branch control đã được cấu hình chọn nhánh backend làm Production).

*(Nếu muốn deploy nhanh bằng tay, bạn có thể chạy skill `.opencode/skills/deploy.sh` hoặc gõ trực tiếp `npx wrangler deploy`).*