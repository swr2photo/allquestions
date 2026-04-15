import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionInfo, isValidSession } from "@/lib/admin-store";
import { kv } from "@/lib/kv";

export interface MemoryItem {
  id: string;
  content: string;
  createdAt: number;
  source?: string; // "auto" | "manual"
}

function memoryKey(email: string) {
  return `ai_memories:${email}`;
}

async function loadMemories(email: string): Promise<MemoryItem[]> {
  const raw = await kv.get(memoryKey(email));
  if (!raw) return [];
  // kv.get may return already-parsed object or a JSON string
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw as MemoryItem[] : [];
}

// GET — list all memories for current user
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ memories: [] });
  }
  const user = getSessionInfo(token);
  if (!user) return NextResponse.json({ memories: [] });

  try {
    const memories = await loadMemories(user.email);
    return NextResponse.json({ memories });
  } catch {
    return NextResponse.json({ memories: [] });
  }
}

// POST — add a new memory (or bulk from AI)
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = getSessionInfo(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { content, source } = body as { content: string; source?: string };

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "Empty content" }, { status: 400 });
    }
    if (content.length > 500) {
      return NextResponse.json({ error: "Memory too long (max 500 chars)" }, { status: 400 });
    }

    const memories = await loadMemories(user.email);

    // Limit to 50 memories per user
    if (memories.length >= 50) {
      return NextResponse.json({ error: "Memory limit reached (max 50)" }, { status: 400 });
    }

    // Check for duplicate content
    const isDuplicate = memories.some(m => m.content.toLowerCase().trim() === content.toLowerCase().trim());
    if (isDuplicate) {
      return NextResponse.json({ error: "Duplicate memory" }, { status: 409 });
    }

    const newMemory: MemoryItem = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content: content.trim(),
      createdAt: Date.now(),
      source: source || "manual",
    };

    memories.unshift(newMemory);
    await kv.set(memoryKey(user.email), JSON.stringify(memories));

    return NextResponse.json({ memory: newMemory });
  } catch (err) {
    console.error("[Memory Save Error]", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

// DELETE — remove a memory by id, or clear all
export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = getSessionInfo(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("all") === "true";

    if (clearAll) {
      await kv.set(memoryKey(user.email), JSON.stringify([]));
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const memories = await loadMemories(user.email);
    const filtered = memories.filter(m => m.id !== id);

    if (filtered.length === memories.length) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    await kv.set(memoryKey(user.email), JSON.stringify(filtered));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Memory Delete Error]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

// PATCH — update a memory's content
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = getSessionInfo(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, content } = body as { id: string; content: string };

    if (!id || !content || content.trim().length === 0) {
      return NextResponse.json({ error: "Missing id or content" }, { status: 400 });
    }

    const memories = await loadMemories(user.email);
    const idx = memories.findIndex(m => m.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    memories[idx].content = content.trim();
    await kv.set(memoryKey(user.email), JSON.stringify(memories));

    return NextResponse.json({ memory: memories[idx] });
  } catch (err) {
    console.error("[Memory Update Error]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
