// CORS Headers for allowing web applications to call this API
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to return JSON responses with CORS
const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders
        },
    });
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // 1. Handle CORS Preflight (OPTIONS request)
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // 2. Route validation
        if (request.method !== "POST" || url.pathname !== "/") {
            return jsonResponse({ error: "Method Not Allowed. Use POST /" }, 405);
        }

        // 3. Authentication check
        const authHeader = request.headers.get("Authorization");
        const expectedAuth = `Bearer ${env.API_KEY}`;
        // Prevent timing attacks if possible, otherwise simple check
        if (!authHeader || authHeader !== expectedAuth) {
            return jsonResponse({ error: "Unauthorized: Invalid API Key" }, 401);
        }

        try {
            const contentType = request.headers.get("Content-Type") || "";

            // 4. Routing based on Content-Type
            if (contentType.includes("multipart/form-data")) {
                return await this.handleEditImage(request, env);
            } else {
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

        const model = "@cf/bytedance/stable-diffusion-xl-lightning";
        const result = await env.AI.run(model, { prompt });

        return new Response(result, {
            headers: { 
                "Content-Type": "image/jpeg",
                ...corsHeaders
            },
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

        // 5. Security: Validate file size (e.g. max 5MB) to prevent Worker memory crash
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        if (imageFile.size > MAX_SIZE) {
            return jsonResponse({ error: "Image size exceeds 5MB limit" }, 413);
        }

        const imageArrayBuffer = await imageFile.arrayBuffer();
        const imageBytes = [...new Uint8Array(imageArrayBuffer)];

        const model = "@cf/runwayml/stable-diffusion-v1-5-img2img";
        const result = await env.AI.run(model, {
            prompt: prompt,
            image: imageBytes,
        });

        return new Response(result, {
            headers: { 
                "Content-Type": "image/jpeg",
                ...corsHeaders
            },
        });
    }
};
