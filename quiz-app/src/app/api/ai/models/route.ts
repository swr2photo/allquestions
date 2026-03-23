import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await res.json();

    // Filter to show relevant info
    const models = (data.models || []).map(
      (m: {
        name: string;
        displayName: string;
        description: string;
        supportedGenerationMethods: string[];
      }) => ({
        id: m.name?.replace("models/", ""),
        displayName: m.displayName,
        description: m.description?.slice(0, 100),
        methods: m.supportedGenerationMethods,
      })
    );

    // Highlight image-capable models
    const imageModels = models.filter(
      (m: { description?: string; displayName?: string; id?: string }) =>
        m.description?.toLowerCase().includes("image") ||
        m.displayName?.toLowerCase().includes("image") ||
        m.id?.includes("image") ||
        m.id?.includes("imagen")
    );

    return NextResponse.json({ total: models.length, imageModels, allModels: models });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
