// CORS Headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const jsonResponse = (data, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
    });

// Model registry — maps daemon model IDs to Cloudflare AI model IDs
const MODEL_MAP = {
    // Bytedance
    "cf-sdxl-lightning": "@cf/bytedance/stable-diffusion-xl-lightning",
    "cf-sd-img2img": "@cf/runwayml/stable-diffusion-v1-5-img2img",
    // Black Forest Labs (FLUX)
    "cf-flux-2-klein": "@cf/black-forest-labs/flux-2-klein-9b",
    // Lykon
    "cf-dreamshaper": "@cf/lykon/dreamshaper-8-lcm",
    // Leonardo.Ai
    "cf-phoenix-1.0": "@cf/leonardo/phoenix-1.0",
    "cf-lucid-origin": "@cf/leonardo/lucid-origin",
};

function isFlux(modelId) {
    return modelId.startsWith("@cf/black-forest-labs/");
}

async function generateFlux(env, modelId, prompt, width = 1024, height = 1024) {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("steps", "25");

    const formResponse = new Response(form);
    const result = await env.AI.run(modelId, {
        multipart: {
            body: formResponse.body,
            contentType: formResponse.headers.get("content-type"),
        },
    });

    // Flux returns JSON { image: "base64..." }
    if (typeof result === "object" && result.image) {
        const chars = atob(result.image);
        const bytes = new Uint8Array(chars.length);
        for (let i = 0; i < chars.length; i++) {
            bytes[i] = chars.charCodeAt(i);
        }
        return bytes.buffer;
    }
    throw new Error("Flux returned unexpected format");
}

async function editFlux(env, modelId, prompt, imageBytes, width = 1024, height = 1024) {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("image", new Blob([imageBytes]), "reference.png");
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("steps", "25");

    const formResponse = new Response(form);
    const result = await env.AI.run(modelId, {
        multipart: {
            body: formResponse.body,
            contentType: formResponse.headers.get("content-type"),
        },
    });

    if (typeof result === "object" && result.image) {
        const chars = atob(result.image);
        const bytes = new Uint8Array(chars.length);
        for (let i = 0; i < chars.length; i++) {
            bytes[i] = chars.charCodeAt(i);
        }
        return bytes.buffer;
    }
    throw new Error("Flux edit returned unexpected format");
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== "POST" || url.pathname !== "/") {
            return jsonResponse({ error: "Method Not Allowed. Use POST /" }, 405);
        }

        const authHeader = request.headers.get("Authorization");
        if (env.API_KEY) {
            const expectedAuth = `Bearer ${env.API_KEY}`;
            if (!authHeader || authHeader !== expectedAuth) {
                return jsonResponse({ error: "Unauthorized: Invalid API Key" }, 401);
            }
        }

        try {
            const contentType = request.headers.get("Content-Type") || "";

            if (contentType.includes("multipart/form-data")) {
                return await this.handleEditImage(request, env);
            }
            return await this.handleGenerateImage(request, env);
        } catch (err) {
            return jsonResponse({ error: "Internal Server Error", details: err.message }, 500);
        }
    },

    // T2I: Text-to-Image (JSON body)
    async handleGenerateImage(request, env) {
        const body = await request.json();
        const prompt = body.prompt;
        if (!prompt) {
            return jsonResponse({ error: "Prompt is required in JSON body" }, 400);
        }

        // Resolve model: daemon short name → Cloudflare AI model ID
        const daemonModel = body.model || "cf-sdxl-lightning";
        const modelId = MODEL_MAP[daemonModel] || daemonModel;

        let result;
        if (isFlux(modelId)) {
            result = await generateFlux(env, modelId, prompt, body.width || 1024, body.height || 1024);
        } else {
            result = await env.AI.run(modelId, { prompt });
        }

        return new Response(result, {
            headers: { "Content-Type": "image/jpeg", ...corsHeaders },
        });
    },

    // I2I: Image-to-Image / Edit (multipart/form-data)
    async handleEditImage(request, env) {
        const formData = await request.formData();
        const prompt = formData.get("prompt");
        const imageFile = formData.get("image");
        const daemonModel = formData.get("model") || "cf-sd-img2img";
        const modelId = MODEL_MAP[daemonModel] || daemonModel;

        if (!prompt || !imageFile) {
            return jsonResponse({ error: "Both 'prompt' and 'image' are required" }, 400);
        }

        const MAX_SIZE = 5 * 1024 * 1024;
        if (imageFile.size > MAX_SIZE) {
            return jsonResponse({ error: "Image size exceeds 5MB limit" }, 413);
        }

        const imageArrayBuffer = await imageFile.arrayBuffer();
        const imageBytes = new Uint8Array(imageArrayBuffer);

        let result;
        if (isFlux(modelId)) {
            result = await editFlux(env, modelId, prompt, imageBytes,
                parseInt(formData.get("width") || "1024"),
                parseInt(formData.get("height") || "1024"));
        } else {
            result = await env.AI.run(modelId, {
                prompt: prompt,
                image: [...imageBytes],
            });
        }

        return new Response(result, {
            headers: { "Content-Type": "image/jpeg", ...corsHeaders },
        });
    }
};
