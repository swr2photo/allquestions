import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSession } from "@/lib/admin-store";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

const BASE_URL = "https://notebooklm.google.com";
const BATCH_EXECUTE_PATH = "/_/LabsTailwindUi/data/batchexecute";
const QUERY_PATH = "/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed";
const BUILD_LABEL = "boq_labs-tailwind-frontend_20260108.06_p0";

const RPC_IDS = {
  LIST_NOTEBOOKS: "wXbhsf",
  GET_NOTEBOOK: "rLM1Ne",
};

function getAuthCookies(): string | null {
  try {
    const authPath = path.join(os.homedir(), ".notebooklm-mcp", "auth.json");
    if (!fs.existsSync(authPath)) return null;
    const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
    return data.cookies || null;
  } catch {
    return null;
  }
}

// Initialize session: get CSRF token and session ID from main page
async function initSession(nlmCookies: string): Promise<{ csrfToken: string | null; sessionId: string | null }> {
  // Use redirect: "manual" to detect login redirects
  const res = await fetch(BASE_URL, {
    headers: {
      Cookie: nlmCookies,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "manual",
    cache: "no-store",
  });

  // 302/301 redirect to accounts.google.com means cookies expired
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location") || "";
    if (location.includes("accounts.google.com") || location.includes("ServiceLogin")) {
      throw new Error("AUTH_EXPIRED");
    }
    // Follow the redirect manually
    const res2 = await fetch(location, {
      headers: { Cookie: nlmCookies, "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
      cache: "no-store",
    });
    const html2 = await res2.text();
    if (html2.length < 5000 && (html2.includes("identifier-shown") || html2.includes("<meta http-equiv=\"refresh\""))) {
      throw new Error("AUTH_EXPIRED");
    }
    const csrf2 = html2.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
    const sid2 = html2.match(/"FdrFJe"\s*:\s*"([^"]+)"/);
    return { csrfToken: csrf2?.[1] || null, sessionId: sid2?.[1] || null };
  }

  const html = await res.text();
  // Only treat as expired if the page is a small login/redirect page, not the full app
  // The full app HTML (300k+) contains ServiceLogin references in JS bundles, so don't check that on large pages
  if (html.length < 5000 && (html.includes("identifier-shown") || html.includes("<meta http-equiv=\"refresh\""))) {
    throw new Error("AUTH_EXPIRED");
  }
  const csrfMatch = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
  const sidMatch = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/);
  if (!csrfMatch) {
    throw new Error("AUTH_EXPIRED");
  }
  return {
    csrfToken: csrfMatch[1],
    sessionId: sidMatch ? sidMatch[1] : null,
  };
}

// Call NotebookLM batchexecute RPC
async function callRpc(
  nlmCookies: string,
  csrfToken: string | null,
  sessionId: string | null,
  rpcId: string,
  params: unknown[],
  sourcePath = "/"
) {
  const paramsJson = JSON.stringify(params);
  const fReq = JSON.stringify([[[rpcId, paramsJson, null, "generic"]]]);
  let body = `f.req=${encodeURIComponent(fReq)}`;
  if (csrfToken) body += `&at=${encodeURIComponent(csrfToken)}`;
  body += "&";

  const qsParams: Record<string, string> = {
    rpcids: rpcId,
    "source-path": sourcePath,
    bl: BUILD_LABEL,
    hl: "en",
    rt: "c",
  };
  if (sessionId) qsParams["f.sid"] = sessionId;
  const qs = Object.entries(qsParams)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const res = await fetch(`${BASE_URL}${BATCH_EXECUTE_PATH}?${qs}`, {
    method: "POST",
    headers: {
      Cookie: nlmCookies,
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      "X-Same-Domain": "1",
    },
    body,
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("AUTH_EXPIRED");
  }

  let text = await res.text();
  // Parse batchexecute response
  if (text.startsWith(")]}'")) text = text.replace(/^\)\]\}'\r?\n/, "");
  const lines = text.split("\n");
  const results: unknown[][] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (/^\d+$/.test(line)) {
      i++;
      if (i < lines.length) {
        try { results.push(JSON.parse(lines[i])); } catch { /* skip */ }
      }
      i++;
    } else {
      try { results.push(JSON.parse(line)); } catch { /* skip */ }
      i++;
    }
  }

  // Extract result for our rpcId
  for (const result of results) {
    if (Array.isArray(result)) {
      for (const item of result) {
        if (Array.isArray(item) && item[0] === "wrb.fr" && item[1] === rpcId) {
          try { return JSON.parse(item[2]); } catch { return item[2]; }
        }
      }
    }
  }
  return null;
}

