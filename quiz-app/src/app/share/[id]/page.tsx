import { kv } from "@/lib/kv";
import { notFound } from "next/navigation";
import { MessageSquare, Bot, User, Calendar, ExternalLink } from "lucide-react";
import Link from "next/link";
import hljs from "highlight.js";
import katex from "katex";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";

interface Message {
  role: "user" | "assistant";
  content: string;
  files?: Array<{ data: string; name: string }>;
  generatedImages?: string[];
}

interface SharedChat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  sharedBy: string;
  sharedAt: number;
}

function parseThinking(content: string): { thinking: string; answer: string } {
  const thinkMatch = content.match(/<think>([\s\S]*?)(<\/think>|$)/);
  if (!thinkMatch) return { thinking: "", answer: content };

  let thinking = thinkMatch[1].trim();
  thinking = thinking.replace(/\[MEMORY_SAVE:\s*.+?\]/g, "").trim();

  let afterThink = content.replace(/<think>[\s\S]*?(<\/think>|$)/, "").trim();
  afterThink = afterThink.replace(/\[MEMORY_SAVE:\s*.+?\]/g, "").trim();

  return { thinking, answer: afterThink };
}

function renderMarkdown(text: string): string {
  if (!text) return "";
  
  const mathBlocks: string[] = [];
  let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, tex) => {
    const idx = mathBlocks.length;
    try {
      mathBlocks.push(katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false, output: "html" }));
    } catch {
      mathBlocks.push(`<div class="text-red-500 text-sm font-mono">${tex}</div>`);
    }
    return `\x00MATH${idx}\x00`;
  });

  processed = processed.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_m, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false, output: "html" });
    } catch {
      return `<code class="text-red-500">${tex}</code>`;
    }
  });

  // Also handle \( ... \) and \[ ... \] LaTeX delimiters
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_m, tex) => {
    const idx = mathBlocks.length;
    try {
      mathBlocks.push(katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false, output: "html" }));
    } catch {
      mathBlocks.push(`<div class="text-red-500 text-sm font-mono">${tex}</div>`);
    }
    return `\x00MATH${idx}\x00`;
  });
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_m, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false, output: "html" });
    } catch {
      return `<code class="text-red-500">${tex}</code>`;
    }
  });

  const codeBlocks: string[] = [];
  processed = processed.replace(/```(\w*)\n([\s\S]*?)(?:```|$)/g, (_m, lang: string, code: string) => {
    const idx = codeBlocks.length;
    const trimmed = code.replace(/\n$/, "");
    const langLower = (lang || "").toLowerCase();
    const langLabel = langLower || "code";
    
    let highlighted: string;
    if (langLower && hljs.getLanguage(langLower)) {
      highlighted = hljs.highlight(trimmed, { language: langLower, ignoreIllegals: true }).value;
    } else if (trimmed.length > 20) {
      highlighted = hljs.highlightAuto(trimmed).value;
    } else {
      highlighted = trimmed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    codeBlocks.push(
      `<div class="aq-code my-3 rounded-xl overflow-hidden border border-gray-700/50 bg-[#1e1e2e] shadow-lg">` +
      `<div class="flex items-center justify-between px-4 py-2 bg-[#181825] border-b border-gray-700/50">` +
      `<div class="flex items-center gap-2"><div class="flex gap-1.5"><span class="w-3 h-3 rounded-full bg-[#f38ba8]"></span><span class="w-3 h-3 rounded-full bg-[#f9e2af]"></span><span class="w-3 h-3 rounded-full bg-[#a6e3a1]"></span></div>` +
      `<span class="text-[11px] text-gray-400 font-medium ml-2">${langLabel}</span></div>` +
      `<button onclick="(function(b){var p=b.closest('.aq-code');var c=p&&p.querySelector('code');if(c){navigator.clipboard.writeText(c.textContent||'');b.innerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><polyline points=\\'20 6 9 17 4 12\\'></polyline></svg> Copied';setTimeout(function(){b.innerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><rect x=\\'9\\' y=\\'9\\' width=\\'13\\' height=\\'13\\' rx=\\'2\\' ry=\\'2\\'></rect><path d=\\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\'></path></svg> Copy'},1500)}})(this)" class="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 text-xs px-2.5 py-1 rounded-md hover:bg-white/10 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy</button>` +
      `</div><pre class="p-4 text-[13px] leading-relaxed overflow-x-auto" style="word-break:break-word;overflow-wrap:break-word;white-space:pre-wrap"><code class="hljs">${highlighted}</code></pre></div>`
    );
    return `\x00CODE${idx}\x00`;
  });

  // Parse tables
  processed = processed.replace(
    /(?:^|\n)((?:\|[^\n]+\|(?:\s*\n|$)){2,})/g,
    (_m, tableBlock: string) => {
      const rows = tableBlock.trim().split("\n").filter(r => r.trim());
      if (rows.length < 2) return _m;
      const isSep = (row: string) => /^\|[\s\-:]+(\|[\s\-:]+)+\|?\s*$/.test(row);
      const hasSeparator = isSep(rows[1]);
      const parseRow = (row: string) => row.split("|").slice(1, -1).map(c => c.trim());
      let html = '\n<div class="my-3 overflow-x-auto rounded-xl border border-gray-200 shadow-sm"><table class="w-full text-sm border-collapse">';
      const startIdx = hasSeparator ? 2 : 0;
      if (hasSeparator) {
        const headerCells = parseRow(rows[0]);
        html += '<thead><tr class="bg-gradient-to-r from-gray-50 to-gray-100">';
        for (const cell of headerCells) {
          html += `<th class="px-4 py-2.5 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs uppercase tracking-wider">${cell}</th>`;
        }
        html += "</tr></thead>";
      }
      html += "<tbody>";
      for (let i = startIdx; i < rows.length; i++) {
        if (isSep(rows[i])) continue;
        const cells = parseRow(rows[i]);
        const stripe = (i - startIdx) % 2 === 1 ? " bg-gray-50/60" : "";
        html += `<tr class="border-b border-gray-100 hover:bg-blue-50/40 transition-colors${stripe}">`;
        for (const cell of cells) {
          html += `<td class="px-4 py-2.5 text-gray-600">${cell}</td>`;
        }
        html += "</tr>";
      }
      html += "</tbody></table></div>\n";
      return html;
    }
  );

  processed = processed
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-violet-200/50">$1</code>')
    .replace(/^### (.*$)/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="font-bold text-xl mt-3 mb-1">$1</h1>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal">$1. $2</li>')
    .replace(/✓/g, '<span class="text-emerald-600 font-bold">✓</span>')
    .replace(/✗/g, '<span class="text-red-400">✗</span>')
    .replace(/\n/g, "<br/>");

  processed = processed.replace(/\x00CODE(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)]);
  processed = processed.replace(/\x00MATH(\d+)\x00/g, (_m, idx) => mathBlocks[Number(idx)] || "");

  return processed;
}

