// Helper function to return JSON responses
const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // 1. Authentication check
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== `Bearer ${env.API_KEY}`) {
            return jsonResponse({ error: "Unauthorized: Invalid API Key" }, 401);
        }

        // 2. Route validation
        if (request.method !== "POST" || url.pathname !== "/") {
            return jsonResponse({ error: "Method Not Allowed. Use POST /" }, 405);
        }

        try {
            const contentType = request.headers.get("Content-Type") || "";

            // 3. Routing based on Content-Type
            if (contentType.includes("multipart/form-data")) {
                // If it's a file upload, route to Image-to-Image editor
                return await this.handleEditImage(request, env);
            } else {
                // If it's normal JSON text, route to Text-to-Image generator
                return await this.handleGenerateImage(request, env);
            }
        } catch (err) {
            return jsonResponse({ error: "Internal Server Error", details: err.message }, 500);
        }
    },

    // Handler: Create Image (Text-to-Image)
    async handleGenerateImage(request, env) {
        const { prompt } = await request.json();

        if (!prompt) {
            return jsonResponse({ error: "Prompt is required in JSON body" }, 400);
        }

        // Model: Stable Diffusion XL Base 1.0
        const model = "@cf/bytedance/stable-diffusion-xl-lightning";
        const result = await env.AI.run(model, { prompt });

        return new Response(result, {
            headers: { "Content-Type": "image/jpeg" },
        });
    },

    // Handler: Edit Image (Image-to-Image)
    async handleEditImage(request, env) {
        const formData = await request.formData();
        const prompt = formData.get("prompt");
        const imageFile = formData.get("image");

        if (!prompt || !imageFile) {
            return jsonResponse({ error: "Both 'prompt' and 'image' are required in FormData" }, 400);
        }

        const imageArrayBuffer = await imageFile.arrayBuffer();
        const imageBytes = [...new Uint8Array(imageArrayBuffer)];

        // Model: Stable Diffusion v1-5 Image-to-Image
        const model = "@cf/runwayml/stable-diffusion-v1-5-img2img";
        const result = await env.AI.run(model, {
            prompt: prompt,
            image: imageBytes,
            // strength: 0.5 // Default strength parameter
        });

        return new Response(result, {
            headers: { "Content-Type": "image/jpeg" },
        });
    }
};
