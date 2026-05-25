export default {
    async fetch(request, env) {
        const API_KEY = env.API_KEY;
        const url = new URL(request.url);
        const auth = request.headers.get("Authorization");

        // 🔐 Kiểm tra API key
        if (auth !== `Bearer ${API_KEY}`) {
            return json({ error: "Unauthorized" }, 401);
        }

        // 🚫 Chỉ cho phép POST request
        if (request.method !== "POST" || url.pathname !== "/") {
            return json({ error: "Not allowed" }, 405);
        }

        try {
            const contentType = request.headers.get("Content-Type") || "";

            // NẾU LÀ REQUET CÓ ĐÍNH KÈM FILE (DÙNG ĐỂ EDIT ẢNH)
            if (contentType.includes("multipart/form-data")) {
                const formData = await request.formData();
                const prompt = formData.get("prompt");
                const imageFile = formData.get("image"); // Lấy file ảnh đính kèm

                if (!prompt || !imageFile) {
                    return json({ error: "Vui lòng cung cấp cả prompt và image để edit" }, 400);
                }

                // Chuyển file ảnh thành mảng byte để AI đọc được
                const imageArrayBuffer = await imageFile.arrayBuffer();
                const imageBytes = [...new Uint8Array(imageArrayBuffer)];

                // 🧠 Edit ảnh bằng model img2img
                const result = await env.AI.run(
                    "@cf/runwayml/stable-diffusion-v1-5-img2img",
                    {
                        prompt: prompt,
                        image: imageBytes,
                        // strength: 0.5 // Bạn có thể thêm tuỳ chọn độ mạnh của hiệu ứng (0 đến 1)
                    }
                );

                return new Response(result, {
                    headers: { "Content-Type": "image/jpeg" },
                });
            } 
            // NẾU LÀ REQUEST JSON BÌNH THƯỜNG (DÙNG ĐỂ TẠO ẢNH MỚI)
            else {
                const { prompt } = await request.json();

                if (!prompt) return json({ error: "Prompt is required" }, 400);

                // 🧠 Tạo ảnh mới
                const result = await env.AI.run(
                    "@cf/stabilityai/stable-diffusion-xl-base-1.0",
                    { prompt }
                );

                return new Response(result, {
                    headers: { "Content-Type": "image/jpeg" },
                });
            }
        } catch (err) {
            return json({ error: "Failed to process image", details: err.message }, 500);
        }
    },
};

// 📦 Function trả về JSON
function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
