// Web search module — fetches real search results and page content
// Works without any API keys using Google's public search

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string; // extracted page content
}

interface SearchProgress {
  type: "searching" | "reading" | "done";
  query?: string;
  sites?: string[];
  results?: SearchResult[];
}

const SEARCH_TIMEOUT = 8000;
const FETCH_TIMEOUT = 5000;
const MAX_CONTENT_LENGTH = 3000; // chars per page
const MAX_RESULTS = 5;

/**
 * Search Google and return results with snippets
 */
export async function searchGoogle(query: string): Promise<SearchResult[]> {
  try {
    // Use Google's search with a clean user agent
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=th&num=8&gl=th`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "th,en;q=0.9",
      },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT),
    });

    if (!res.ok) return [];
    const html = await res.text();

    // Parse search results from HTML
    const results: SearchResult[] = [];

    // Match result blocks: look for <a href="/url?q=..." patterns
    const linkRegex = /<a[^>]+href="\/url\?q=([^"&]+)[^"]*"[^>]*>/g;
    const titleRegex = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
    const snippetRegex = /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/g;

    // Alternative: extract from structured data
    const resultBlocks = html.match(/<div class="g"[\s\S]*?(?=<div class="g"|$)/g) || [];

    // Simple extraction: find all result URLs and titles
    let match;
    const urls: string[] = [];
    while ((match = linkRegex.exec(html)) !== null) {
      const url = decodeURIComponent(match[1]);
      if (url.startsWith("http") && !url.includes("google.com") && !url.includes("youtube.com/watch") && !urls.includes(url)) {
        urls.push(url);
      }
    }

    // Extract titles
    const titles: string[] = [];
    while ((match = titleRegex.exec(html)) !== null) {
      titles.push(stripHtml(match[1]));
    }

    // Extract snippets
    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(stripHtml(match[1]));
    }

    // Combine into results
    for (let i = 0; i < Math.min(urls.length, MAX_RESULTS); i++) {
      results.push({
        title: titles[i] || extractDomain(urls[i]),
        url: urls[i],
        snippet: snippets[i] || "",
      });
    }

    // Fallback: if regex didn't work, try a simpler pattern
    if (results.length === 0) {
      const simpleLinks = html.match(/href="(https?:\/\/(?!www\.google)[^"]+)"/g) || [];
      const seen = new Set<string>();
      for (const link of simpleLinks) {
        const url = link.slice(6, -1);
        const domain = extractDomain(url);
        if (!seen.has(domain) && !url.includes("google.") && !url.includes("gstatic.") && !url.includes("googleapis.")) {
          seen.add(domain);
          results.push({ title: domain, url, snippet: "" });
          if (results.length >= MAX_RESULTS) break;
        }
      }
    }

    return results;
  } catch (err) {
    console.error("[WebSearch] Google search failed:", err);
    return [];
  }
}

/**
 * Fetch and extract main content from a webpage
 */
export async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: "follow",
    });

    if (!res.ok) return "";
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return "";

    const html = await res.text();
    return extractMainContent(html);
  } catch {
    return "";
  }
}

/**
 * Full search pipeline: search + fetch top results' content
 */
export async function webSearchWithContent(
  query: string,
  onProgress?: (progress: SearchProgress) => void,
): Promise<{ results: SearchResult[]; context: string }> {
  // Step 1: Search
  onProgress?.({ type: "searching", query });
  const results = await searchGoogle(query);

  if (results.length === 0) {
    onProgress?.({ type: "done", results: [] });
    return { results: [], context: "" };
  }

  // Step 2: Fetch content from top results in parallel
  const sites = results.slice(0, 4).map(r => extractDomain(r.url));
  onProgress?.({ type: "reading", sites });

  const contentPromises = results.slice(0, 4).map(async (result) => {
    const content = await fetchPageContent(result.url);
    return { ...result, content: content.slice(0, MAX_CONTENT_LENGTH) };
  });

  const enrichedResults = await Promise.all(contentPromises);

  // Step 3: Build context string for the AI
  let context = `ข้อมูลจากการค้นหาเว็บ (คำค้น: "${query}"):\n\n`;
  for (const result of enrichedResults) {
    context += `### ${result.title}\nURL: ${result.url}\n`;
    if (result.content) {
      context += `เนื้อหา:\n${result.content}\n`;
    } else if (result.snippet) {
      context += `บทคัดย่อ: ${result.snippet}\n`;
    }
    context += "\n---\n\n";
  }

  // Filter results for client display (only ones with actual content)
  const displayResults = enrichedResults.map(({ content: _c, ...rest }) => rest);

  onProgress?.({ type: "done", results: displayResults });
  return { results: displayResults, context };
}

// ---- Helpers ----

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url.slice(0, 50);
  }
}

function extractMainContent(html: string): string {
  // Remove scripts, styles, nav, header, footer, ads
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Try to find main content area
  const mainMatch = cleaned.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  if (mainMatch) {
    cleaned = mainMatch[1];
  }

  // Strip all HTML tags
  let text = stripHtml(cleaned);

  // Clean up whitespace
  text = text
    .replace(/\n\s*\n/g, "\n\n")
    .replace(/\s{3,}/g, " ")
    .trim();

  // Truncate
  if (text.length > MAX_CONTENT_LENGTH) {
    text = text.slice(0, MAX_CONTENT_LENGTH) + "...";
  }

  return text;
}