function parseTimestamp(tsArray: unknown): string | null {
  if (!Array.isArray(tsArray) || tsArray.length < 1) return null;
  const seconds = tsArray[0];
  if (typeof seconds !== "number" || seconds < 1e9) return null;
  try { return new Date(seconds * 1000).toISOString(); } catch { return null; }
}

// GET: List notebooks
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const nlmCookies = getAuthCookies();
  if (!nlmCookies) {
    return NextResponse.json({
      error: "ยังไม่ได้เชื่อมต่อ NotebookLM กรุณารัน notebooklm-mcp-server auth ก่อน",
      needAuth: true,
    }, { status: 403 });
  }

  try {
    const { csrfToken, sessionId } = await initSession(nlmCookies);
    const result = await callRpc(nlmCookies, csrfToken, sessionId, RPC_IDS.LIST_NOTEBOOKS, [null, 1, null, [2]]);

    const notebooks: Array<{
      id: string;
      title: string;
      sourceCount: number;
      isShared: boolean;
      createdAt: string | null;
      modifiedAt: string | null;
    }> = [];

    if (result && Array.isArray(result)) {
      const notebookList = Array.isArray(result[0]) ? result[0] : result;
      for (const nbData of notebookList) {
        if (!Array.isArray(nbData) || nbData.length < 3) continue;
        const title = typeof nbData[0] === "string" ? nbData[0] : "Untitled";
        const sourcesData = Array.isArray(nbData[1]) ? nbData[1] : [];
        const notebookId = nbData[2];
        if (!notebookId) continue;

        let isShared = false;
        let createdAt: string | null = null;
        let modifiedAt: string | null = null;
        if (nbData.length > 5 && Array.isArray(nbData[5])) {
          const meta = nbData[5];
          if (meta.length > 1) isShared = !!meta[1];
          if (meta.length > 5) modifiedAt = parseTimestamp(meta[5]);
          if (meta.length > 8) createdAt = parseTimestamp(meta[8]);
        }

        notebooks.push({
          id: notebookId,
          title,
          sourceCount: sourcesData.length,
          isShared,
          createdAt,
          modifiedAt,
        });
      }
    }

    return NextResponse.json({ notebooks });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_EXPIRED") {
      return NextResponse.json({
        error: "NotebookLM session หมดอายุ กรุณารัน notebooklm-mcp-server auth ใหม่",
        needAuth: true,
      }, { status: 403 });
    }
    console.error("[NotebookLM]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// Extract answer from streamed query response chunks
function parseQueryResponse(data: string): string {
  if (data.startsWith(")]}'")) data = data.substring(4);
  const lines = data.split("\n");
  let longestAnswer = "";
  let longestThinking = "";
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const byteCount = parseInt(line);
    if (!isNaN(byteCount) && String(byteCount) === line.trim()) {
      i++;
      if (i < lines.length) {
        const { text, isAnswer } = extractFromChunk(lines[i]);
        if (text) {
          if (isAnswer && text.length > longestAnswer.length) longestAnswer = text;
          else if (!isAnswer && text.length > longestThinking.length) longestThinking = text;
        }
      }
      i++;
    } else {
      const { text, isAnswer } = extractFromChunk(line);
      if (text) {
        if (isAnswer && text.length > longestAnswer.length) longestAnswer = text;
        else if (!isAnswer && text.length > longestThinking.length) longestThinking = text;
      }
      i++;
    }
  }
  return longestAnswer || longestThinking || "";
}

