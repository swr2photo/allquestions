import { createClient } from "@vercel/kv";

const url = process.env.allquiz_KV_REST_API_URL || process.env.KV_REST_API_URL || "";
const token = process.env.allquiz_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || "";

if (!url || !token) {
  console.warn("KV_REST_API_URL or KV_REST_API_TOKEN is missing. Please ensure your Vercel KV environment variables are configured correctly.");
}

export const kv = createClient({
  url,
  token,
});