function ThinkingBlock({ thinking }: { thinking: string }) {
  if (!thinking) return null;
  
  return (
    <div className="my-2 border-l-2 border-gray-200 pl-4 py-1">
      <details className="group">
        <summary className="list-none cursor-pointer flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <div className="p-1 rounded bg-gray-100">
            <MessageSquare className="h-3 w-3" />
          </div>
          <span className="font-medium uppercase tracking-wider">กระบวนการคิด</span>
          <svg 
            className="h-3 w-3 group-open:rotate-180 transition-transform" 
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="mt-2 text-sm text-gray-500 italic leading-relaxed whitespace-pre-wrap">
          {thinking}
        </div>
      </details>
    </div>
  );
}

export default async function SharedChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chatData = await kv.get<SharedChat>(`ai_shared_chat:${id}`);
  
  if (!chatData) {
    return notFound();
  }

  const { title, messages, sharedBy, sharedAt } = chatData;
  const dateStr = new Date(sharedAt).toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric"
  });

  return (
    <div className="min-h-screen bg-[#fcfcfd]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="container max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/ai" className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors font-bold tracking-tight">
            <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
              <Bot className="h-5 w-5" />
            </div>
            <span>Allquiz AI</span>
          </Link>
          <Link href="/ai">
            <button className="text-xs bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 font-bold">
              เริ่มแชทของคุณ
            </button>
          </Link>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-10 pb-24">
        {/* Title Card */}
        <div className="mb-10 text-center space-y-3">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h1>
          <div className="flex items-center justify-center gap-4 text-xs font-medium text-gray-400">
            <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {sharedBy}</div>
            <div className="w-1 h-1 rounded-full bg-gray-300"></div>
            <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {dateStr}</div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="space-y-8">
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const { thinking, answer } = parseThinking(m.content);
            
            return (
              <div key={i} className={`flex gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center shadow-sm ${
                  isUser 
                    ? "bg-white border border-gray-100 text-gray-400" 
                    : "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                }`}>
                  {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>
                <div className={`max-w-[88%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
                  {/* User Attachments */}
                  {isUser && m.files && m.files.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end mb-1">
                      {m.files.map((f, j) => (
                        <div key={j} className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm max-w-[240px]">
                          {f.data.startsWith("data:image/") ? (
                            <img src={f.data} alt="attachment" className="max-h-48 object-contain" />
                          ) : (
                            <div className="p-3 text-xs text-gray-500 flex items-center gap-2 bg-gray-50 font-medium">
                              <ExternalLink className="h-4 w-4 text-emerald-500"/> 
                              <span className="truncate">{f.name || "File"}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Generated Images */}
                  {!isUser && m.generatedImages && m.generatedImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {m.generatedImages.map((img, j) => (
                        <img key={j} src={img} alt="generated" className="rounded-2xl border border-gray-200 shadow-md max-w-full sm:max-w-[400px]" />
                      ))}
                    </div>
                  )}

                  {/* Thinking Process */}
                  {!isUser && thinking && <ThinkingBlock thinking={thinking} />}

                  {/* Message Content */}
                  {(answer || isUser) && (
                    <div className={`px-5 py-4 shadow-sm leading-relaxed ${
                      isUser 
                        ? "bg-gray-900 text-white rounded-2xl rounded-tr-sm text-[15px]" 
                        : "bg-white border border-gray-100 rounded-2xl rounded-tl-sm text-gray-800 text-[15px]"
                    }`}>
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      ) : (
                        <div className="prose prose-emerald prose-sm max-w-none prose-p:my-2 prose-headings:my-4 prose-li:my-1 prose-pre:bg-gray-900 prose-pre:rounded-xl" dangerouslySetInnerHTML={{ __html: renderMarkdown(answer.replace(/\*\\(Artifact generated in Canvas\\)\*/g, "")) }} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="mt-20 py-10 border-t border-gray-100 text-center">
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bot className="h-6 w-6" />
          </div>
          <p className="text-gray-900 font-bold mb-1">สร้างด้วย Allquiz AI</p>
          <p className="text-gray-400 text-sm mb-6">ผู้ช่วยอัจฉริยะสำหรับนักเรียนและนักพัฒนา</p>
          <Link href="/ai">
            <button className="bg-emerald-600 text-white px-8 py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 font-bold text-sm">
              เริ่มบทสนทนาของคุณได้ฟรี
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