function extractFromChunk(jsonStr: string): { text: string | null; isAnswer: boolean } {
  try {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data) || data.length === 0) return { text: null, isAnswer: false };
    for (const item of data) {
      if (!Array.isArray(item) || item.length < 3) continue;
      if (item[0] !== "wrb.fr") continue;
      const innerJsonStr = item[2];
      if (typeof innerJsonStr !== "string") continue;
      let innerData;
      try { innerData = JSON.parse(innerJsonStr); } catch { continue; }
      if (Array.isArray(innerData) && innerData.length > 0) {
        const firstElem = innerData[0];
        if (Array.isArray(firstElem) && firstElem.length > 0) {
          const answerText = firstElem[0];
          if (typeof answerText === "string" && answerText.length > 20) {
            let isAnswer = false;
            if (firstElem.length > 4 && Array.isArray(firstElem[4])) {
              const typeInfo = firstElem[4];
              isAnswer = typeInfo[typeInfo.length - 1] === 1;
            }
            return { text: answerText, isAnswer };
          }
        } else if (typeof firstElem === "string" && firstElem.length > 20) {
          return { text: firstElem, isAnswer: false };
        }
      }
    }
  } catch { /* skip */ }
  return { text: null, isAnswer: false };
}

// POST: Query a notebook
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("user-session")?.value || cookieStore.get("admin-session")?.value;
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const nlmCookies = getAuthCookies();
  if (!nlmCookies) {
    return NextResponse.json({ error: "ยังไม่ได้เชื่อมต่อ NotebookLM", needAuth: true }, { status: 403 });
  }

  try {
    const { notebookId, query } = await req.json();
    if (!notebookId || !query) {
      return NextResponse.json({ error: "ต้องระบุ notebookId และ query" }, { status: 400 });
    }

    const { csrfToken, sessionId } = await initSession(nlmCookies);

    // First get notebook to extract source IDs
    const nbData = await callRpc(
      nlmCookies, csrfToken, sessionId,
      RPC_IDS.GET_NOTEBOOK,
      [notebookId, null, [2], null, 0],
      `/notebook/${notebookId}`
    );

    // Extract source IDs
    const sourceIds: string[] = [];
    if (nbData && Array.isArray(nbData)) {
      const info = Array.isArray(nbData[0]) ? nbData[0] : nbData;
      if (info.length > 1 && Array.isArray(info[1])) {
        for (const src of info[1]) {
          if (Array.isArray(src) && src.length > 0) {
            const wrapper = src[0];
            if (Array.isArray(wrapper) && wrapper.length > 0 && typeof wrapper[0] === "string") {
              sourceIds.push(wrapper[0]);
            }
          }
        }
      }
    }

    // Query using the streamed endpoint (GenerateFreeFormStreamed)
    const sources = sourceIds.map((id) => [[id]]);
    const queryInnerParams = [sources, query, null, [2, null, [1]], crypto.randomUUID()];
    const fReq = JSON.stringify([null, JSON.stringify(queryInnerParams)]);
    let body = `f.req=${encodeURIComponent(fReq)}`;
    if (csrfToken) body += `&at=${encodeURIComponent(csrfToken)}`;
    body += "&";

    const qsParams: Record<string, string> = {
      bl: BUILD_LABEL,
      hl: "en",
      _reqid: String(100000 + Math.floor(Math.random() * 900000)),
      rt: "c",
    };
    if (sessionId) qsParams["f.sid"] = sessionId;
    const qs = Object.entries(qsParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const queryRes = await fetch(`${BASE_URL}${QUERY_PATH}?${qs}`, {
      method: "POST",
      headers: {
        Cookie: nlmCookies,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Origin: BASE_URL,
        Referer: `${BASE_URL}/notebook/${notebookId}`,
        "X-Same-Domain": "1",
      },
      body,
      cache: "no-store",
    });

    if (queryRes.status === 401 || queryRes.status === 403) {
      throw new Error("AUTH_EXPIRED");
    }

    const responseText = await queryRes.text();
    const answer = parseQueryResponse(responseText);

    return NextResponse.json({ answer, sourceCount: sourceIds.length });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_EXPIRED") {
      return NextResponse.json({ error: "NotebookLM session หมดอายุ", needAuth: true }, { status: 403 });
    }
    console.error("[NotebookLM Query]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
