"use client";

import { toast } from "sonner";
import CanvasView from "./components/CanvasView";
import { parseArtifacts } from "./utils/canvasParser";
import { Artifact } from "./types/canvas";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import java from "highlight.js/lib/languages/java";
import csharp from "highlight.js/lib/languages/csharp";
import cpp from "highlight.js/lib/languages/cpp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import php from "highlight.js/lib/languages/php";
import ruby from "highlight.js/lib/languages/ruby";
import swift from "highlight.js/lib/languages/swift";
import kotlin from "highlight.js/lib/languages/kotlin";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import diff from "highlight.js/lib/languages/diff";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  Sparkles,
  User,
  Loader2,
  ChevronDown,
  ChevronRight,
  Zap,
  LogOut,
  Lock,
  FileText,
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Search,
  Pencil,
  Check,
  Clock,
  Paperclip,
  ArrowUp,
  X,
  Settings,
  Globe,
  UserCircle,
  Database,
  Download,
  AlertTriangle,
  MessageCircle,
  Image,
  GraduationCap,
  ClipboardList,
  MoreHorizontal,
  Copy,
  SquarePen,
  Brain,
  Folder as FolderIcon,
  FolderPlus,
  FolderInput,
  Share2,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  ShieldCheck,
  Github,
  Code2,
  Maximize2,
} from "lucide-react";

// Register highlight.js languages
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("java", java);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", cpp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("php", php);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("diff", diff);

// Move renderMarkdown outside to be used by other components
const renderMarkdown = (text: string) => {
  if (!text) return "";
  
  // Storage for blocks to protect them from inline processing
  const blocks: { type: "MATH" | "CODE" | "TABLE"; html: string }[] = [];
  
  const addBlock = (type: "MATH" | "CODE" | "TABLE", html: string) => {
    const id = blocks.length;
    blocks.push({ type, html });
    return `__BLOCK_PLACEHOLDER_${type}_${id}__`;
  };

  let processed = text;

  // 0. Extract blocks in priority order

  // Fenced Code Blocks
  processed = processed.replace(/```(\w*)\n([\s\S]*?)(?:```|$)/g, (_m, lang: string, code: string) => {
    const trimmed = code.replace(/\n$/, "");
    const langLower = (lang || "").toLowerCase();
    const langLabel = langLower || "code";

    let highlighted: string;
    if (langLower && hljs.getLanguage(langLower)) {
      highlighted = hljs.highlight(trimmed, { language: langLower, ignoreIllegals: true }).value;
    } else if (trimmed.length > 20) {
      try {
        const auto = hljs.highlightAuto(trimmed);
        highlighted = auto.value;
      } catch {
        highlighted = trimmed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
    } else {
      highlighted = trimmed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    const html = 
      `<div class="aq-code my-3 rounded-xl overflow-hidden border border-gray-700/50 bg-[#1e1e2e] shadow-lg">` +
      `<div class="flex items-center justify-between px-4 py-2 bg-[#181825] border-b border-gray-700/50">` +
      `<div class="flex items-center gap-2"><div class="flex gap-1.5"><span class="w-3 h-3 rounded-full bg-[#f38ba8]"></span><span class="w-3 h-3 rounded-full bg-[#f9e2af]"></span><span class="w-3 h-3 rounded-full bg-[#a6e3a1]"></span></div>` +
      `<span class="text-[11px] text-gray-400 font-medium ml-2">${langLabel}</span></div>` +
      `<button onclick="(function(b){var p=b.closest('.aq-code');var c=p&&p.querySelector('code');if(c){navigator.clipboard.writeText(c.textContent||'');b.innerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><polyline points=\\'20 6 9 17 4 12\\'></polyline></svg> Copied';setTimeout(function(){b.innerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><rect x=\\'9\\' y=\\'9\\' width=\\'13\\' height=\\'13\\' rx=\\'2\\' ry=\\'2\\'></rect><path d=\\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\'></path></svg> Copy'},1500)}})(this)" class="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 text-xs px-2.5 py-1 rounded-md hover:bg-white/10 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy</button>` +
      `</div>` +
      `<pre class="p-4 text-[13px] leading-relaxed overflow-x-auto" style="word-break:break-word;overflow-wrap:break-word;white-space:pre-wrap"><code class="hljs">${highlighted}</code></pre>` +
      `</div>`;
    
    return addBlock("CODE", html);
  });

  // Block Math (including environments)
  const blockMathRegex = /(?:\$\$([\s\S]*?)\$\$)|(?:\\\[([\s\S]*?)\\\])|(?:\\begin\{([a-z*]+)\}([\s\S]*?)\\end\{\3\})/gi;
  processed = processed.replace(blockMathRegex, (_m, tex1, tex2, env, tex3) => {
    let tex = "";
    if (tex1) tex = tex1;
    else if (tex2) tex = tex2;
    else if (env && tex3) tex = `\\begin{${env}}${tex3}\\end{${env}}`;
    
    tex = tex.trim();
    if (!tex) return _m;
    try {
      const html = katex.renderToString(tex, { displayMode: true, throwOnError: false, output: "html" });
      return addBlock("MATH", `<div class="my-4 overflow-x-auto">${html}</div>`);
    } catch {
      return addBlock("MATH", `<div class="text-red-500 text-sm font-mono my-2 border border-red-200 p-2 rounded bg-red-50">${tex}</div>`);
    }
  });

  // Inline Math
  const inlineMathRegex = /(?:\$([^\$\n]+?)\$)|(?:\\\(([\s\S]*?)\\\))/g;
  processed = processed.replace(inlineMathRegex, (_m, tex1, tex2) => {
    const tex = (tex1 || tex2 || "").trim();
    if (!tex) return _m;
    try {
      const html = katex.renderToString(tex, { displayMode: false, throwOnError: false, output: "html" });
      return addBlock("MATH", html);
    } catch {
      return addBlock("MATH", `<code class="text-red-500">${tex}</code>`);
    }
  });

  // Tables
  processed = processed.replace(/(?:^|\n)((?:\|[^\n]+\|\s*\n){2,})/g, (_m, tableBlock: string) => {
    const rows = tableBlock.trim().split("\n").filter(r => r.trim());
    if (rows.length < 2) return _m;
    const isSep = (row: string) => /^\|[\s\-:\|]+\|\s*$/.test(row);
    const hasSeparator = isSep(rows[1]);
    const parseRow = (row: string) => row.split("|").filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());
    
    let html = '<div class="my-4 overflow-x-auto rounded-xl border border-gray-200 shadow-sm"><table class="w-full text-sm border-collapse">';
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
      html += `<tr class="border-b border-gray-100 hover:bg-emerald-50/30 transition-colors${stripe}">`;
      for (const cell of cells) {
        html += `<td class="px-4 py-2.5 text-gray-600">${cell}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table></div>";
    
    return addBlock("TABLE", html);
  });

  // 1. Inline formatting
  processed = processed
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-violet-200/50">$1</code>')
    .replace(/^### (.*$)/gm, '<h3 class="font-bold text-base mt-4 mb-2 text-gray-900">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="font-bold text-lg mt-5 mb-2 text-gray-900 border-b border-gray-100 pb-1">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="font-bold text-xl mt-6 mb-3 text-gray-900">$1</h1>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc my-1">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal my-1">$1. $2</li>')
    .replace(/✓/g, '<span class="text-emerald-600 font-bold">✓</span>')
    .replace(/✗/g, '<span class="text-red-400">✗</span>')
    .replace(/\n/g, "<br/>");

  // 2. Restore blocks - Use function to avoid pattern issues
  blocks.forEach((block, idx) => {
    const placeholder = `__BLOCK_PLACEHOLDER_${block.type}_${idx}__`;
    processed = processed.replace(placeholder, () => block.html);
  });

  return processed;
};

function parseThinking(content: string): { thinking: string; answer: string } {
  if (!content) return { thinking: "", answer: "" };
  
  const thinkStartTag = "<think>";
  const thinkEndTag = "</think>";
  
  const startIndex = content.indexOf(thinkStartTag);
  if (startIndex === -1) return { thinking: "", answer: content };
  
  const endIndex = content.indexOf(thinkEndTag);
  
  if (endIndex === -1) {
    // Thinking is still in progress
    const thinking = content.slice(startIndex + thinkStartTag.length).trim();
    return { thinking: thinking.replace(/\[MEMORY_SAVE:\s*.+?\]/g, ""), answer: "" };
  }
  
  const thinking = content.slice(startIndex + thinkStartTag.length, endIndex).trim();
  const answer = (content.slice(0, startIndex) + content.slice(endIndex + thinkEndTag.length)).trim();
  
  return { 
    thinking: thinking.replace(/\[MEMORY_SAVE:\s*.+?\]/g, ""), 
    answer: answer.replace(/\[MEMORY_SAVE:\s*.+?\]/g, "") 
  };
}

function ThinkingBlock({ 
  thinking, 
  isStreaming, 
  status = "กำลังวิเคราะห์..." 
}: { 
  thinking: string; 
  isStreaming: boolean;
  status?: string;
}) {
  const [open, setOpen] = useState(true); // Default open while thinking
  
  // Keep it open while streaming reasoning
  useEffect(() => {
    if (isStreaming && thinking) {
      const timer = setTimeout(() => setOpen(true), 0);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, thinking]);

  if (!thinking && !isStreaming) return null;
  
  return (
    <div className="mb-3 animate-in fade-in slide-in-from-top-1 duration-300">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:opacity-80 transition-all px-2 py-1 rounded-lg bg-emerald-50/50 border border-emerald-100/50"
      >
        <Zap className={`h-3 w-3 ${isStreaming ? "animate-pulse" : ""}`} />
        {isStreaming ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            {thinking ? "กำลังประมวลผลความคิด..." : status}
          </span>
        ) : (
          <span>กระบวนการคิด</span>
        )}
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (thinking || isStreaming) && (
        <div 
          className="mt-2 ml-1 pl-4 border-l-2 border-emerald-200/50 text-xs text-muted-foreground/80 leading-relaxed italic prose prose-sm max-w-none transition-all duration-300"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(thinking || (isStreaming ? "กำลังเชื่อมต่อฐานข้อมูลความรู้..." : "")) }}
        />
      )}
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="flex flex-row gap-4 w-full animate-in fade-in duration-500">
      <div className="shrink-0 pt-1">
        <div className="h-9 w-9 rounded-xl bg-gray-200 animate-pulse" />
      </div>
      <div className="flex flex-col gap-2 w-full max-w-[80%]">
        <div className="h-4 w-24 bg-gray-200 rounded-lg animate-pulse" />
        <div className="space-y-2 p-4 rounded-2xl bg-white/40 backdrop-blur-md border border-white/20 shadow-sm">
          <div className="h-3 w-full bg-gray-200/60 rounded animate-pulse" />
          <div className="h-3 w-[90%] bg-gray-200/60 rounded animate-pulse" />
          <div className="h-3 w-[95%] bg-gray-200/60 rounded animate-pulse" />
          <div className="h-3 w-[40%] bg-gray-200/60 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
// ===== Settings Types =====
interface AISettings {
  defaultModel: string;
  fontSize: "small" | "medium" | "large";
  responseStyle: "concise" | "detailed";
  customInstructions: string;
  sendWithEnter: boolean;
  language: "th" | "en" | "zh" | "ja" | "ko";
  memoryEnabled: boolean;
}

interface MemoryItem {
  id: string;
  content: string;
  createdAt: number;
  source?: string;
}

const DEFAULT_SETTINGS: AISettings = {
  defaultModel: "auto",
  fontSize: "medium",
  responseStyle: "concise",
  customInstructions: "",
  sendWithEnter: true,
  language: "th",
  memoryEnabled: true,
};

const LANGUAGES = [
  { value: "th" as const, label: "ไทย", flag: "TH" },
  { value: "en" as const, label: "English", flag: "EN" },
  { value: "zh" as const, label: "中文", flag: "CN" },
  { value: "ja" as const, label: "日本語", flag: "JP" },
  { value: "ko" as const, label: "한국어", flag: "KR" },
];

// i18n strings
const UI_STRINGS: Record<string, Record<string, string>> = {
  th: {
    settings: "ตั้งค่า",
    general: "ทั่วไป",
    personalization: "การปรับแต่ง",
    dataControl: "การควบคุมข้อมูล",
    account: "บัญชี",
    defaultModel: "โมเดลเริ่มต้น",
    defaultModelDesc: "เลือกโมเดล AI ที่จะใช้เป็นค่าเริ่มต้น",
    autoDesc: "เลือกโมเดลอัตโนมัติตามความซับซ้อน",
    proDesc: "แม่นยำสูง เหมาะกับคำถามซับซ้อน",
    flashDesc: "เร็ว เหมาะกับคำถามทั่วไป",
    claudeDesc: "Claude Sonnet โมเดลจาก Anthropic",
    fontSize: "ขนาดตัวอักษร",
    fontSizeDesc: "ปรับขนาดข้อความในแชท",
    fontSmall: "เล็ก",
    fontMedium: "กลาง",
    fontLarge: "ใหญ่",
    sendWithEnter: "ส่งด้วย Enter",
    sendWithEnterDesc: "กด Enter เพื่อส่งข้อความ (Shift+Enter ขึ้นบรรทัดใหม่)",
    language: "ภาษา",
    languageDesc: "เปลี่ยนภาษาของ AI และอินเตอร์เฟซ",
    responseStyle: "รูปแบบการตอบ",
    responseStyleDesc: "กำหนดว่า AI จะตอบแบบสั้นกระชับหรือละเอียด",
    concise: "กระชับ",
    conciseDesc: "ตอบสั้น ตรงประเด็น",
    detailed: "ละเอียด",
    detailedDesc: "อธิบายเพิ่มเติม มีตัวอย่าง",
    customInstructions: "คำสั่งเพิ่มเติม",
    customInstructionsDesc: "บอก AI ว่าคุณเป็นใคร หรือต้องการให้ตอบอย่างไร",
    customInstructionsPlaceholder: "เช่น ฉันเป็นนักศึกษาปี 3 สาขาวิศวกรรมซอฟต์แวร์ ชอบให้อธิบายพร้อมตัวอย่างโค้ด...",
    exportHistory: "ส่งออกประวัติแชท",
    exportHistoryDesc: "ดาวน์โหลดแชททั้งหมดเป็นไฟล์ JSON",
    export: "ส่งออก",
    clearHistory: "ลบประวัติแชททั้งหมด",
    chatsCount: "แชท จะถูกลบถาวร",
    cancel: "ยกเลิก",
    confirmDelete: "ยืนยันลบ",
    deleteAll: "ลบทั้งหมด",
    quota: "โควตาการใช้งาน",
    times: "ครั้ง",
    remaining: "เหลือ",
    quotaReset: "โควตาจะรีเซ็ตใหม่ทุกวันเวลาเที่ยงคืน",
    logout: "ออกจากระบบ",
    save: "บันทึก",
    newChat: "แชทใหม่",
    search: "ค้นหา...",
    noHistory: "ยังไม่มีประวัติ",
    noSearchResult: "ไม่พบแชทที่ค้นหา",
    sendMessage: "ส่งข้อความ หรือวางรูปภาพ...",
    dropFiles: "วางไฟล์ที่นี่",
    dropFilesDesc: "รองรับรูปภาพ, PDF, เอกสาร (สูงสุด 4MB)",
    quotaExhausted: "โควตาหมดแล้ว",
    quotaExhaustedMsg: "ครั้งแล้ว",
    quotaResetIn: "ชั่วโมง",
    quotaResetDaily: "รีเซ็ตทุกวันเวลาเที่ยงคืน",
    understood: "เข้าใจแล้ว",
    askAI: "ถามหรือส่งรูปข้อสอบเพื่อให้ AI ช่วยวิเคราะห์",
    preparing: "กำลังเตรียมพร้อม...",
    loginTitle: "เข้าสู่ระบบด้วย Google เพื่อใช้งาน AI Chat",
    loginLimit: "จำกัด 20 ครั้งต่อบัญชี",
    loginNote: "บัญชี Google ทั่วไปเข้าใช้งานได้ทันที",
    loading: "กำลังโหลด...",
    today: "วันนี้",
    yesterday: "เมื่อวาน",
    last7days: "7 วันที่ผ่านมา",
    last30days: "30 วันที่ผ่านมา",
    memory: "ความทรงจำ",
    memoryDesc: "อนุญาตให้ AI อ้างอิงและใช้ข้อมูลที่จดจำไว้ในการตอบ",
    memoryEnabled: "เปิดใช้ความทรงจำ",
    memoryManage: "จัดการความทรงจำ",
    memoryEmpty: "ยังไม่มีความทรงจำ",
    memoryEmptyDesc: "AI จะจดจำข้อมูลสำคัญจากการสนทนาของคุณโดยอัตโนมัติ",
    memoryAdd: "เพิ่มความทรงจำ",
    memoryAddPlaceholder: "เช่น ฉันเป็นนักศึกษาปี 3 สาขาวิศวกรรมซอฟต์แวร์",
    memoryClearAll: "ลบความทรงจำทั้งหมด",
    memoryClearConfirm: "ยืนยันลบทั้งหมด",
    memoryCount: "ความทรงจำ",
    memoryAuto: "อัตโนมัติ",
    memoryManual: "เพิ่มเอง",
    memoryImport: "นำเข้า",
    memoryExport: "ส่งออก",
    clearTTSCache: "ลบที่เก็บแคช TTS",
    clearAllChats: "ล้างการแชททั้งหมด",
    importJSON: "นำเข้าการสนทนาจากไฟล์ JSON",
    revokePersonalization: "เพิกถอนข้อมูลประจำตัวผู้ใช้ทั้งหมด",
    revoke: "เพิกถอน",
    importMemory: "นำเข้าความทรงจำ",
    importMemoryDesc: "นำเข้าความทรงจำจากแพลตฟอร์ม AI อื่น",
    importMethodPrompt: "นำเข้าด้วยพรอมต์",
    importMethodPromptDesc: "คัดลอกพรอมต์ไปถามใน AI อื่น แล้วนำคำตอบกลับมาวาง",
    importMethodFile: "นำเข้าจากไฟล์",
    importMethodFileDesc: "อัปโหลดไฟล์ส่งออกจาก ChatGPT หรือ Claude (.json, .zip)",
    importFrom: "นำเข้าจาก",
    importPromptCopy: "คัดลอกพรอมต์",
    importPromptCopied: "คัดลอกแล้ว!",
    importPromptInstruction: "วางพรอมต์นี้ในแชทของ AI อื่น แล้วคัดลอกคำตอบกลับมาวางที่นี่",
    importPasteHere: "วางคำตอบจาก AI อื่นที่นี่...",
    importParseMemories: "แยกความทรงจำ",
    importParsing: "กำลังแยกความทรงจำ...",
    importReview: "ตรวจสอบความทรงจำ",
    importReviewDesc: "เลือกความทรงจำที่ต้องการนำเข้า",
    importSelectAll: "เลือกทั้งหมด",
    importDeselectAll: "ยกเลิกทั้งหมด",
    importSelected: "นำเข้าที่เลือก",
    importSuccess: "นำเข้าสำเร็จ!",
    importNoMemories: "ไม่พบความทรงจำในข้อความ",
    importBack: "ย้อนกลับ",
    importUploadFile: "เลือกไฟล์",
    importProcessing: "กำลังประมวลผล...",
    importDragDrop: "ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก",
    importSupported: "รองรับ .json และ .zip (สูงสุด 50MB)",
    credits: "เครดิต",
    creditsBalance: "ยอมเครดิตคงเหลือ",
    creditsTopup: "เติมเครดิต",
    creditsPromo: "รหัสโปรโมชั่น",
    creditsPromoPlaceholder: "กรอกรหัสโปรโมชั่น",
    creditsRedeem: "แลก",
    creditsHistory: "ประวัติการใช้",
    creditsFree: "ฟรี",
    creditsPerUse: "เครดิต/ครั้ง",
    creditsInsufficient: "เครดิตไม่เพียงพอ",
    creditsTopupDesc: "เติมเครดิตเพื่อใช้โมเดลระดับโปร",
    creditsCostInfo: "โมเดลฟรีใช้งานได้ 100 ครั้งต่อวัน โมเดลโปรใช้เครดิต",
    creditsUsage: "ใช้งาน",
    creditsTopupBonus: "เติมเครดิต",
    creditsRefund: "คืนเครดิต",
  },
  en: {
    settings: "Settings",
    general: "General",
    personalization: "Personalization",
    dataControl: "Data Controls",
    account: "Account",
    defaultModel: "Default Model",
    defaultModelDesc: "Choose the default AI model",
    autoDesc: "Auto-select model based on complexity",
    proDesc: "High accuracy, for complex questions",
    flashDesc: "Fast, for general questions",
    claudeDesc: "Claude Sonnet by Anthropic",
    fontSize: "Font Size",
    fontSizeDesc: "Adjust text size in chat",
    fontSmall: "Small",
    fontMedium: "Medium",
    fontLarge: "Large",
    sendWithEnter: "Send with Enter",
    sendWithEnterDesc: "Press Enter to send (Shift+Enter for new line)",
    language: "Language",
    languageDesc: "Change AI and interface language",
    responseStyle: "Response Style",
    responseStyleDesc: "Choose concise or detailed AI responses",
    concise: "Concise",
    conciseDesc: "Short and to the point",
    detailed: "Detailed",
    detailedDesc: "Thorough with examples",
    customInstructions: "Custom Instructions",
    customInstructionsDesc: "Tell AI about yourself or how you want responses",
    customInstructionsPlaceholder: "e.g. I'm a 3rd year software engineering student, I prefer explanations with code examples...",
    exportHistory: "Export Chat History",
    exportHistoryDesc: "Download all chats as JSON",
    export: "Export",
    clearHistory: "Clear All Chat History",
    chatsCount: "chats will be permanently deleted",
    cancel: "Cancel",
    confirmDelete: "Confirm Delete",
    deleteAll: "Delete All",
    quota: "Usage Quota",
    times: "times",
    remaining: "remaining",
    quotaReset: "Quota resets daily at midnight",
    logout: "Log Out",
    save: "Save",
    newChat: "New Chat",
    search: "Search...",
    noHistory: "No history yet",
    noSearchResult: "No chats found",
    sendMessage: "Send a message or paste an image...",
    dropFiles: "Drop files here",
    dropFilesDesc: "Supports images, PDF, documents (max 4MB)",
    quotaExhausted: "Quota Exhausted",
    quotaExhaustedMsg: "times used",
    quotaResetIn: "hours",
    quotaResetDaily: "Resets daily at midnight",
    understood: "Got it",
    askAI: "Ask or send exam photos for AI analysis",
    preparing: "Preparing...",
    loginTitle: "Sign in with Google to use AI Chat",
    loginLimit: "Limited to 20 uses per account",
    loginNote: "Any Google account can sign in instantly",
    loading: "Loading...",
    today: "Today",
    yesterday: "Yesterday",
    last7days: "Last 7 days",
    last30days: "Last 30 days",
    memory: "Memory",
    memoryDesc: "Allow the assistant to reference and use your saved memories when responding",
    memoryEnabled: "Enable Memory",
    memoryManage: "Manage Memories",
    memoryEmpty: "No memories yet",
    memoryEmptyDesc: "AI will automatically remember important information from your conversations",
    memoryAdd: "Add Memory",
    memoryAddPlaceholder: "e.g. I'm a 3rd year software engineering student",
    memoryClearAll: "Clear All Memories",
    memoryClearConfirm: "Confirm Clear All",
    memoryCount: "memories",
    memoryAuto: "Auto",
    memoryManual: "Manual",
    memoryImport: "Import",
    memoryExport: "Export",
    clearTTSCache: "Clear TTS Cache",
    clearAllChats: "Clear All Chats",
    importJSON: "Import conversations from JSON",
    revokePersonalization: "Revoke all user personalization data",
    revoke: "Revoke",
    importMemory: "Import Memories",
    importMemoryDesc: "Import memories from other AI platforms",
    importMethodPrompt: "Import via Prompt",
    importMethodPromptDesc: "Copy a prompt to ask another AI, then paste its response here",
    importMethodFile: "Import from File",
    importMethodFileDesc: "Upload export files from ChatGPT or Claude (.json, .zip)",
    importFrom: "Import from",
    importPromptCopy: "Copy Prompt",
    importPromptCopied: "Copied!",
    importPromptInstruction: "Paste this prompt in another AI's chat, then copy the response back here",
    importPasteHere: "Paste the response from the other AI here...",
    importParseMemories: "Extract Memories",
    importParsing: "Extracting memories...",
    importReview: "Review Memories",
    importReviewDesc: "Select memories to import",
    importSelectAll: "Select All",
    importDeselectAll: "Deselect All",
    importSelected: "Import Selected",
    importSuccess: "Import successful!",
    importNoMemories: "No memories found in text",
    importBack: "Back",
    importUploadFile: "Choose File",
    importProcessing: "Processing...",
    importDragDrop: "Drag & drop files here, or click to browse",
    importSupported: "Supports .json and .zip (max 50MB)",
    credits: "Credits",
    creditsBalance: "Credit Balance",
    creditsTopup: "Top Up",
    creditsPromo: "Promo Code",
    creditsPromoPlaceholder: "Enter promo code",
    creditsRedeem: "Redeem",
    creditsHistory: "Usage History",
    creditsFree: "Free",
    creditsPerUse: "credits/use",
    creditsInsufficient: "Insufficient credits",
    creditsTopupDesc: "Top up credits to use pro models",
    creditsCostInfo: "Free models have 100/day limit. Pro models use credits.",
    creditsUsage: "Usage",
    creditsTopupBonus: "Top up",
    creditsRefund: "Refund",
  },
};

function t(key: string, lang: string): string {
  return UI_STRINGS[lang]?.[key] || UI_STRINGS["th"][key] || key;
}

function loadSettings(): AISettings {
  try {
    const saved = localStorage.getItem("allquiz_ai_settings");
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AISettings) {
  localStorage.setItem("allquiz_ai_settings", JSON.stringify(settings));
}

// Sync settings to server (per-account)
async function syncSettingsToServer(settings: AISettings) {
  try {
    await fetch("/api/ai/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
  } catch {}
}

async function loadSettingsFromServer(): Promise<AISettings | null> {
  try {
    const res = await fetch("/api/ai/settings");
    if (!res.ok) return null;
    const data = await res.json();
    return data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : null;
  } catch {
    return null;
  }
}

// ===== Quota Exceeded Popup =====
function QuotaExceededPopup({
  limit,
  onClose,
  lang,
}: {
  limit: number;
  onClose: () => void;
  lang: string;
}) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const hoursLeft = Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60));
  const minutesLeft = Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60));
  const timeDisplay = hoursLeft > 1
    ? `~${hoursLeft} ${t("quotaResetIn", lang)}`
    : `~${minutesLeft} ${lang === "th" ? "นาที" : lang === "en" ? "minutes" : lang === "zh" ? "分钟" : lang === "ja" ? "分" : "분"}`;

  const resetDateStr = tomorrow.toLocaleDateString(
    lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : lang === "ko" ? "ko-KR" : "en-US",
    { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
          {t("quotaExhausted", lang)}
        </h3>
        <p className="text-sm text-gray-500 text-center mb-3">
          {lang === "th" ? `คุณใช้งานครบ ${limit} ครั้งแล้ว` : `${limit} ${t("quotaExhaustedMsg", lang)}`}
        </p>
        <div className="bg-emerald-50 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
            <Clock className="h-4 w-4" />
            <span>{lang === "th" ? "ใช้งานได้อีกครั้งในอีก" : lang === "en" ? "Available again in" : lang === "zh" ? "可再次使用于" : lang === "ja" ? "再利用可能まで" : "다시 사용 가능"} {timeDisplay}</span>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 mb-5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            <span>{resetDateStr}</span>
          </div>
        </div>
        <Button className="w-full" onClick={onClose}>
          {t("understood", lang)}
        </Button>
      </div>
    </div>
  );
}

// ===== Credit Needed Popup =====
function CreditNeededPopup({
  needed,
  have,
  model,
  onClose,
  onOpenSettings,
  lang,
}: {
  needed: number;
  have: number;
  model: string;
  onClose: () => void;
  onOpenSettings: () => void;
  lang: string;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-sm mx-4 p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
            <Zap className="h-6 w-6 text-amber-500" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
          {lang === "th" ? "เครดิตไม่เพียงพอ" : lang === "zh" ? "积分不足" : lang === "ja" ? "クレジット不足" : lang === "ko" ? "크레딧 부족" : "Insufficient Credits"}
        </h3>
        <p className="text-[10px] text-center text-gray-400 mb-1 uppercase tracking-widest font-bold">
          {model}
        </p>
        <p className="text-sm text-gray-500 text-center mb-3">
          {lang === "th"
            ? `โมเดลนี้ใช้ ${needed} เครดิต แต่คุณมี ${have} เครดิต`
            : `This model requires ${needed} credit${needed > 1 ? "s" : ""} but you have ${have}`}
        </p>
        <div className="bg-amber-50 rounded-lg p-3 mb-3">
          <div className="text-sm text-amber-700 font-medium text-center">
            {lang === "th" ? "เติมเครดิตด้วยรหัสโปรโมชั่นในการตั้งค่า" : "Top up credits with a promo code in Settings"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {lang === "th" ? "ปิด" : "Close"}
          </Button>
          <Button className="flex-1" onClick={() => { onClose(); onOpenSettings(); }}>
            {lang === "th" ? "เติมเครดิต" : "Top Up"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== Settings Modal =====
type SettingsTab = "general" | "personalization" | "data" | "account" | "admin";

function SettingsModal({
  open,
  onClose,
  settings,
  onSave,
  user,
  quota,
  onLogout,
  onClearHistory,
  onExportHistory,
  onQuotaRefresh,
  sessions,
  memories,
  onMemoriesChange,
  adminModelConfig,
  onAdminModelConfigChange,
  initialTab = "general",
}: {
  open: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (s: AISettings) => void;
  user: { email: string; name: string; picture: string; isAdmin?: boolean } | null;
  quota: { usage: number; limit: number; remaining: number; credits?: number; pricing?: Record<string, number> } | null;
  onLogout: () => void;
  onClearHistory: () => void;
  onExportHistory: () => void;
  onQuotaRefresh: () => void;
  sessions: ChatSession[];
  memories: MemoryItem[];
  onMemoriesChange: () => void;
  adminModelConfig: Record<string, boolean>;
  onAdminModelConfigChange: (config: Record<string, boolean>) => void;
  initialTab?: SettingsTab;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab | "admin">(initialTab);
  
  // Sync activeTab when modal opens with a specific initialTab
  useEffect(() => {
    if (open) {
      if (initialTab === "admin" && !user?.isAdmin) {
        setActiveTab("general");
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [open, initialTab, user]);

  const [draft, setDraft] = useState<AISettings>(settings);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showMemoryClearConfirm, setShowMemoryClearConfirm] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [addingMemory, setAddingMemory] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showMemoryManager, setShowMemoryManager] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<"choose" | "prompt" | "paste" | "file" | "processing" | "review">("choose");
  const [importSource, setImportSource] = useState<"chatgpt" | "claude" | "gemini" | "other">("chatgpt");
  const [importPasteText, setImportPasteText] = useState("");
  const [importParsedMemories, setImportParsedMemories] = useState<string[]>([]);
  const [importSelectedMemories, setImportSelectedMemories] = useState<Set<number>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [importCopied, setImportCopied] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const lang = draft.language;

  const redeemPromo = async () => {
    if (!promoCode.trim() || promoLoading) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const res = await fetch("/api/ai/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redeem", promoCode: promoCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPromoResult({ ok: true, msg: `+${data.added} ${t("credits", lang)}! (${t("creditsBalance", lang)}: ${data.credits})` });
        setPromoCode("");
        onQuotaRefresh();
      } else {
        setPromoResult({ ok: false, msg: data.error || "Error" });
      }
    } catch {
      setPromoResult({ ok: false, msg: "เกิดข้อผิดพลาด" });
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  // Handle file import for memories
  const handleImportFile = async (file: File) => {
    setImportStep("processing");
    setImportLoading(true);

    try {
      const extractMemoriesFromConversations = (conversations: Array<{ mapping?: Record<string, { message?: { content?: { parts?: string[] }; author?: { role?: string } } }>; messages?: Array<{ role?: string; content?: string | Array<{ text?: string }> }> }>) => {
        const allUserMessages: string[] = [];

        for (const conv of conversations) {
          // ChatGPT format: { mapping: { [id]: { message: { content: { parts: [...] }, author: { role } } } } }
          if (conv.mapping) {
            for (const node of Object.values(conv.mapping)) {
              if (node.message?.author?.role === "user" && node.message.content?.parts) {
                const text = node.message.content.parts.join(" ").trim();
                if (text.length > 15 && text.length < 2000) allUserMessages.push(text);
              }
            }
          }
          // Claude format: array of { role, content }
          if (conv.messages) {
            for (const msg of conv.messages) {
              const text = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content.map(c => c.text || "").join(" ") : "";
              if (msg.role === "human" && text.length > 15 && text.length < 2000) {
                allUserMessages.push(text.trim());
              }
            }
          }
        }

        // Extract personal facts from user messages
        const personalPatterns = [
          /(?:ชื่อ|name|i'?m|my name is)\s+([^\s,.]+)/i,
          /(?:เป็น|i am|i work as)\s+(.{5,80})/i,
          /(?:เรียน|study|studying|student)\s+(.{5,80})/i,
          /(?:ทำงาน|work at|working at)\s+(.{5,80})/i,
          /(?:ชอบ|i like|i love|i prefer|i enjoy)\s+(.{5,80})/i,
          /(?:อาศัย|i live|living in|based in)\s+(.{5,80})/i,
          /(?:สนใจ|interested in|passion)\s+(.{5,80})/i,
        ];

        const facts = new Set<string>();
        for (const msg of allUserMessages) {
          for (const pattern of personalPatterns) {
            const match = msg.match(pattern);
            if (match) {
              const fact = match[0].trim();
              if (fact.length > 8 && fact.length <= 300) facts.add(fact);
            }
          }
          // Also grab short self-description messages
          if (msg.length < 150 && /(?:ฉัน|ผม|i am|i'm|my|ของฉัน)/i.test(msg)) {
            facts.add(msg);
          }
        }

        return Array.from(facts).slice(0, 50);
      };

      if (file.name.endsWith(".json")) {
        const text = await file.text();
        const data = JSON.parse(text);
        const conversations = Array.isArray(data) ? data : [data];
        const parsed = extractMemoriesFromConversations(conversations);
        setImportParsedMemories(parsed);
        setImportSelectedMemories(new Set(parsed.map((_, i) => i)));
        setImportStep(parsed.length > 0 ? "review" : "file");
      } else if (file.name.endsWith(".zip")) {
        // Parse ZIP to find JSON files (stored/uncompressed entries only)
        const arrayBuffer = await file.arrayBuffer();
        const textDecoder = new TextDecoder();
        const bytes = new Uint8Array(arrayBuffer);
        const allConversations: Array<{ mapping?: Record<string, unknown>; messages?: Array<unknown> }> = [];
        let pos = 0;
        while (pos < bytes.length - 4) {
          // Local file header signature: PK\x03\x04
          if (bytes[pos] === 0x50 && bytes[pos + 1] === 0x4B && bytes[pos + 2] === 0x03 && bytes[pos + 3] === 0x04) {
            const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
            const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
            const compressedSize = bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24);
            const compressionMethod = bytes[pos + 8] | (bytes[pos + 9] << 8);
            const nameBytes = bytes.slice(pos + 30, pos + 30 + nameLen);
            const fileName = textDecoder.decode(nameBytes);
            const dataStart = pos + 30 + nameLen + extraLen;

            // Handle both stored (0) and deflated (8) via DecompressionStream
            if (fileName.endsWith(".json") && compressedSize > 0) {
              try {
                let jsonText: string;
                if (compressionMethod === 0) {
                  // Stored — no compression
                  jsonText = textDecoder.decode(bytes.slice(dataStart, dataStart + compressedSize));
                } else if (compressionMethod === 8 && typeof DecompressionStream !== "undefined") {
                  // Deflate — use browser DecompressionStream
                  const compressed = bytes.slice(dataStart, dataStart + compressedSize);
                  const ds = new DecompressionStream("deflate-raw");
                  const writer = ds.writable.getWriter();
                  writer.write(compressed);
                  writer.close();
                  const reader = ds.readable.getReader();
                  const chunks: Uint8Array[] = [];
                  let result = await reader.read();
                  while (!result.done) {
                    chunks.push(result.value);
                    result = await reader.read();
                  }
                  const total = chunks.reduce((s, c) => s + c.length, 0);
                  const merged = new Uint8Array(total);
                  let offset = 0;
                  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
                  jsonText = textDecoder.decode(merged);
                } else {
                  pos = dataStart + compressedSize;
                  continue;
                }
                const parsed = JSON.parse(jsonText);
                if (Array.isArray(parsed)) {
                  allConversations.push(...parsed);
                } else {
                  allConversations.push(parsed);
                }
              } catch { /* skip invalid JSON */ }
            }
            pos = dataStart + compressedSize;
          } else {
            pos++;
          }
        }

        type ConvType = Parameters<typeof extractMemoriesFromConversations>[0][0];
        const parsed = extractMemoriesFromConversations(allConversations as ConvType[]);
        setImportParsedMemories(parsed);
        setImportSelectedMemories(new Set(parsed.map((_, i) => i)));
        setImportStep(parsed.length > 0 ? "review" : "file");
      } else {
        setImportStep("file");
      }
    } catch (err) {
      console.error("[Import Error]", err);
      setImportStep("file");
    } finally {
      setImportLoading(false);
    }
  };

  if (!open) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: t("general", lang), icon: <Settings className="h-4 w-4" /> },
    { id: "personalization", label: t("personalization", lang), icon: <UserCircle className="h-4 w-4" /> },
    { id: "data", label: t("dataControl", lang), icon: <Database className="h-4 w-4" /> },
    { id: "account", label: t("account", lang), icon: <User className="h-4 w-4" /> },
    ...(user?.isAdmin ? [{ id: "admin" as SettingsTab, label: lang === "th" ? "ผู้ดูแล" : "Admin", icon: <ShieldCheck className="h-4 w-4" /> }] : []),
  ];

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const MODEL_DESCS: Record<string, string> = {
    auto: t("autoDesc", lang),
    "gemini-3.1-pro": t("proDesc", lang),
    "gemini-2.5-flash": t("flashDesc", lang),
    "claude-sonnet": t("claudeDesc", lang),
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] sm:max-h-[80vh] flex flex-col sm:flex-row overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile tab bar */}
        <div className="sm:hidden flex border-b border-gray-200 bg-gray-50 overflow-x-auto shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-gray-900 font-medium"
                  : "border-transparent text-gray-500"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        {/* Desktop sidebar */}
        <div className="hidden sm:block w-48 bg-gray-50 border-r border-gray-200 py-4 shrink-0">
          <div className="px-4 mb-4">
            <h2 className="text-base font-semibold text-gray-900">{t("settings", lang)}</h2>
          </div>
          <nav className="space-y-0.5 px-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-white text-gray-900 shadow-sm font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">
              {tabs.find(tb => tb.id === activeTab)?.label}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {activeTab === "general" && (
              <>
                {/* Default Model */}
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-1 block">{t("defaultModel", lang)}</label>
                  <p className="text-xs text-gray-500 mb-3">{t("defaultModelDesc", lang)}</p>
                  <div className="space-y-2">
                    {(["auto", "gemini-3.1-pro", "gemini-2.5-flash", "claude-sonnet"] as const).map((value) => (
                      <label
                        key={value}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          draft.defaultModel === value ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input type="radio" name="model" value={value} checked={draft.defaultModel === value}
                          onChange={() => setDraft({ ...draft, defaultModel: value })} className="accent-primary" />
                        <div>
                          <span className="text-sm font-medium text-gray-900">{value === "auto" ? "Auto" : value === "gemini-3.1-pro" ? "Pro 3.1" : value === "claude-sonnet" ? "Claude" : "Flash 2.5"}</span>
                          <p className="text-xs text-gray-500">{MODEL_DESCS[value]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 block">{t("language", lang)}</label>
                    <p className="text-xs text-gray-500">{t("languageDesc", lang)}</p>
                  </div>
                  <select
                    value={draft.language}
                    onChange={(e) => setDraft({ ...draft, language: e.target.value as AISettings["language"] })}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                    ))}
                  </select>
                </div>

                {/* Font Size */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 block">{t("fontSize", lang)}</label>
                    <p className="text-xs text-gray-500">{t("fontSizeDesc", lang)}</p>
                  </div>
                  <select
                    value={draft.fontSize}
                    onChange={(e) => setDraft({ ...draft, fontSize: e.target.value as AISettings["fontSize"] })}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="small">{t("fontSmall", lang)}</option>
                    <option value="medium">{t("fontMedium", lang)}</option>
                    <option value="large">{t("fontLarge", lang)}</option>
                  </select>
                </div>

                {/* Send with Enter */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 block">{t("sendWithEnter", lang)}</label>
                    <p className="text-xs text-gray-500">{t("sendWithEnterDesc", lang)}</p>
                  </div>
                  <button
                    onClick={() => setDraft({ ...draft, sendWithEnter: !draft.sendWithEnter })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${draft.sendWithEnter ? "bg-primary" : "bg-gray-300"}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${draft.sendWithEnter ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              </>
            )}

            {activeTab === "personalization" && (
              <>
                {/* Memory Section */}
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-1 block">{t("memory", lang)}</label>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 mb-3">
                    <div className="flex-1 mr-3">
                      <span className="text-sm font-medium text-gray-900 block">{t("memoryEnabled", lang)}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{t("memoryDesc", lang)}</p>
                    </div>
                    <button
                      onClick={() => setDraft({ ...draft, memoryEnabled: !draft.memoryEnabled })}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${draft.memoryEnabled ? "bg-gray-900" : "bg-gray-300"}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${draft.memoryEnabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>

                  {draft.memoryEnabled && (
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs text-gray-600 font-medium">
                          {memories.length} {t("memoryCount", lang)}
                        </span>
                        <button
                          onClick={() => setShowMemoryManager(!showMemoryManager)}
                          className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                          {t("memoryManage", lang)}
                        </button>
                      </div>

                      {showMemoryManager && (
                        <div className="px-4 py-3 space-y-3">
                          {/* Add new memory */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newMemoryText}
                              onChange={(e) => setNewMemoryText(e.target.value.slice(0, 500))}
                              placeholder={t("memoryAddPlaceholder", lang)}
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newMemoryText.trim()) {
                                  setAddingMemory(true);
                                  fetch("/api/ai/memory", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ content: newMemoryText.trim(), source: "manual" }),
                                  }).then(() => {
                                    setNewMemoryText("");
                                    onMemoriesChange();
                                  }).finally(() => setAddingMemory(false));
                                }
                              }}
                            />
                            <button
                              disabled={!newMemoryText.trim() || addingMemory}
                              onClick={() => {
                                if (!newMemoryText.trim()) return;
                                setAddingMemory(true);
                                fetch("/api/ai/memory", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ content: newMemoryText.trim(), source: "manual" }),
                                }).then(() => {
                                  setNewMemoryText("");
                                  onMemoriesChange();
                                }).finally(() => setAddingMemory(false));
                              }}
                              className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                            >
                              {addingMemory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                              {t("memoryAdd", lang)}
                            </button>
                          </div>

                          {/* Memory list */}
                          {memories.length === 0 ? (
                            <div className="text-center py-6">
                              <Brain className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm text-gray-500">{t("memoryEmpty", lang)}</p>
                              <p className="text-xs text-gray-400 mt-1">{t("memoryEmptyDesc", lang)}</p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {memories.map((mem) => (
                                <div key={mem.id} className="group flex items-start gap-2 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 bg-white transition-colors">
                                  <Brain className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                                  {editingMemoryId === mem.id ? (
                                    <div className="flex-1 flex gap-1.5">
                                      <input
                                        type="text"
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value.slice(0, 500))}
                                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            fetch("/api/ai/memory", {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ id: mem.id, content: editingContent }),
                                            }).then(() => {
                                              setEditingMemoryId(null);
                                              onMemoriesChange();
                                            });
                                          } else if (e.key === "Escape") {
                                            setEditingMemoryId(null);
                                          }
                                        }}
                                      />
                                      <button
                                        onClick={() => {
                                          fetch("/api/ai/memory", {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ id: mem.id, content: editingContent }),
                                          }).then(() => {
                                            setEditingMemoryId(null);
                                            onMemoriesChange();
                                          });
                                        }}
                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button onClick={() => setEditingMemoryId(null)} className="p-1 text-gray-400 hover:bg-gray-50 rounded">
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-700 leading-relaxed">{mem.content}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mem.source === "auto" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                                            {mem.source === "auto" ? t("memoryAuto", lang) : t("memoryManual", lang)}
                                          </span>
                                          <span className="text-[10px] text-gray-400">
                                            {new Date(mem.createdAt).toLocaleDateString(lang === "th" ? "th-TH" : lang === "en" ? "en-US" : lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : "ko-KR")}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => { setEditingMemoryId(mem.id); setEditingContent(mem.content); }}
                                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            fetch(`/api/ai/memory?id=${mem.id}`, { method: "DELETE" })
                                              .then(() => onMemoriesChange());
                                          }}
                                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Clear all memories */}
                          {memories.length > 0 && (
                            <div className="pt-2 border-t border-gray-100">
                              {showMemoryClearConfirm ? (
                                <div className="flex items-center gap-2 justify-end">
                                  <button onClick={() => setShowMemoryClearConfirm(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                                    {t("cancel", lang)}
                                  </button>
                                  <button
                                    onClick={() => {
                                      fetch("/api/ai/memory?all=true", { method: "DELETE" })
                                        .then(() => { onMemoriesChange(); setShowMemoryClearConfirm(false); });
                                    }}
                                    className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1"
                                  >
                                    {t("memoryClearConfirm", lang)}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setShowMemoryClearConfirm(true)}
                                  className="text-xs text-red-500 hover:text-red-600 transition-colors"
                                >
                                  {t("memoryClearAll", lang)}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Import Memories */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gradient-to-r from-blue-50/50 to-purple-50/50">
                  <div className="flex-1 mr-3">
                    <span className="text-sm font-medium text-gray-900 block">{t("importMemory", lang)}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{t("importMemoryDesc", lang)}</p>
                  </div>
                  <button
                    onClick={() => { setShowImportModal(true); setImportStep("choose"); }}
                    className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5 rotate-180" />
                    {t("memoryImport", lang)}
                  </button>
                </div>

                {/* Import Memory Modal */}
                {showImportModal && (
                  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setShowImportModal(false)}>
                    <div
                      className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden animate-scale-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                          {importStep !== "choose" && (
                            <button
                              onClick={() => {
                                if (importStep === "paste") setImportStep("prompt");
                                else if (importStep === "review") setImportStep(importPasteText ? "paste" : "file");
                                else if (importStep === "prompt" || importStep === "file") setImportStep("choose");
                                else setImportStep("choose");
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <ChevronRight className="h-4 w-4 rotate-180" />
                            </button>
                          )}
                          <h3 className="text-base font-semibold text-gray-900">{t("importMemory", lang)}</h3>
                        </div>
                        <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto px-5 py-4">
                        {/* Step 1: Choose method */}
                        {importStep === "choose" && (
                          <div className="space-y-3">
                            <button
                              onClick={() => setImportStep("prompt")}
                              className="w-full flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 transition-colors text-left"
                            >
                              <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                                <MessageSquare className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-900 block">{t("importMethodPrompt", lang)}</span>
                                <p className="text-xs text-gray-500 mt-0.5">{t("importMethodPromptDesc", lang)}</p>
                              </div>
                            </button>
                            <button
                              onClick={() => setImportStep("file")}
                              className="w-full flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 transition-colors text-left"
                            >
                              <div className="p-2 bg-purple-50 rounded-lg shrink-0">
                                <FileText className="h-5 w-5 text-purple-600" />
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-900 block">{t("importMethodFile", lang)}</span>
                                <p className="text-xs text-gray-500 mt-0.5">{t("importMethodFileDesc", lang)}</p>
                              </div>
                            </button>
                          </div>
                        )}

                        {/* Step 2a: Prompt method - choose source and copy prompt */}
                        {importStep === "prompt" && (
                          <div className="space-y-4">
                            <div>
                              <label className="text-xs font-medium text-gray-600 mb-2 block">{t("importFrom", lang)}</label>
                              <div className="flex gap-2">
                                {(["chatgpt", "claude", "gemini", "other"] as const).map((src) => (
                                  <button
                                    key={src}
                                    onClick={() => setImportSource(src)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      importSource === src
                                        ? "bg-gray-900 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                  >
                                    {src === "chatgpt" ? "ChatGPT" : src === "claude" ? "Claude" : src === "gemini" ? "Gemini" : "Other"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 mb-2">{t("importPromptInstruction", lang)}</p>
                              <div className="relative">
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                                  {`Please list everything you remember or know about me from our conversations. Format each item as a separate bullet point starting with "- ". Include:\n\n1. My personal details (name, occupation, education, location)\n2. My preferences and interests\n3. My work/projects I've mentioned\n4. My communication style preferences\n5. Any specific instructions I've given you\n6. Important context about my situation\n\nBe as comprehensive as possible. Format:\n- [fact about me]\n- [another fact]\n...`}
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      `Please list everything you remember or know about me from our conversations. Format each item as a separate bullet point starting with "- ". Include:\n\n1. My personal details (name, occupation, education, location)\n2. My preferences and interests\n3. My work/projects I've mentioned\n4. My communication style preferences\n5. Any specific instructions I've given you\n6. Important context about my situation\n\nBe as comprehensive as possible. Format:\n- [fact about me]\n- [another fact]\n...`
                                    );
                                    setImportCopied(true);
                                    setTimeout(() => setImportCopied(false), 2000);
                                  }}
                                  className="absolute top-2 right-2 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
                                >
                                  {importCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                  {importCopied ? t("importPromptCopied", lang) : t("importPromptCopy", lang)}
                                </button>
                              </div>
                            </div>

                            <button
                              onClick={() => setImportStep("paste")}
                              className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                            >
                              {t("importPasteHere", lang).split("...")[0]}...
                            </button>
                          </div>
                        )}

                        {/* Step 2b: Paste response */}
                        {importStep === "paste" && (
                          <div className="space-y-4">
                            <textarea
                              value={importPasteText}
                              onChange={(e) => setImportPasteText(e.target.value)}
                              placeholder={t("importPasteHere", lang)}
                              rows={10}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                              autoFocus
                            />
                            <button
                              disabled={!importPasteText.trim() || importLoading}
                              onClick={() => {
                                setImportLoading(true);
                                // Parse memories from pasted text
                                const lines = importPasteText.split("\n");
                                const parsed: string[] = [];
                                for (const line of lines) {
                                  const trimmed = line.trim();
                                  // Match bullet points: - , * , • , numbered lists
                                  const match = trimmed.match(/^(?:[-*•]|\d+[.)]\s*)\s*(.+)/);
                                  if (match && match[1].trim().length > 5 && match[1].trim().length <= 500) {
                                    parsed.push(match[1].trim());
                                  } else if (trimmed.length > 10 && trimmed.length <= 500 && !trimmed.startsWith("#") && !trimmed.startsWith("Here") && !trimmed.startsWith("Based on") && !trimmed.startsWith("I ")) {
                                    // Also capture plain sentences that look like memory facts
                                    if (/(?:you|your|ชื่อ|เป็น|ชอบ|ทำงาน|เรียน|อาศัย|สนใจ)/i.test(trimmed)) {
                                      parsed.push(trimmed);
                                    }
                                  }
                                }
                                setImportParsedMemories(parsed);
                                setImportSelectedMemories(new Set(parsed.map((_, i) => i)));
                                setImportLoading(false);
                                if (parsed.length > 0) {
                                  setImportStep("review");
                                }
                              }}
                              className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                              {importLoading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> {t("importParsing", lang)}</>
                              ) : (
                                <>{t("importParseMemories", lang)} ({importPasteText.split("\n").filter(l => l.trim().match(/^[-*•]|\d+[.)]/)).length})</>
                              )}
                            </button>
                            {importPasteText.trim() && importParsedMemories.length === 0 && !importLoading && importStep === "paste" && (
                              <p className="text-xs text-amber-600 text-center">{t("importNoMemories", lang)}</p>
                            )}
                          </div>
                        )}

                        {/* Step 2c: File upload */}
                        {importStep === "file" && (
                          <div className="space-y-4">
                            <div
                              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 hover:bg-gray-50/50 transition-colors cursor-pointer"
                              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
                              onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                                const file = e.dataTransfer.files[0];
                                if (file) handleImportFile(file);
                              }}
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = ".json,.zip";
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleImportFile(file);
                                };
                                input.click();
                              }}
                            >
                              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                              <p className="text-sm text-gray-600 font-medium">{t("importDragDrop", lang)}</p>
                              <p className="text-xs text-gray-400 mt-1">{t("importSupported", lang)}</p>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                              <p className="text-xs font-medium text-gray-700">ChatGPT:</p>
                              <p className="text-[11px] text-gray-500 leading-relaxed">Settings → Data Controls → Export → Download .zip</p>
                              <p className="text-xs font-medium text-gray-700 mt-2">Claude:</p>
                              <p className="text-[11px] text-gray-500 leading-relaxed">Settings → Privacy → Export → Download .json</p>
                            </div>
                          </div>
                        )}

                        {/* Step 3: Processing */}
                        {importStep === "processing" && (
                          <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 text-gray-400 animate-spin mb-3" />
                            <p className="text-sm text-gray-600">{t("importProcessing", lang)}</p>
                          </div>
                        )}

                        {/* Step 4: Review and select */}
                        {importStep === "review" && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-500">
                                {t("importReviewDesc", lang)} ({importSelectedMemories.size}/{importParsedMemories.length})
                              </p>
                              <button
                                onClick={() => {
                                  if (importSelectedMemories.size === importParsedMemories.length) {
                                    setImportSelectedMemories(new Set());
                                  } else {
                                    setImportSelectedMemories(new Set(importParsedMemories.map((_, i) => i)));
                                  }
                                }}
                                className="text-xs text-primary hover:text-primary/80 font-medium"
                              >
                                {importSelectedMemories.size === importParsedMemories.length ? t("importDeselectAll", lang) : t("importSelectAll", lang)}
                              </button>
                            </div>

                            <div className="space-y-1.5 max-h-60 overflow-y-auto">
                              {importParsedMemories.map((mem, idx) => (
                                <label
                                  key={idx}
                                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                    importSelectedMemories.has(idx) ? "border-primary/30 bg-primary/5" : "border-gray-100 hover:border-gray-200"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={importSelectedMemories.has(idx)}
                                    onChange={() => {
                                      const next = new Set(importSelectedMemories);
                                      if (next.has(idx)) next.delete(idx); else next.add(idx);
                                      setImportSelectedMemories(next);
                                    }}
                                    className="mt-0.5 accent-primary shrink-0"
                                  />
                                  <span className="text-xs text-gray-700 leading-relaxed">{mem}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer for review step */}
                      {importStep === "review" && (
                        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
                          <button
                            onClick={() => setShowImportModal(false)}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                          >
                            {t("cancel", lang)}
                          </button>
                          <button
                            disabled={importSelectedMemories.size === 0 || importLoading}
                            onClick={async () => {
                              setImportLoading(true);
                              const selected = importParsedMemories.filter((_, i) => importSelectedMemories.has(i));
                              let successCount = 0;
                              for (const content of selected) {
                                try {
                                  const res = await fetch("/api/ai/memory", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ content, source: "manual" }),
                                  });
                                  if (res.ok) successCount++;
                                } catch { /* skip duplicates/errors */ }
                              }
                              onMemoriesChange();
                              setImportLoading(false);
                              setShowImportModal(false);
                              setImportPasteText("");
                              setImportParsedMemories([]);
                            }}
                            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                          >
                            {importLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 rotate-180" />}
                            {t("importSelected", lang)} ({importSelectedMemories.size})
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Response Style */}
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-1 block">{t("responseStyle", lang)}</label>
                  <p className="text-xs text-gray-500 mb-3">{t("responseStyleDesc", lang)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "concise" as const, label: t("concise", lang), icon: <Zap className="h-4 w-4" />, desc: t("conciseDesc", lang) },
                      { value: "detailed" as const, label: t("detailed", lang), icon: <MessageCircle className="h-4 w-4" />, desc: t("detailedDesc", lang) },
                    ].map((opt) => (
                      <button key={opt.value} onClick={() => setDraft({ ...draft, responseStyle: opt.value })}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                          draft.responseStyle === opt.value ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                        }`}>
                        {opt.icon}
                        <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                        <span className="text-[11px] text-gray-500">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-900 mb-1 block">{t("customInstructions", lang)}</label>
                  <p className="text-xs text-gray-500 mb-3">{t("customInstructionsDesc", lang)}</p>
                  <textarea
                    value={draft.customInstructions}
                    onChange={(e) => setDraft({ ...draft, customInstructions: e.target.value.slice(0, 500) })}
                    placeholder={t("customInstructionsPlaceholder", lang)}
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1 text-right">{draft.customInstructions.length}/500</p>
                </div>
              </>
            )}

            {activeTab === "data" && (
              <>
                {/* Import JSON */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                  <div>
                    <span className="text-sm font-medium text-gray-900 block">{t("importJSON", lang)}</span>
                    <p className="text-xs text-gray-500">JSON</p>
                  </div>
                  <label className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5 rotate-180" />
                    {t("memoryImport", lang)}
                    <input type="file" accept=".json" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const data = JSON.parse(ev.target?.result as string);
                          if (Array.isArray(data)) {
                            // Import sessions
                            const imported = data.map((s: ChatSession) => ({
                              ...s,
                              id: s.id || `imported_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                            }));
                            const existing = JSON.parse(localStorage.getItem("allquiz_ai_sessions") || "[]");
                            localStorage.setItem("allquiz_ai_sessions", JSON.stringify([...imported, ...existing]));
                            window.location.reload();
                          }
                        } catch { /* ignore invalid files */ }
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }} />
                  </label>
                </div>

                {/* Export History */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                  <div>
                    <span className="text-sm font-medium text-gray-900 block">{t("exportHistory", lang)}</span>
                    <p className="text-xs text-gray-500">{t("exportHistoryDesc", lang)}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={onExportHistory} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    {t("export", lang)}
                  </Button>
                </div>

                {/* Revoke personalization */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-orange-100 bg-orange-50/30">
                  <div>
                    <span className="text-sm font-medium text-gray-900 block">{t("revokePersonalization", lang)}</span>
                    <p className="text-xs text-gray-500">{t("memory", lang)}, {t("customInstructions", lang)}</p>
                  </div>
                  <button
                    onClick={() => {
                      // Clear memories and custom instructions
                      fetch("/api/ai/memory?all=true", { method: "DELETE" }).then(() => onMemoriesChange());
                      onSave({ ...settings, customInstructions: "", memoryEnabled: true });
                    }}
                    className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    {t("revoke", lang)}
                  </button>
                </div>

                {/* Clear TTS cache */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-red-100 bg-red-50/30">
                  <div>
                    <span className="text-sm font-medium text-gray-900 block">{t("clearTTSCache", lang)}</span>
                    <p className="text-xs text-gray-500">Audio cache</p>
                  </div>
                  <button
                    onClick={() => {
                      // Clear any cached TTS audio from localStorage
                      const keys = Object.keys(localStorage).filter(k => k.startsWith("tts_cache_"));
                      keys.forEach(k => localStorage.removeItem(k));
                    }}
                    className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    {t("deleteAll", lang)}
                  </button>
                </div>

                {/* Clear all chats */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-red-100 bg-red-50/30">
                  <div>
                    <span className="text-sm font-medium text-gray-900 block">{t("clearAllChats", lang)}</span>
                    <p className="text-xs text-gray-500">{sessions.length} {t("chatsCount", lang)}</p>
                  </div>
                  {showClearConfirm ? (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)}>{t("cancel", lang)}</Button>
                      <Button variant="destructive" size="sm" onClick={() => { onClearHistory(); setShowClearConfirm(false); }} className="gap-1.5">
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("confirmDelete", lang)}
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      {t("deleteAll", lang)}
                    </button>
                  )}
                </div>
              </>
            )}

            {activeTab === "account" && (
              <>
                {user && (
                  <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200">
                    <img src={user.picture} alt="" className="h-12 w-12 rounded-full border border-gray-200" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 block">{user.name}</span>
                      <span className="text-xs text-gray-500">{user.email}</span>
                    </div>
                  </div>
                )}

                {/* Credit Balance */}
                {quota && (
                  <div className="p-4 rounded-lg border border-gray-200 bg-gradient-to-r from-amber-50/50 to-orange-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-900">{t("creditsBalance", lang)}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-amber-600 tabular-nums">{quota.credits ?? 0}</span>
                        <span className="text-xs text-gray-500">{t("credits", lang)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{t("creditsCostInfo", lang)}</p>

                    {/* Promo Code */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
                        placeholder={t("creditsPromoPlaceholder", lang)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && promoCode.trim()) redeemPromo();
                        }}
                      />
                      <button
                        disabled={!promoCode.trim() || promoLoading}
                        onClick={redeemPromo}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                      >
                        {promoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {t("creditsRedeem", lang)}
                      </button>
                    </div>
                    {promoResult && (
                      <p className={`text-xs mt-2 ${promoResult.ok ? "text-emerald-600" : "text-red-500"}`}>
                        {promoResult.msg}
                      </p>
                    )}
                  </div>
                )}

                {/* Model Pricing Table */}
                {quota?.pricing && (
                  <div className="p-4 rounded-lg border border-gray-200">
                    <span className="text-sm font-semibold text-gray-900 block mb-3">{t("creditsPerUse", lang)}</span>
                    <div className="space-y-1.5">
                      {[
                        { label: "Auto / Flash / Llama 4", cost: 0 },
                        { label: "Claude Sonnet / Gemini Pro (OR)", cost: 1 },
                        { label: "Gemini 3.1 Pro / GPT-4.1 / DeepSeek R1", cost: 2 },
                        { label: "o4-mini", cost: 3 },
                        { label: "Image Generation", cost: 5 },
                      ].map((tier) => (
                        <div key={tier.label} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-gray-50">
                          <span className="text-xs text-gray-700">{tier.label}</span>
                          <span className={`text-xs font-semibold tabular-nums ${tier.cost === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                            {tier.cost === 0 ? t("creditsFree", lang) : `${tier.cost} ${t("credits", lang)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily Free Quota */}
                {quota && (
                  <div className="p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-900">{t("quota", lang)} ({t("creditsFree", lang)})</span>
                      <span className={`text-sm font-semibold tabular-nums ${quota.remaining <= 3 ? "text-red-500" : "text-gray-900"}`}>
                        {quota.usage}/{quota.limit} {t("times", lang)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all duration-500 ${quota.remaining <= 3 ? "bg-red-500" : "bg-emerald-500"}`}
                        style={{ width: `${(quota.usage / quota.limit) * 100}%` }} />
                    </div>
                    <p className="text-xs text-gray-500">
                      {t("remaining", lang)} {quota.remaining} {t("times", lang)} {quota.remaining <= 3 && `· ${t("quotaReset", lang)}`}
                    </p>
                  </div>
                )}

                <div className="pt-2">
                  <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors px-1">
                    <LogOut className="h-4 w-4" />
                    {t("logout", lang)}
                  </button>
                </div>
              </>
            )}

            {activeTab === "admin" && (
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-1 block">
                    {lang === "th" ? "จัดการการเข้าถึงโมเดล" : "Model Access Management"}
                  </label>
                  <p className="text-xs text-gray-500 mb-4">
                    {lang === "th" ? "เปิด-ปิดโมเดลที่จะให้แสดงในหน้าแอป" : "Enable or disable models to be shown in the app"}
                  </p>
                  
                  <div className="space-y-3">
                    {Object.entries(adminModelConfig).map(([provider, enabled]) => (
                      <div key={provider} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                            {provider === 'gemini' ? <Zap className="h-4 w-4" /> : 
                             provider === 'claude' ? <Brain className="h-4 w-4" /> : 
                             provider === 'thaillm' ? <Sparkles className="h-4 w-4" /> :
                             provider === 'groq' ? <Zap className="h-4 w-4" /> :
                             provider === 'github' ? <Github className="h-4 w-4" /> :
                             <Database className="h-4 w-4" />}
                          </div>
                          <div>
                            <span className="text-sm font-bold text-gray-900 capitalize">{provider}</span>
                            <p className="text-[10px] text-gray-400">{enabled ? 'Active' : 'Disabled'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => onAdminModelConfigChange({ ...adminModelConfig, [provider]: !enabled })}
                          className={`relative w-11 h-6 rounded-full transition-all duration-200 ${enabled ? "bg-emerald-500" : "bg-gray-200"}`}
                        >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {(activeTab === "general" || activeTab === "personalization") && (
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>{t("cancel", lang)}</Button>
              <Button onClick={handleSave}>{t("save", lang)}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FileData {
  name: string;
  data: string; // base64
  type: string;
}

interface SearchSource {
  title: string;
  url: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  files?: FileData[];
  images?: string[];      // generated images (data URLs)
  sources?: SearchSource[]; // web search sources
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt?: number;
  folderId?: string;
}

interface Folder {
  id: string;
  name: string;
  sessionIds: string[];
  isOpen?: boolean;
}

function generateTitle(firstMessage: string): string {
  // Strip file references and trim
  let title = firstMessage.replace(/\(.*?ไฟล์\)/g, "").trim();
  // Truncate intelligently at word boundary
  if (title.length > 40) {
    title = title.slice(0, 37).replace(/\s+\S*$/, "") + "...";
  }
  return title || "แชทใหม่";
}

function getDateGroup(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0 && now.getDate() === date.getDate()) return "วันนี้";
  if (diffDays <= 1 && now.getDate() - date.getDate() === 1) return "เมื่อวาน";
  if (diffDays <= 7) return "7 วันที่ผ่านมา";
  if (diffDays <= 30) return "30 วันที่ผ่านมา";
  return date.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

function groupSessionsByDate(sessions: ChatSession[]): Map<string, ChatSession[]> {
  const groups = new Map<string, ChatSession[]>();
  for (const session of sessions) {
    const group = getDateGroup(session.updatedAt || session.createdAt);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(session);
  }
  return groups;
}

const SUGGESTIONS = [
  "สรุปเนื้อหาทั้งหมดที่มีในระบบ",
  "ช่วยตรวจคำตอบข้อสอบให้หน่อย",
  "มีวิชาอะไรบ้างในระบบ?",
  "📷 ถ่ายรูปข้อสอบแล้วส่งมาให้ AI ตรวจ",
];

export default function AIChatPage() {
  // Core state definitions (Moved to top to avoid TDZ issues)
  const [user, setUser] = useState<{ email: string; name: string; picture: string; isAdmin?: boolean } | null>(null);
  const [quota, setQuota] = useState<{ usage: number; limit: number; remaining: number; credits?: number; pricing?: Record<string, number> } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [gsiReady, setGsiReady] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettings>(DEFAULT_SETTINGS);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const messages = useMemo(() => {
    if (!activeSessionId) return [];
    return sessions.find(s => s.id === activeSessionId)?.messages || [];
  }, [activeSessionId, sessions]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const [folders, setFolders] = useState<Folder[]>([]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [movingSession, setMovingSession] = useState<ChatSession | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingSession, setSharingSession] = useState<ChatSession | null>(null);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);

  // TTS State
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  
  // Admin Model Management State
  const [adminModelConfig, setAdminModelConfig] = useState<Record<string, boolean>>({
    "gemini": true,
    "claude": true,
    "openrouter": true,
    "thaillm": true,
    "groq": true,
    "github": true
  });


  // Load Admin Model Config
  useEffect(() => {
    const saved = localStorage.getItem("allquiz_admin_models");
    if (saved) {
      try {
        setAdminModelConfig(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Save Admin Model Config
  useEffect(() => {
    localStorage.setItem("allquiz_admin_models", JSON.stringify(adminModelConfig));
  }, [adminModelConfig]);

  const handleSpeak = useCallback((text: string, index: number) => {
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    
    // Clean text: strip thinking blocks and markdown
    const { answer } = parseThinking(text);
    const cleanText = (answer || text)
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/<[^>]*>?/gm, "") // Remove HTML tags
      .replace(/\[.*?\]/g, "") // Remove references
      .replace(/\*|_|#/g, "") // Remove markdown
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Auto-detect language
    const hasThai = /[\u0E00-\u0E7F]/.test(cleanText);
    utterance.lang = hasThai ? "th-TH" : "en-US";
    utterance.rate = 1.0;
    
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  }, [speakingIndex]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" | "warning" = "info") => {
    if (type === "success") toast.success(msg);
    else if (type === "error") toast.error(msg);
    else if (type === "warning") toast.warning(msg);
    else toast.info(msg);
  }, []);

  const isFreeModel = useCallback((modelValue: string) => {
    const cost = quota?.pricing?.[modelValue];
    return cost === 0;
  }, [quota]);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "destructive" | "primary";
    onConfirm: () => void;
  } | null>(null);

  const askConfirm = useCallback((params: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "destructive" | "primary";
    onConfirm: () => void;
  }) => {
    setConfirmDialog({ ...params, isOpen: true });
  }, []);

  const moveSessionToFolder = (sessionId: string, folderId: string | null) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, folderId: folderId || undefined } : s
    ));

    setFolders(prev => prev.map(f => {
      const updatedSessionIds = f.sessionIds.filter(id => id !== sessionId);
      if (f.id === folderId) {
        if (!updatedSessionIds.includes(sessionId)) {
          return { ...f, sessionIds: [...updatedSessionIds, sessionId] };
        }
      }
      return { ...f, sessionIds: updatedSessionIds };
    }));
  };

  const createFolder = () => {
    const newFolder: Folder = {
      id: Date.now().toString(),
      name: aiSettings.language === "th" ? "โฟลเดอร์ใหม่" : "New Folder",
      sessionIds: [],
      isOpen: true
    };
    setFolders(prev => [...prev, newFolder]);
  };

  const toggleFolder = (folderId: string) => {
    setFolders(prev => prev.map(f =>
      f.id === folderId ? { ...f, isOpen: !f.isOpen } : f
    ));
  };

  const deleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    askConfirm({
      title: aiSettings.language === "th" ? "ยืนยันการลบโฟลเดอร์" : "Confirm Delete Folder",
      message: aiSettings.language === "th" 
        ? "คุณแน่ใจหรือไม่ว่าต้องการลบโฟลเดอร์นี้? แชทภายในจะถูกย้ายออกไปอยู่ข้างนอก และข้อมูลโฟลเดอร์จะกู้คืนไม่ได้" 
        : "Are you sure you want to delete this folder? Chats inside will be moved out, and this folder cannot be recovered.",
      confirmText: aiSettings.language === "th" ? "ลบโฟลเดอร์" : "Delete Folder",
      variant: "destructive",
      onConfirm: () => {
        const folder = folders.find(f => f.id === folderId);
        if (folder) {
          setSessions(prev => prev.map(s =>
            folder.sessionIds.includes(s.id) ? { ...s, folderId: undefined } : s
          ));
        }
        setFolders(prev => prev.filter(f => f.id !== folderId));
        showToast(aiSettings.language === "th" ? "ลบโฟลเดอร์เรียบร้อยแล้ว" : "Folder deleted", "success");
      }
    });
  };

  const renameFolder = (folderId: string) => {
    if (!editingFolderName.trim()) {
      setEditingFolderId(null);
      return;
    }
    setFolders(prev => prev.map(f =>
      f.id === folderId ? { ...f, name: editingFolderName.trim() } : f
    ));
    setEditingFolderId(null);
  };

  const startEditingFolder = (folder: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [showQuotaPopup, setShowQuotaPopup] = useState(false);
  const [showCreditPopup, setShowCreditPopup] = useState<{ needed: number; have: number; model: string } | null>(null);
  const [apiHealth, setApiHealth] = useState<Record<string, boolean>>({ gemini: true, claude: true, openrouter: true, thaillm: true, groq: true, github: true });
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"none" | "webSearch" | "generateImage" | "canvas" | "summarize">("none");
  const [searchingUrls, setSearchingUrls] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [openMenuId]);

  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [artifactVersions, setArtifactVersions] = useState<Artifact[]>([]);
  const [isArtifactComplete, setIsArtifactComplete] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(600);
  useEffect(() => {
    setCanvasWidth(Math.max(550, Math.floor(window.innerWidth * 0.45)));
  }, []);
  const [isResizingCanvas, setIsResizingCanvas] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const canvasResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Fetch real health status from API
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/health");
      if (res.ok) {
        const data = await res.json();
        setApiHealth({
          gemini: data.gemini,
          claude: data.claude,
          openrouter: data.openrouter,
          thaillm: data.thaillm,
          groq: data.groq,
          github: data.github
        });
      }
    } catch (e) {
      console.warn("Failed to fetch API health:", e);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Refresh health every 5 minutes
    const timer = setInterval(fetchHealth, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchHealth]);

  const [selectedModel, setSelectedModel] = useState("auto"); // auto, gemini-1.5-pro, gemini-1.5-flash
  const [generatingStatus, setGeneratingStatus] = useState("กำลังวิเคราะห์...");
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categorized Model Options
  const MODEL_CATEGORIES = useMemo(() => {
    const cats = [
      {
        name: aiSettings.language === "th" ? "แนะนำ" : "Recommended",
        models: [
          { value: "auto", label: "Auto Select", icon: <Sparkles className="h-3.5 w-3.5 text-amber-500" />, desc: "ดีที่สุดตามสถานะ", provider: "all" },
          { value: "gemini-3.1-pro", label: "Pro 3.1", icon: <Zap className="h-3.5 w-3.5 text-violet-500" />, desc: "Gemini Direct", provider: "gemini" },
        ]
      },
      {
        name: aiSettings.language === "th" ? "โมเดลไทย" : "Thai Models",
        models: [
          { value: "thaillm/typhoon-v1.5x-70b-instruct", label: "Typhoon 1.5X", icon: <Sparkles className="h-3.5 w-3.5 text-red-500" />, desc: "Thai LLM", provider: "thaillm" },
        ]
      },
      {
        name: "Claude & DeepSeek (OpenRouter)",
        models: [
          { value: "claude-sonnet", label: "Claude", icon: <Brain className="h-3.5 w-3.5 text-orange-500" />, desc: "Anthropic", provider: "claude" },
          { value: "openrouter/deepseek/deepseek-r1", label: "DeepSeek R1", icon: <Brain className="h-3.5 w-3.5 text-blue-500" />, desc: "OpenRouter", provider: "openrouter" },
          { value: "openrouter/meta-llama/llama-4-maverick", label: "Llama 4", icon: <Brain className="h-3.5 w-3.5 text-indigo-500" />, desc: "OpenRouter", provider: "openrouter" },
        ]
      },
      {
          name: "Others",
          models: [
            { value: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B", icon: <Zap className="h-3.5 w-3.5 text-orange-500" />, desc: "Groq (Fast)", provider: "groq" },
            { value: "github/gpt-4o", label: "GPT-4o", icon: <Brain className="h-3.5 w-3.5 text-gray-700" />, desc: "GitHub Models", provider: "github" },
          ]
      }
    ];

    // Filter categories and models based on admin config
    return cats.map(cat => ({
      ...cat,
      models: cat.models.filter(m => m.provider === "all" || (adminModelConfig as Record<string, boolean>)[m.provider] !== false)
    })).filter(cat => cat.models.length > 0);
  }, [aiSettings.language, adminModelConfig]);

  const ALL_MODELS = useMemo(() => MODEL_CATEGORIES.flatMap(c => c.models), [MODEL_CATEGORIES]);

  // Ensure selectedModel is always valid when admin configuration changes
  useEffect(() => {
    if (selectedModel !== "auto") {
      const exists = ALL_MODELS.some(m => m.value === selectedModel);
      if (!exists) {
        setSelectedModel("auto");
      }
    }
  }, [ALL_MODELS, selectedModel]);

  // Check if a model is available based on API health AND Admin configuration
  const isModelAvailable = useCallback((modelValue: string): boolean => {
    if (modelValue === "auto") {
      return (adminModelConfig.gemini && apiHealth.gemini) || 
             (adminModelConfig.thaillm && apiHealth.thaillm) || 
             (adminModelConfig.openrouter && apiHealth.openrouter) || 
             (adminModelConfig.claude && apiHealth.claude) || 
             (adminModelConfig.groq && apiHealth.groq) || 
             (adminModelConfig.github && apiHealth.github);
    }
    const model = ALL_MODELS.find(m => m.value === modelValue);
    if (!model) return false;
    
    // Check if provider is enabled by admin
    if (model.provider !== "all" && (adminModelConfig as Record<string, boolean>)[model.provider] === false) return false;
    
    return (apiHealth as Record<string, boolean>)[model.provider] ?? false;
  }, [apiHealth, ALL_MODELS, adminModelConfig]);

  // Smart Auto-Fallback Logic
  const getEffectiveModel = useCallback((requestedModel: string): string => {
    if (requestedModel !== "auto") {
      if (isModelAvailable(requestedModel)) return requestedModel;

      // If requested model is down or disabled, show a toast and find fallback
      const modelName = ALL_MODELS.find(m => m.value === requestedModel)?.label || requestedModel;
      showToast(
        aiSettings.language === "th"
          ? `โมเดล ${modelName} ไม่พร้อมใช้งาน กำลังสลับไปใช้โมเดลที่ดีที่สุดแทน`
          : `Model ${modelName} is unavailable. Switching to best fallback.`,
        "warning"
      );
    }

    // Auto-selection priority (respecting admin disabled models): Gemini -> ThaiLLM -> OpenRouter
    if (adminModelConfig.gemini && apiHealth.gemini) return "gemini-3.1-pro";
    if (adminModelConfig.thaillm && apiHealth.thaillm) return "thaillm/typhoon-v1.5x-70b-instruct";
    if (adminModelConfig.openrouter && apiHealth.openrouter) return "openrouter/deepseek/deepseek-r1";
    if (adminModelConfig.claude && apiHealth.claude) return "claude-sonnet";
    if (adminModelConfig.groq && apiHealth.groq) return "groq/llama-3.3-70b-versatile";
    if (adminModelConfig.github && apiHealth.github) return "github/gpt-4o";

    return requestedModel; // Last resort
  }, [apiHealth, isModelAvailable, ALL_MODELS, aiSettings.language, showToast, adminModelConfig]);

  const currentModel = ALL_MODELS.find(m => m.value === selectedModel) || ALL_MODELS[0];

  const handleCanvasResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    canvasResizeRef.current = { startX: e.clientX, startWidth: canvasWidth };
    setIsResizingCanvas(true);
  };

  // Close model picker / tools menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setIsModelPickerOpen(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    if (isModelPickerOpen || isToolsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isModelPickerOpen, isToolsMenuOpen]);

  // Canvas resize drag handlers
  useEffect(() => {
    if (!isResizingCanvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasResizeRef.current) return;
      const delta = canvasResizeRef.current.startX - e.clientX;
      const newWidth = Math.min(Math.max(canvasResizeRef.current.startWidth + delta, 400), window.innerWidth * 0.75);
      setCanvasWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingCanvas(false);
      canvasResizeRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingCanvas]);

  const fetchAuthAndQuota = useCallback(async () => {
    try {
      const authRes = await fetch("/api/auth/user");
      const authData = await authRes.json();
      
      if (authData.authenticated) {
        setUser(authData.user);
        // If authenticated, fetch quota
        const quotaRes = await fetch("/api/ai/quota");
        const quotaData = await quotaRes.json();
        setQuota(quotaData);
      } else {
        setUser(null);
        setQuota(null);
      }
    } catch {
      // ignore
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const refreshQuota = useCallback(() => {
    fetch("/api/ai/quota").then(r => r.json()).then(data => setQuota(data)).catch(() => {});
  }, []);

  const handleGoogleResponse = useCallback(
    async (response: { credential: string }) => {
      setAuthLoading(true);
      try {
        const res = await fetch("/api/auth/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();
        if (data.success) {
          await fetchAuthAndQuota();
        }
      } catch {
        // error
      } finally {
        setAuthLoading(false);
      }
    },
    [fetchAuthAndQuota]
  );

  useEffect(() => {
    fetchAuthAndQuota();
  }, [fetchAuthAndQuota]);

  useEffect(() => {
    if (user || !authLoading) return;
    // Load GSI only if not logged in
  }, [user, authLoading]);

  // Handle GSI initialization
  useEffect(() => {
    if (user || authLoading) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline", size: "large", width: 300, text: "signin_with"
        });
        setGsiReady(true);
      }
    };
    document.head.appendChild(script);
    return () => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) existing.remove();
    };
  }, [user, authLoading, handleGoogleResponse]);

  const loadMemories = useCallback(() => {
    fetch("/api/ai/memory").then(r => r.json()).then(data => {
      if (data.memories) setMemories(data.memories);
    }).catch(() => {});
  }, []);

  // Load settings (local first, then sync from server if logged in)
  useEffect(() => {
    const loaded = loadSettings();
    setAISettings(loaded);
    setSelectedModel(loaded.defaultModel);

    // Fetch API health check
    fetch("/api/ai/health").then(r => r.json()).then(data => {
      setApiHealth(data);
    }).catch(() => {});

    // Load per-account settings from server (overrides local if exists)
    loadSettingsFromServer().then(serverSettings => {
      if (serverSettings) {
        setAISettings(serverSettings);
        setSelectedModel(serverSettings.defaultModel);
        saveSettings(serverSettings); // sync to local
      }
    });

    // Load memories
    loadMemories();
  }, [loadMemories]);

  const [isLoaded, setIsLoaded] = useState(false);

  // Load folders from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("allquiz_ai_folders");
    if (saved) {
      try {
        setFolders(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load folders", e);
      }
    }
  }, []);

  // Save folders to localStorage
  useEffect(() => {
    localStorage.setItem("allquiz_ai_folders", JSON.stringify(folders));
  }, [folders]);

  // Load sessions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("allquiz_ai_sessions");
    // Try other common keys for migration if empty
    const backupKeys = ["ai_sessions", "chat_sessions", "chat_history"];
    
    let parsedData: ChatSession[] = [];
    
    if (saved) {
      try {
        parsedData = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load chat history", e);
      }
    }
    
    if (parsedData.length === 0) {
      for (const key of backupKeys) {
        const backup = localStorage.getItem(key);
        if (backup) {
          try {
            const data = JSON.parse(backup);
            if (Array.isArray(data) && data.length > 0) {
              parsedData = data;
              console.log(`Migrated sessions from ${key}`);
              break;
            }
          } catch (e) {}
        }
      }
    }

    if (parsedData.length > 0) {
      setSessions(parsedData);
      setActiveSessionId(parsedData[0].id);
    }
    
    setIsLoaded(true);
  }, []);

  // Save sessions to localStorage (strip large base64 images to avoid QuotaExceededError)
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      // Strip base64 image data from generated images before saving
      const sessionsToSave = sessions.map(s => ({
        ...s,
        messages: s.messages.map(m => ({
          ...m,
          // Replace large base64 images with placeholder URLs
          images: m.images?.map(img =>
            img.length > 1000 ? `[image-placeholder-${img.slice(-20)}]` : img
          ),
          // Also limit file data size in saved messages
          files: m.files?.map(f => ({
            ...f,
            data: f.data.length > 50000 ? `[file-too-large:${f.name}]` : f.data,
          })),
        })),
      }));
      localStorage.setItem("allquiz_ai_sessions", JSON.stringify(sessionsToSave));
    } catch (e) {
      console.warn("Failed to save sessions to localStorage:", e);
      // If still too large, try saving without file data at all
      try {
        const minimalSessions = sessions.map(s => ({
          ...s,
          messages: s.messages.map(m => ({
            role: m.role,
            content: m.content,
            sources: m.sources,
          })),
        }));
        localStorage.setItem("allquiz_ai_sessions", JSON.stringify(minimalSessions));
      } catch {
        console.error("Cannot save sessions - localStorage full");
      }
    }
  }, [sessions, isLoaded]);

  const createNewSession = (folderId?: string) => {
    const now = Date.now();
    const newSession: ChatSession = {
      id: now.toString(),
      title: aiSettings.language === "th" ? "แชทใหม่" : "New Chat",
      messages: [],
      createdAt: now,
      updatedAt: now,
      folderId: folderId
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    askConfirm({
      title: aiSettings.language === "th" ? "ยืนยันการลบแชท" : "Confirm Delete Chat",
      message: aiSettings.language === "th" 
        ? "คุณแน่ใจหรือไม่ว่าต้องการลบแชทนี้? ข้อมูลจะไม่สามารถกู้คืนได้" 
        : "Are you sure you want to delete this chat? This action cannot be undone.",
      confirmText: aiSettings.language === "th" ? "ลบแชท" : "Delete",
      variant: "destructive",
      onConfirm: () => {
        const updated = sessions.filter((s) => s.id !== id);
        setSessions(updated);
        if (activeSessionId === id) {
          if (updated.length > 0) {
            setActiveSessionId(updated[0].id);
          } else {
            setActiveSessionId(null);
          }
        }
        showToast(aiSettings.language === "th" ? "ลบแชทเรียบร้อยแล้ว" : "Chat deleted", "success");
      }
    });
  };

  const renameSession = (id: string) => {
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    setSessions(prev => prev.map(s =>
      s.id === id ? { ...s, title: editingTitle.trim() } : s
    ));
    setEditingSessionId(null);
  };

  const startEditing = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const filteredSessions = useMemo(() => {
    const list = sidebarSearch.trim()
      ? sessions.filter(s =>
          s.title.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
          s.messages.some(m => m.content.toLowerCase().includes(sidebarSearch.toLowerCase()))
        )
      : sessions;

    // Sort: Newest/Most recently active first
    return [...list].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  }, [sessions, sidebarSearch]);

  const groupedSessions = useMemo(() => {
    // Only group sessions NOT in a folder
    const sessionsNotInFolders = filteredSessions.filter(s => !s.folderId);
    return groupSessionsByDate(sessionsNotInFolders);
  }, [filteredSessions]);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const scrollToBottom = useCallback((force = false) => {
    if (force || isAtBottomRef.current) {
      setTimeout(() => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    } else {
      setShowScrollButton(true);
    }
  }, []);

  // Handle scroll events to show/hide button
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setIsAtBottom(prev => {
      if (prev !== atBottom) return atBottom;
      return prev;
    });
    
    if (atBottom) {
      setShowScrollButton(prev => {
        if (prev !== false) return false;
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll);
      return () => el.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: FileData[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Max 4MB per file
      if (file.size > 4 * 1024 * 1024) {
        showToast(
          aiSettings.language === "th" 
            ? `ไฟล์ ${file.name} ใหญ่เกินไป (สูงสุด 4MB)` 
            : `File ${file.name} is too large (max 4MB)`, 
          "error"
        );
        continue;
      }

      if (attachments.length + newFiles.length >= 5) {
        showToast(
          aiSettings.language === "th" 
            ? "อัปโหลดได้สูงสุด 5 ไฟล์ต่อครั้ง" 
            : "You can upload up to 5 files at once", 
          "warning"
        );
        break;
      }
      const reader = new FileReader();
      const filePromise = new Promise<FileData>((resolve) => {
        reader.onloadend = () => {
          resolve({
            name: file.name,
            data: reader.result as string,
            type: file.type,
          });
        };
      });
      reader.readAsDataURL(file);
      newFiles.push(await filePromise);
    }

    setAttachments((prev) => [...prev, ...newFiles]);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Voice input with Web Speech API
  const toggleMic = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast(
        aiSettings.language === "th" 
          ? "เบราว์เซอร์ไม่รองรับการรับเสียง" 
          : "Browser does not support speech recognition", 
        "error"
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = aiSettings.language === "th" ? "th-TH" : aiSettings.language === "zh" ? "zh-CN" : aiSettings.language === "ja" ? "ja-JP" : aiSettings.language === "ko" ? "ko-KR" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    let finalTranscript = "";
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInput((prev) => {
        const base = prev.replace(/\u200B.*$/, "").trimEnd();
        const combined = (base ? base + " " : "") + finalTranscript + (interim ? "\u200B" + interim : "");
        return combined;
      });
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
      // Clean up zero-width space markers from interim results
      setInput((prev) => prev.replace(/\u200B/g, ""));
    };

    recognition.start();
    setIsRecording(true);
  }, [isRecording, aiSettings.language, showToast]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    const hasAttachments = attachments.length > 0;

    if ((!msg && !hasAttachments) || loading) return;

    // Check quota client-side for better UX
    if (quota && quota.usage >= quota.limit && isFreeModel(selectedModel)) {
      setShowQuotaPopup(true);
      return;
    }

    // Create session if none exists
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const now = Date.now();
      const newSession: ChatSession = {
        id: now.toString(),
        title: generateTitle(msg) || "แชทภาพ",
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      currentSessionId = newSession.id;
    }

    const userMessage: Message = {
      role: "user",
      content: msg || (hasAttachments ? `ช่วยตรวจสอบไฟล์เหล่านี้ให้หน่อย (${attachments.length} ไฟล์)` : ""),
      files: hasAttachments ? [...attachments] : undefined,
    };

    // Update session title on first user message if it's default, always update updatedAt
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId && s.messages.length === 0) {
        return { ...s, title: generateTitle(msg) || "แชทที่มีไฟล์", messages: [userMessage], updatedAt: Date.now() };
      }
      if (s.id === currentSessionId) {
        return { ...s, messages: [...s.messages, userMessage], updatedAt: Date.now() };
      }
      return s;
    }));

    setInput("");
    setAttachments([]);
    setLoading(true);

    // Set initial thinking status based on active tool
    let initialStatus = "กำลังวิเคราะห์ข้อมูล...";
    if (activeTool === "generateImage") {
      initialStatus = "กำลังสร้างรูปภาพ...";
    } else if (activeTool === "webSearch") {
      initialStatus = "กำลังค้นหาข้อมูลจากเว็บ...";
    } else if (hasAttachments) {
      const hasPdf = attachments.some(a => a.type === "application/pdf");
      initialStatus = hasPdf ? "กำลังอ่านข้อมูลจาก PDF และวิเคราะห์..." : "กำลังวิเคราะห์รูปภาพและโจทย์...";
    } else if (msg.includes("สรุป")) {
      initialStatus = "กำลังประมวลผลและสรุปเนื้อหา...";
    } else if (msg.includes("ตรวจ")) {
      initialStatus = "กำลังเปรียบเทียบข้อมูลและตรวจคำตอบ...";
    }
    setGeneratingStatus(initialStatus);

    // Add empty assistant message for streaming to the current session
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages: [...s.messages, { role: "assistant", content: "" }] };
      }
      return s;
    }));

    // Abort controller with timeout to prevent stuck loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), activeTool === "generateImage" ? 90000 : 60000);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: (messages.length > 0 ? [...messages, userMessage] : [userMessage]).map(m => ({
            ...m,
            // Don't send large base64 images back - describe them instead to avoid request size issues
            generatedImages: m.images && m.images.length > 0
              ? [`[ก่อนหน้านี้สร้างรูปภาพ ${m.images.length} รูป]`]
              : undefined,
          })),
          model: selectedModel,
          responseStyle: aiSettings.responseStyle,
          customInstructions: aiSettings.customInstructions || undefined,
          language: aiSettings.language,
          webSearch: activeTool === "webSearch",
          generateImage: activeTool === "generateImage",
          canvasMode: activeTool === "canvas",
          memoryEnabled: aiSettings.memoryEnabled,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          // Quota exceeded - show popup instead of error message
          setShowQuotaPopup(true);
          // Remove the empty assistant message we added
          setSessions((prev) => prev.map(s => {
            if (s.id === currentSessionId) {
              const updatedMessages = s.messages.filter((m, i) => !(i === s.messages.length - 1 && m.role === "assistant" && !m.content));
              return { ...s, messages: updatedMessages };
            }
            return s;
          }));
          return;
        }
        if (res.status === 402) {
          // Insufficient credits - show credit popup
          setShowCreditPopup({
            needed: err.creditRequired || 1,
            have: err.creditBalance ?? 0,
            model: selectedModel,
          });
          setSessions((prev) => prev.map(s => {
            if (s.id === currentSessionId) {
              const updatedMessages = s.messages.filter((m, i) => !(i === s.messages.length - 1 && m.role === "assistant" && !m.content));
              return { ...s, messages: updatedMessages };
            }
            return s;
          }));
          return;
        }
        throw new Error(err.error || "AI service error");
      }

      // If successful request, refresh quota
      fetchAuthAndQuota();

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let collectedImages: string[] = [];
      let collectedSources: SearchSource[] = [];
      setSearchingUrls([]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);

              if (parsed.text) {
                fullText += parsed.text;
              }

              // Collect generated images
              if (parsed.image) {
                collectedImages = [...collectedImages, parsed.image];
              }

              // Show search queries being executed
              if (parsed.searchQueries) {
                const queries = parsed.searchQueries.slice(0, 2).join(", ");
                setGeneratingStatus(`กำลังค้นหา: "${queries}"`);
              }

              // Collect search sources
              if (parsed.sources) {
                collectedSources = parsed.sources;
                // Update status to show which sites are being searched
                const siteNames = parsed.sources.slice(0, 3).map((s: SearchSource) => {
                  try { return new URL(s.url).hostname.replace("www.", ""); } catch { return s.title; }
                });
                setGeneratingStatus(`กำลังอ่านข้อมูลจาก ${siteNames.join(", ")}...`);
                setSearchingUrls(siteNames);
              }
            } catch {
              // skip
            }
          }
        }

        // --- BATCHED STATE UPDATES (Once per read chunk to prevent update depth errors) ---
        if (fullText) {
          // 1. Artifact Update
          const { artifact: parsedArtifact, isComplete: artComplete } = parseArtifacts(fullText);
          if (parsedArtifact) {
            setActiveArtifact(prev => {
              if (prev && prev.content === parsedArtifact.content && prev.id === parsedArtifact.id) return prev;
              if (prev && prev.title === parsedArtifact.title) {
                return { ...parsedArtifact, id: prev.id, version: prev.version };
              }
              return parsedArtifact;
            });
            setIsArtifactComplete(artComplete);
            if (!isCanvasOpen) setIsCanvasOpen(true);
          }

          // 2. Sessions/Messages Update
          setSessions((prev) => prev.map(s => {
            if (s.id === currentSessionId) {
              const updatedMessages = [...s.messages];
              const lastMsg = updatedMessages[updatedMessages.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                // Optimization: Skip update if content is identical
                if (lastMsg.content === fullText && 
                    lastMsg.images?.length === collectedImages.length && 
                    lastMsg.sources?.length === collectedSources.length) {
                  return s;
                }
                updatedMessages[updatedMessages.length - 1] = {
                  ...lastMsg,
                  content: fullText,
                  images: collectedImages.length > 0 ? collectedImages : undefined,
                  sources: collectedSources.length > 0 ? collectedSources : undefined,
                };
              }
              return { ...s, messages: updatedMessages };
            }
            return s;
          }));
          
          scrollToBottom();
        }
      }

      // After streaming completes — finalize artifact version
      if (fullText) {
        const { artifact: finalArtifact, isComplete: finalComplete } = parseArtifacts(fullText);
        if (finalArtifact && finalComplete) {
          setArtifactVersions(prev => {
            // Check if this exact content already exists
            const duplicate = prev.some(v => v.content === finalArtifact.content);
            if (duplicate) return prev;
            const ver = prev.length + 1;
            const versioned = { ...finalArtifact, id: `artifact-v${ver}`, version: ver };
            setActiveArtifact(versioned);
            return [...prev, versioned];
          });
        }

        // Auto-save memories from AI response
        if (aiSettings.memoryEnabled) {
          const memoryMatches = fullText.matchAll(/\[MEMORY_SAVE:\s*(.+?)\]/g);
          for (const match of memoryMatches) {
            const memContent = match[1].trim();
            if (memContent) {
              fetch("/api/ai/memory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: memContent, source: "auto" }),
              }).then(() => loadMemories()).catch(() => {});
            }
          }
          // Strip memory tags from displayed text
          const cleanedText = fullText.replace(/\[MEMORY_SAVE:\s*.+?\]/g, "").trim();
          if (cleanedText !== fullText) {
            setSessions((prev) => prev.map(s => {
              if (s.id === currentSessionId) {
                const updatedMessages = [...s.messages];
                const lastMsg = updatedMessages[updatedMessages.length - 1];
                if (lastMsg && lastMsg.role === "assistant") {
                  updatedMessages[updatedMessages.length - 1] = { ...lastMsg, content: cleanedText };
                }
                return { ...s, messages: updatedMessages };
              }
              return s;
            }));
          }
        }
      }

    } catch (err) {
      // Remove empty assistant bubble on error — don't show error in chat
      setSessions((prev) => prev.map(s => {
        if (s.id === currentSessionId) {
          const updatedMessages = s.messages.filter((m, idx) =>
            !(idx === s.messages.length - 1 && m.role === "assistant" && (!m.content || m.content.startsWith("❌")))
          );
          return { ...s, messages: updatedMessages };
        }
        return s;
      }));
      // Show a brief non-intrusive status
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      setGeneratingStatus(isAbort ? "หมดเวลา — ลองใหม่อีกครั้ง" : "เกิดข้อผิดพลาด — ลองใหม่อีกครั้ง");
      setTimeout(() => setGeneratingStatus("กำลังวิเคราะห์..."), 3000);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setSearchingUrls([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/user", { method: "DELETE" });
      setUser(null);
      setQuota(null);
      localStorage.removeItem("allquiz_ai_messages");
    } catch {
      // ignore
    }
  };

  const handleSaveSettings = (newSettings: AISettings) => {
    setAISettings(newSettings);
    saveSettings(newSettings);
    syncSettingsToServer(newSettings); // sync to server per-account
    setSelectedModel(newSettings.defaultModel);
  };

  // Retry: resend the last user message
  const retryMessage = (messageIndex: number) => {
    if (loading || !activeSessionId) return;
    // Find the user message at or before this index
    const userMsgIndex = messages[messageIndex]?.role === "user"
      ? messageIndex
      : messageIndex - 1;
    if (userMsgIndex < 0 || messages[userMsgIndex]?.role !== "user") return;

    const userMsg = messages[userMsgIndex];
    // Remove messages from this point onward
    const trimmed = messages.slice(0, userMsgIndex);
    setSessions(prev => prev.map(s =>
      s.id === activeSessionId ? { ...s, messages: trimmed } : s
    ));

    // Resend
    setTimeout(() => sendMessage(userMsg.content), 100);
  };

  // Edit: put user message back in input, remove from history
  const editMessage = (messageIndex: number) => {
    if (loading || !activeSessionId) return;
    const msg = messages[messageIndex];
    if (!msg || msg.role !== "user") return;

    setInput(msg.content);
    if (msg.files) setAttachments(msg.files);

    // Remove this message and everything after
    const trimmed = messages.slice(0, messageIndex);
    setSessions(prev => prev.map(s =>
      s.id === activeSessionId ? { ...s, messages: trimmed } : s
    ));
    inputRef.current?.focus();
  };

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copyMessage = (content: string, index: number) => {
    // Strip thinking tags for copy
    const { answer } = parseThinking(content);
    navigator.clipboard.writeText(answer || content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearHistory = () => {
    askConfirm({
      title: aiSettings.language === "th" ? "ยืนยันการล้างประวัติ" : "Confirm Clear History",
      message: aiSettings.language === "th" 
        ? "คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการแชททั้งหมด? ข้อมูลทั้งหมดจะถูกลบถาวรและไม่สามารถกู้คืนได้" 
        : "Are you sure you want to clear all chat history? This will permanently delete all your chats and cannot be undone.",
      confirmText: aiSettings.language === "th" ? "ล้างทั้งหมด" : "Clear All",
      variant: "destructive",
      onConfirm: () => {
        setSessions([]);
        setActiveSessionId(null);
        localStorage.removeItem("allquiz_ai_sessions");
        showToast(aiSettings.language === "th" ? "ล้างประวัติเรียบร้อยแล้ว" : "History cleared", "success");
      }
    });
  };

  const handleDownloadImage = useCallback((dataUrl: string, filename?: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename || `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleExportHistory = () => {
    const data = JSON.stringify(sessions, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `allquiz-chat-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Drag and drop handler
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newFiles: FileData[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 4 * 1024 * 1024) continue;
      if (attachments.length + newFiles.length >= 5) break;

      const reader = new FileReader();
      const filePromise = new Promise<FileData>((resolve) => {
        reader.onloadend = () => {
          resolve({ name: file.name, data: reader.result as string, type: file.type });
        };
      });
      reader.readAsDataURL(file);
      newFiles.push(await filePromise);
    }
    setAttachments((prev) => [...prev, ...newFiles]);
  }, [attachments.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Clipboard paste handler for images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const newFiles: FileData[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.type.startsWith("image/")) continue;

      const file = item.getAsFile();
      if (!file) continue;
      if (file.size > 4 * 1024 * 1024) continue;
      if (attachments.length + newFiles.length >= 5) break;

      const reader = new FileReader();
      const filePromise = new Promise<FileData>((resolve) => {
        reader.onloadend = () => {
          resolve({
            name: `pasted-image-${Date.now()}.${file.type.split("/")[1] || "png"}`,
            data: reader.result as string,
            type: file.type,
          });
        };
      });
      reader.readAsDataURL(file);
      newFiles.push(await filePromise);
    }

    if (newFiles.length > 0) {
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  }, [attachments.length]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-3 bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">กำลังเตรียมพร้อม...</p>
      </div>
    );
  }

  // Login Overlay
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] px-4 bg-background">
        <Card className="w-full max-w-sm border p-6 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-foreground mb-1">Allquiz AI</h1>
          <p className="text-sm text-muted-foreground mb-6">
            เข้าสู่ระบบด้วย Google เพื่อใช้งาน AI Chat<br/>
            <span className="text-xs">(จำกัด 100 ครั้งต่อวัน สำหรับบริการฟรี)</span>
          </p>

          <div className="flex flex-col items-center gap-3">
            <div ref={googleBtnRef} className={gsiReady ? "" : "h-10"} />
            {!gsiReady && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                กำลังโหลด...
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            บัญชี Google ทั่วไปเข้าใช้งานได้ทันที
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] md:h-[calc(100vh-64px)] bg-[#fcfcfd]  overflow-hidden transition-colors duration-500">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[40] md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? "w-68" : "w-0"
        } transition-all duration-300 border-r border-gray-200/50  bg-white  flex flex-col h-full overflow-hidden z-[45] ${
          isSidebarOpen ? "fixed md:relative inset-y-0 left-0 shadow-2xl md:shadow-none" : ""
        }`}
      >
        <div className="p-3 flex flex-col h-full w-68 shrink-0">
          {/* New Chat + Close */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              onClick={() => createNewSession()}
              variant="outline"
              className="flex-1 justify-start gap-2.5 h-10 text-sm rounded-xl border-gray-200  bg-gray-50/50  hover:bg-white  shadow-sm transition-all"
            >
              <div className="p-1 rounded-lg bg-emerald-500 text-white">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold">{aiSettings.language === "th" ? "แชทใหม่" : "New Chat"}</span>
            </Button>
            <Button
              onClick={createFolder}
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-gray-200  text-muted-foreground hover:text-emerald-600 transition-all"
              title={aiSettings.language === "th" ? "สร้างโฟลเดอร์" : "New Folder"}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-4 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="ค้นหาบทสนทนา..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50/50  border border-gray-200  rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 text-foreground placeholder:text-muted-foreground transition-all"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {!sidebarSearch && folders.length > 0 && (
              <div className="mb-4">
                {folders.map(folder => (
                  <div
                    key={folder.id}
                    className="mb-1"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setHoveredFolderId(folder.id);
                    }}
                    onDragLeave={() => setHoveredFolderId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const sessionId = e.dataTransfer.getData("sessionId");
                      if (sessionId) moveSessionToFolder(sessionId, folder.id);
                      setHoveredFolderId(null);
                    }}
                  >
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50 group transition-colors ${
                        hoveredFolderId === folder.id ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : ''
                      }`}
                      onClick={() => toggleFolder(folder.id)}
                    >
                      {folder.isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <FolderIcon className={`h-3.5 w-3.5 ${folder.isOpen ? 'text-emerald-500' : 'text-muted-foreground'}`} />

                      {editingFolderId === folder.id ? (
                        <form
                          className="flex-1 flex items-center gap-1"
                          onSubmit={(e) => { e.preventDefault(); renameFolder(folder.id); }}
                        >
                          <input
                            autoFocus
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            onBlur={() => renameFolder(folder.id)}
                            onKeyDown={(e) => { if (e.key === "Escape") setEditingFolderId(null); }}
                            className="flex-1 text-sm bg-transparent border-b border-ring focus:outline-none text-foreground py-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button type="submit" onClick={(e) => e.stopPropagation()} className="p-0.5 text-primary">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <span className="text-sm flex-1 truncate font-medium">{folder.name}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => startEditingFolder(folder, e)}
                              className="p-1 hover:bg-accent text-muted-foreground hover:text-foreground rounded-md transition-all"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id, e); }}
                              className="p-1 hover:text-destructive rounded-md transition-all"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {folder.isOpen && (
                      <div className="ml-4 pl-2 border-l border-gray-100 space-y-0.5 mt-0.5">
                        {sessions.filter(s => s.folderId === folder.id).map(s => (
                          <div
                            key={s.id}
                            draggable
                            onDragStart={(e) => {
                              setDraggedSessionId(s.id);
                              e.dataTransfer.setData("sessionId", s.id);
                            }}
                            onDragEnd={() => setDraggedSessionId(null)}
                            onClick={() => { setActiveSessionId(s.id); setEditingSessionId(null); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                            className={`group/item relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                              activeSessionId === s.id
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            } ${draggedSessionId === s.id ? 'opacity-40' : ''}`}
                          >
                            <MessageSquare className="h-3.5 w-3.5 shrink-0" />

                            {editingSessionId === s.id ? (
                              <form
                                className="flex-1 flex items-center gap-1"
                                onSubmit={(e) => { e.preventDefault(); renameSession(s.id); }}
                              >
                                <input
                                  autoFocus
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onBlur={() => renameSession(s.id)}
                                  onKeyDown={(e) => { if (e.key === "Escape") setEditingSessionId(null); }}
                                  className="flex-1 text-sm bg-transparent border-b border-ring focus:outline-none text-foreground py-0"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button type="submit" onClick={(e) => e.stopPropagation()} className="p-0.5 text-primary">
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </form>
                            ) : (
                              <>
                                <span className="text-sm truncate block flex-1">{s.title}</span>
                                <div className="relative flex items-center shrink-0">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuId(openMenuId === s.id ? null : s.id);
                                    }}
                                    className={`p-1 hover:bg-accent text-muted-foreground hover:text-foreground rounded-sm transition-all ${openMenuId === s.id ? 'bg-accent text-foreground' : ''}`}
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </button>

                                  {/* Sidebar Session Menu */}
                                  {openMenuId === s.id && (
                                    <div 
                                      className="absolute top-full right-0 mt-1 z-[60] w-32 bg-white  border border-gray-200  rounded-lg shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-200"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button onClick={(e) => { startEditing(s, e); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600  hover:bg-gray-50  transition-colors">
                                        <Pencil className="h-3 w-3" /> {aiSettings.language === "th" ? "เปลี่ยนชื่อ" : "Rename"}
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); setMovingSession(s); setIsMoveModalOpen(true); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600  hover:bg-gray-50  transition-colors">
                                        <FolderInput className="h-3 w-3" /> {aiSettings.language === "th" ? "ย้าย" : "Move"}
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); setSharingSession(s); setIsShareModalOpen(true); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600  hover:bg-gray-50  transition-colors">
                                        <Share2 className="h-3 w-3" /> {aiSettings.language === "th" ? "แชร์" : "Share"}
                                      </button>
                                      <div className="h-px bg-gray-100  my-1" />
                                      <button onClick={(e) => { deleteSession(s.id, e); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50  transition-colors">
                                        <Trash2 className="h-3 w-3" /> {aiSettings.language === "th" ? "ลบ" : "Delete"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                        {sessions.filter(s => s.folderId === folder.id).length === 0 && (
                          <div className="py-2 px-2 text-[11px] text-muted-foreground italic">
                            {aiSettings.language === "th" ? "ว่างเปล่า (ลากแชทมาวางที่นี่)" : "Empty (drag sessions here)"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {filteredSessions.length === 0 && folders.length === 0 ? (
              <div className="px-2 py-10 text-center text-muted-foreground">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-40" />
                <p className="text-xs">
                  {sidebarSearch ? (aiSettings.language === "th" ? "ไม่พบแชทที่ค้นหา" : "No chats found") : (aiSettings.language === "th" ? "ยังไม่มีประวัติ" : "No history yet")}
                </p>
              </div>
            ) : (
              Array.from(groupedSessions.entries()).map(([group, groupSessions]) => (
                <div key={group} className="mb-1">
                  <div className="px-2 py-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">{group}</span>
                  </div>
                  {groupSessions.map((s) => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedSessionId(s.id);
                        e.dataTransfer.setData("sessionId", s.id);
                      }}
                      onDragEnd={() => setDraggedSessionId(null)}
                      onClick={() => { setActiveSessionId(s.id); setEditingSessionId(null); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                      className={`group/item relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                        activeSessionId === s.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      } ${draggedSessionId === s.id ? 'opacity-40' : ''}`}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />

                      {editingSessionId === s.id ? (
                        <form
                          className="flex-1 flex items-center gap-1"
                          onSubmit={(e) => { e.preventDefault(); renameSession(s.id); }}
                        >
                          <input
                            autoFocus
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => renameSession(s.id)}
                            onKeyDown={(e) => { if (e.key === "Escape") setEditingSessionId(null); }}
                            className="flex-1 text-sm bg-transparent border-b border-ring focus:outline-none text-foreground py-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button type="submit" onClick={(e) => e.stopPropagation()} className="p-0.5 text-primary">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm truncate block">{s.title}</span>
                          </div>
                          <div className="relative flex items-center shrink-0">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === s.id ? null : s.id);
                              }}
                              className={`p-1 hover:bg-accent text-muted-foreground hover:text-foreground rounded-sm transition-all ${openMenuId === s.id ? 'bg-accent text-foreground' : ''}`}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </button>

                            {/* Sidebar Session Menu */}
                            {openMenuId === s.id && (
                              <div 
                                className="absolute top-full right-0 mt-1 z-[60] w-32 bg-white  border border-gray-200  rounded-lg shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button onClick={(e) => { startEditing(s, e); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600  hover:bg-gray-50  transition-colors">
                                  <Pencil className="h-3 w-3" /> {aiSettings.language === "th" ? "เปลี่ยนชื่อ" : "Rename"}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setMovingSession(s); setIsMoveModalOpen(true); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600  hover:bg-gray-50  transition-colors">
                                  <FolderInput className="h-3 w-3" /> {aiSettings.language === "th" ? "ย้าย" : "Move"}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setSharingSession(s); setIsShareModalOpen(true); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-600  hover:bg-gray-50  transition-colors">
                                  <Share2 className="h-3 w-3" /> {aiSettings.language === "th" ? "แชร์" : "Share"}
                                </button>
                                <div className="h-px bg-gray-100  my-1" />
                                <button onClick={(e) => { deleteSession(s.id, e); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50  transition-colors">
                                  <Trash2 className="h-3 w-3" /> {aiSettings.language === "th" ? "ลบ" : "Delete"}
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="pt-2 border-t border-gray-200 mt-auto space-y-2">
            {quota && (
              <div className="px-2 py-2 rounded-md border border-gray-200 bg-background">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">โควตา</span>
                  <span className={`text-xs font-semibold tabular-nums ${
                    quota.remaining <= 3 ? "text-destructive" : "text-foreground"
                  }`}>
                    {quota.remaining}<span className="text-muted-foreground font-normal">/{quota.limit}</span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-200  rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      quota.remaining <= 3 ? "bg-red-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${(quota.remaining / quota.limit) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => { setSettingsTab("general"); setIsSettingsOpen(true); }}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-gray-100  transition-all w-full"
              >
                <Settings className="h-3 w-3" />
                ตั้งค่า
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive px-2 py-1.5 rounded-lg hover:bg-red-50  transition-all w-full"
              >
                <LogOut className="h-3 w-3" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xlsx"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col min-w-0 relative h-full bg-[#fcfcfd] "
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drag overlay with blur */}
        {isDragging && (
          <div className="absolute inset-4 z-[100] backdrop-blur-md bg-emerald-500/10 border-4 border-dashed border-emerald-500/40 rounded-3xl flex items-center justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center bg-white  rounded-3xl p-10 shadow-2xl border border-emerald-500/20">
              <div className="w-20 h-20 bg-emerald-100  rounded-full flex items-center justify-center mx-auto mb-4">
                <Paperclip className="h-10 w-10 text-emerald-600" />
              </div>
              <p className="text-xl font-bold text-gray-900 ">วางไฟล์เพื่ออัปโหลด</p>
              <p className="text-sm text-gray-500 mt-2">รูปภาพ, PDF, หรือเอกสาร (สูงสุด 4MB)</p>
            </div>
          </div>
        )}

        {/* Sidebar Toggle - Visible when closed, or on desktop when open */}
        <div className={`absolute left-4 top-4 z-[40] transition-all duration-300 ${isSidebarOpen ? 'md:opacity-100 opacity-0 pointer-events-none md:pointer-events-auto' : 'opacity-100'}`}>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl bg-white/80  backdrop-blur-md border-gray-200/50  shadow-sm hover:shadow-md transition-all"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
        </div>

        <main className="flex-1 overflow-hidden flex flex-col relative">
          <div ref={scrollRef} className={`flex-1 overflow-y-auto px-4 pt-16 pb-40 scroll-smooth custom-scrollbar ${
            aiSettings.fontSize === "small" ? "text-xs" : aiSettings.fontSize === "large" ? "text-base" : "text-sm"
          }`}>
            <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="relative h-20 w-20 mb-8">
                <div className="absolute inset-0 bg-emerald-500 rounded-3xl rotate-6 animate-pulse opacity-20" />
                <div className="absolute inset-0 bg-emerald-500 rounded-3xl -rotate-3 transition-transform hover:rotate-0 duration-500 shadow-xl shadow-emerald-500/20 flex items-center justify-center text-white">
                  <Sparkles className="h-10 w-10" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-gray-900  mb-3 tracking-tight">
                สวัสดี, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">{user.name.split(' ')[0]}</span>
              </h2>
              <p className="text-base text-gray-500  max-w-sm mx-auto mb-12 font-medium">
                ฉันคือผู้ช่วย AI ส่วนตัวของคุณ พร้อมตอบคำถามและวิเคราะห์ข้อมูลทุกรูปแบบ
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl px-4">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={s}
                    disabled={!!(quota && quota.usage >= quota.limit && isFreeModel(selectedModel))}
                    onClick={() => s.includes("📷") ? fileInputRef.current?.click() : sendMessage(s)}
                    className="group text-left p-4 rounded-2xl border border-gray-200/60  bg-white  hover:bg-emerald-50  hover:border-emerald-200  transition-all shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gray-50  group-hover:bg-white  text-gray-400 group-hover:text-emerald-500 transition-colors">
                        {s.includes("📝") ? <ClipboardList className="h-4 w-4" /> : 
                         s.includes("📚") ? <GraduationCap className="h-4 w-4" /> :
                         s.includes("📷") ? <Image className="h-4 w-4" /> :
                         <MessageCircle className="h-4 w-4" />}
                      </div>
                      <span className="text-sm font-semibold text-gray-600  group-hover:text-gray-900  transition-colors">{s}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-500 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div className={`flex gap-3 w-full max-w-[95%] sm:max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className="shrink-0 pt-1">
                  {m.role === "assistant" ? (
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                      <Zap className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-xl overflow-hidden border-2 border-white  shadow-md">
                      {user ? (
                        <img src={user.picture} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-muted flex items-center justify-center"><User className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                    </div>
                  )}
                </div>

                <div className={`flex flex-col min-w-0 ${m.role === "user" ? "items-end" : "items-start"} flex-1`}>
                  <div
                    className={`relative w-fit max-w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm border flex items-center min-h-[44px] ${
                      m.role === "user"
                        ? "bg-emerald-600 text-white border-emerald-500 px-5 py-2.5"
                        : "bg-white  border-gray-100  px-5 py-3.5"
                    }`}
                  >
                    <div className="w-full">
                      {m.files && m.files.length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {m.files.map((file, idx) => (
                            <div key={idx} className="relative group rounded-xl overflow-hidden border border-white/20  shadow-md">
                              {file.type.startsWith("image/") ? (
                                <img src={file.data} alt={file.name} className="h-28 w-28 object-cover transition-transform group-hover:scale-110 duration-500" />
                              ) : (
                                <div className="h-28 w-28 flex flex-col items-center justify-center p-3 text-center bg-gray-50/50  backdrop-blur-sm">
                                  <div className="p-2 rounded-xl bg-white/30  mb-2">
                                    <FileText className="h-6 w-6 text-emerald-500" />
                                  </div>
                                  <span className="text-[9px] font-bold line-clamp-2 break-all text-gray-500  uppercase tracking-tighter">{file.name}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {m.role === "assistant" ? (
                        m.content ? (
                          (() => {
                            const { thinking, answer: rawAnswer } = parseThinking(m.content);
                            const { cleanedContent: answer, artifact: msgArtifact } = parseArtifacts(rawAnswer);
                            const isStreaming = loading && i === messages.length - 1;
                            const isStillThinking = isStreaming && !m.content.includes("</think>");
                            const isProModel = selectedModel.includes("pro") || selectedModel.includes("opus") || selectedModel.includes("3.1");
                            const isAutoMaybeFlash = selectedModel === "auto" && thinking && thinking.split("\n").filter(l => l.trim()).length <= 2;
                            const showThinking = isProModel || (selectedModel === "auto" && !isAutoMaybeFlash);

                            return (
                              <div className="w-full relative z-10 text-left">
                                {showThinking && (thinking || isStillThinking) && (
                                  <ThinkingBlock
                                    thinking={thinking}
                                    isStreaming={isStillThinking}
                                    status={generatingStatus}
                                  />
                                )}
                                {answer && (
                                  <div
                                    className="text-[15px] leading-relaxed prose prose-neutral  prose-p:my-2 prose-headings:font-black prose-a:text-emerald-500 prose-strong:text-emerald-600  w-full max-w-none transition-all duration-300"
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(answer.replace(/\*\(Artifact generated in Canvas\)\*/g, "")) }}
                                  />
                                )}

                                {/* Open Canvas card */}
                                {msgArtifact && (
                                  <div className="mt-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col sm:flex-row items-center gap-4 animate-in slide-in-from-left-2 duration-500">
                                    <div className="h-12 w-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
                                      {msgArtifact.type === 'code' ? <Code2 className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                                    </div>
                                    <div className="flex-1 min-w-0 text-center sm:text-left">
                                      <h4 className="font-bold text-gray-900  truncate">{msgArtifact.title}</h4>
                                      <p className="text-xs text-emerald-600  font-bold uppercase tracking-widest">{msgArtifact.type} artifact</p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setActiveArtifact(msgArtifact);
                                        setIsArtifactComplete(true);
                                        setIsCanvasOpen(true);
                                      }}
                                      className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/10 active:scale-95 whitespace-nowrap"
                                    >
                                      เปิดในหน้าต่างเสริม
                                    </button>
                                  </div>
                                )}

                                {/* Generated images card */}
                                {m.images && m.images.length > 0 && (
                                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {m.images.map((img, imgIdx) => (
                                      <div key={imgIdx} className="relative group rounded-2xl overflow-hidden border border-gray-200/50  shadow-lg transition-all hover:scale-[1.02] duration-500">
                                        <img
                                          src={img}
                                          alt={`Generated ${imgIdx + 1}`}
                                          className="w-full aspect-square object-cover cursor-pointer"
                                          onClick={() => setPreviewImage(img)}
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-all flex items-center justify-center gap-3">
                                          <button onClick={() => setPreviewImage(img)} className="p-3 rounded-full bg-white text-gray-900 hover:scale-110 transition-transform"><Maximize2 className="h-5 w-5" /></button>
                                          <button onClick={() => handleDownloadImage(img)} className="p-3 rounded-full bg-white text-gray-900 hover:scale-110 transition-transform"><Download className="h-5 w-5" /></button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Search sources bar */}
                                {m.sources && m.sources.length > 0 && (
                                  <div className="mt-6 pt-4 border-t border-gray-100/50 ">
                                    <div className="flex items-center gap-2 mb-3">
                                      <Globe className="h-3.5 w-3.5 text-blue-500" />
                                      <span className="text-[10px] font-black text-gray-400  uppercase tracking-widest">ข้อมูลอ้างอิงจากเว็บไซต์</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {m.sources.map((src, srcIdx) => (
                                        <a key={srcIdx} href={src.url} target="_blank" rel="noopener noreferrer"
                                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100/50  hover:bg-emerald-50  text-xs font-medium text-gray-600  hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-200/50">
                                          <img src={`https://www.google.com/s2/favicons?domain=${new URL(src.url).hostname}&sz=16`} alt="" className="w-3.5 h-3.5 opacity-70" />
                                          <span className="max-w-[150px] truncate">{src.title}</span>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <div className="flex items-center gap-4 py-2">
                            <div className="relative">
                              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
                              </div>
                              <div className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full animate-ping" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-bold text-gray-900 ">{generatingStatus}</span>
                              {activeTool === "webSearch" && searchingUrls.length > 0 && (
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  {searchingUrls.map((url, idx) => (
                                    <span key={idx} className="text-[10px] text-blue-500 bg-blue-50  px-1.5 rounded uppercase font-bold animate-in fade-in slide-in-from-left-2">{url}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed font-medium">{m.content}</p>
                      )}
                    </div>
                  </div>

                  {/* Message action toolbar */}
                  {!loading && m.content && (
                    <div className={`flex items-center gap-1.5 mt-1.5 transition-all px-1 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      <button
                        onClick={() => {
                          copyMessage(m.content, i);
                          showToast(aiSettings.language === "th" ? "คัดลอกแล้ว" : "Copied", "success");
                        }}
                        className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100  transition-all`}
                        title="คัดลอก"
                      >
                        {copiedIndex === i ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>

                      {m.role === "assistant" && (
                        <>
                          <button
                            onClick={() => handleSpeak(m.content, i)}
                            className={`p-1.5 rounded-lg transition-all ${speakingIndex === i ? "text-emerald-500 bg-emerald-50" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100 "}`}
                            title="อ่านออกเสียง"
                          >
                            {speakingIndex === i ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                          </button>
                        </>
                      )}

                      {/* Edit Button - Show only for the LATEST user message in the history */}
                      {m.role === "user" && i === messages.findLastIndex(msg => msg.role === "user") && (
                        <button
                          onClick={() => editMessage(i)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100  transition-all"
                          title="แก้ไขข้อความ"
                        >
                          <SquarePen className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold">แก้ไข</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Skeleton Loader when generating initial response */}
          {loading && messages.length > 0 && messages[messages.length-1].role === "user" && (
            <MessageSkeleton />
          )}
          </div>
          </div>

          {/* Bottom Gradient Overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#fcfcfd] via-[#fcfcfd]/80 to-transparent    pointer-events-none z-30" />
          </main>

        {/* Floating Modern Input Area */}
        <div className="absolute bottom-6 left-0 right-0 z-40 px-4 md:px-8 pointer-events-none">
          <div className="max-w-3xl mx-auto relative group pointer-events-auto">
            {/* Blur background behind input - Adjusted for softer glow */}
            <div className="absolute -inset-2 bg-gradient-to-r from-emerald-400/10 to-teal-400/10 rounded-3xl blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            
            <div className="relative bg-white/95  border border-emerald-500/20  rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all focus-within:ring-4 focus-within:ring-emerald-500/5">
              
              {attachments.length > 0 && (
                <div className="px-6 pt-4 pb-2 border-b border-gray-100  flex flex-wrap gap-2 animate-in slide-in-from-bottom-2 duration-300 overflow-hidden rounded-t-2xl">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="relative group/file shrink-0 transition-transform hover:scale-105">
                      {file.type.startsWith("image/") ? (
                        <img src={file.data} className="h-12 w-12 object-cover rounded-xl border border-emerald-100  shadow-sm" />
                      ) : (
                        <div className="h-12 min-w-[48px] px-3 bg-emerald-50/50  rounded-xl border border-emerald-100  flex items-center gap-2">
                          <FileText className="h-4 w-4 text-emerald-500" />
                          <span className="text-[9px] font-bold text-gray-500 max-w-[70px] truncate">{file.name}</span>
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transform transition-transform active:scale-90"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col">
                {/* Tool info bar - Anchored to the top inner edge */}
                {activeTool !== "none" && (
                  <div className="px-4 pt-2 pb-1">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                      activeTool === "webSearch" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" :
                      activeTool === "canvas" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" :
                      "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                    }`}>
                      {activeTool === "webSearch" ? <Globe className="h-3 w-3" /> :
                       activeTool === "canvas" ? <SquarePen className="h-3 w-3" /> : <Image className="h-3 w-3" />}
                      {activeTool === "webSearch" ? "WEB SEARCH" : activeTool === "canvas" ? "CANVAS MODE" : "GENERATE IMAGE"}
                      <button onClick={() => setActiveTool("none")} className="ml-1 hover:scale-125 transition-transform"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 p-2 sm:p-3">
                  {/* Model Picker Trigger */}
                  <div className="relative shrink-0 self-end mb-0.5">
                    <button
                      onClick={() => {
                        setIsModelPickerOpen(!isModelPickerOpen);
                        if (!isModelPickerOpen) setIsToolsMenuOpen(false);
                      }}
                      className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all border ${
                        isModelPickerOpen 
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" 
                          : "bg-emerald-500/5  text-emerald-500 border-emerald-500/10 hover:bg-emerald-500/10 "
                      }`}
                      title="เลือกโมเดล AI"
                    >
                      <div className="relative">
                        {currentModel.icon}
                        <ChevronDown className={`absolute -bottom-1 -right-2 h-2.5 w-2.5 transition-transform duration-300 ${isModelPickerOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Model Picker Popover */}
                    {isModelPickerOpen && (
                      <div className="absolute bottom-full left-0 mb-4 w-64 bg-white  border border-emerald-500/10  rounded-2xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
                        <div className="p-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
                          <div className="px-4 py-3 border-b border-gray-100  mb-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select AI Model</span>
                          </div>
                          {MODEL_CATEGORIES.map((category) => (
                            <div key={category.name} className="mb-4">
                              <div className="px-4 py-1.5">
                                <span className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest">{category.name}</span>
                              </div>
                              <div className="space-y-1">
                                {category.models.map((model) => {
                                  const available = isModelAvailable(model.value);
                                  const cost = quota?.pricing?.[model.value];
                                  const isAuto = model.value === "auto";
                                  return (
                                    <button
                                      key={model.value}
                                      disabled={!available}
                                      onClick={() => { setSelectedModel(model.value); setIsModelPickerOpen(false); }}
                                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                                        !available ? "opacity-30 grayscale cursor-not-allowed" :
                                        selectedModel === model.value 
                                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                                          : isAuto 
                                            ? "bg-emerald-50/50  hover:bg-emerald-100  text-emerald-700 "
                                            : "hover:bg-gray-100  text-gray-600 "
                                      }`}
                                    >
                                      <div className={`p-2 rounded-lg ${selectedModel === model.value ? 'bg-white/20' : 'bg-white  shadow-sm'}`}>
                                        {model.icon}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-bold truncate">{model.label}</span>
                                          {cost !== undefined && <span className="text-[9px] opacity-70 font-black tracking-tighter">{cost}CR</span>}
                                        </div>
                                        <p className={`text-[10px] truncate ${selectedModel === model.value ? 'text-white/70' : 'text-gray-400'}`}>{model.desc}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 relative flex items-center">
                    <textarea
                      ref={inputRef}
                      value={input}
                      disabled={!!(quota && quota.usage >= quota.limit && isFreeModel(selectedModel))}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 250)}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && aiSettings.sendWithEnter) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      onPaste={handlePaste}
                      placeholder={quota && quota.usage >= quota.limit && isFreeModel(selectedModel) 
                        ? (aiSettings.language === "th" ? "โควตาฟรีวันนี้เต็มแล้ว..." : "Free quota reached for today...")
                        : (aiSettings.language === "th" ? "ถามอะไรก็ได้..." : "Ask anything...")}
                      className="w-full bg-transparent border-none focus:ring-0 outline-none text-[15px] py-2 px-1 min-h-[40px] max-h-[250px] resize-none text-gray-800  placeholder:text-gray-400  font-medium disabled:opacity-50"
                      rows={1}
                    />
                    {input && (
                      <button 
                        onClick={() => { setInput(""); if (inputRef.current) { inputRef.current.style.height = "40px"; inputRef.current.focus(); } }}
                        className="absolute right-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-600  hover:bg-gray-100  transition-all"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 self-end mb-0.5">
                    <button
                      onClick={() => {
                        setIsToolsMenuOpen(!isToolsMenuOpen);
                        if (!isToolsMenuOpen) setIsModelPickerOpen(false);
                      }}
                      className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all border ${
                        isToolsMenuOpen 
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" 
                          : "bg-gray-100  border-transparent text-gray-500 hover:bg-gray-200 "
                      }`}
                      title="เครื่องมือเพิ่มเติม"
                    >
                      <Plus className={`h-5 w-5 transition-transform duration-500 ${isToolsMenuOpen ? 'rotate-45' : ''}`} />
                    </button>

                    <button
                      onClick={() => sendMessage()}
                      disabled={loading || (!input.trim() && attachments.length === 0) || (!!quota && quota.usage >= quota.limit && isFreeModel(selectedModel))}
                      className="h-10 w-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-100  text-white font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-90 flex items-center justify-center shrink-0"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ArrowUp className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Floating Tools Menu - Refined with Rounded Rectangle */}
              {isToolsMenuOpen && (
                <div className="absolute bottom-full right-0 mb-4 w-72 bg-white  border border-emerald-500/10  rounded-2xl shadow-xl p-3 z-50 animate-in slide-in-from-bottom-6 zoom-in-95 duration-300">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { fileInputRef.current?.click(); setIsToolsMenuOpen(false); }} className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-emerald-500/5  transition-all group">
                      <div className="p-3 rounded-xl bg-gray-100  group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-500/25 transition-all"><Paperclip className="h-5 w-5" /></div>
                      <span className="text-[9px] font-black text-gray-400 group-hover:text-emerald-500 uppercase tracking-widest transition-colors">Upload</span>
                    </button>
                    <button onClick={() => { setActiveTool('webSearch'); setIsToolsMenuOpen(false); }} className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-blue-500/5  transition-all group">
                      <div className={`p-3 rounded-xl transition-all ${activeTool === 'webSearch' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-gray-100  group-hover:bg-blue-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-500/25'}`}><Globe className="h-5 w-5" /></div>
                      <span className="text-[9px] font-black text-gray-400 group-hover:text-blue-500 uppercase tracking-widest transition-colors">Search</span>
                    </button>
                    <button onClick={() => { setActiveTool('generateImage'); setIsToolsMenuOpen(false); }} className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-violet-500/5  transition-all group">
                      <div className={`p-3 rounded-xl transition-all ${activeTool === 'generateImage' ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25' : 'bg-gray-100  group-hover:bg-violet-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-violet-500/25'}`}><Image className="h-5 w-5" /></div>
                      <span className="text-[9px] font-black text-gray-400 group-hover:text-violet-500 uppercase tracking-widest transition-colors">Image</span>
                    </button>
                    <button onClick={() => { setActiveTool('canvas'); setIsToolsMenuOpen(false); }} className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-emerald-500/5  transition-all group">
                      <div className={`p-3 rounded-xl transition-all ${activeTool === 'canvas' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'bg-gray-100  group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-500/25'}`}><SquarePen className="h-5 w-5" /></div>
                      <span className="text-[9px] font-black text-gray-400 group-hover:text-emerald-500 uppercase tracking-widest transition-colors">Canvas</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Disclaimer */}
            <p className="mt-4 text-[10px] text-center text-muted-foreground/60 px-4 font-medium uppercase tracking-widest">
              {aiSettings.language === "th" 
                ? "AI อาจให้ข้อมูลที่ไม่ถูกต้อง โปรดตรวจสอบข้อมูลสำคัญเสมอ" 
                : "AI can make mistakes. Check important info."}
            </p>
          </div>
        </div>
      </div>

      {/* Canvas / Artifacts Panel */}
      {isCanvasOpen && activeArtifact && (
        <div
          className="fixed md:relative inset-y-0 right-0 z-[100] md:z-auto w-full border-l border-gray-200  bg-white  flex flex-col transition-all duration-500 animate-in slide-in-from-right-full"
          style={{ width: window.innerWidth < 768 ? "100%" : canvasWidth }}
        >
          {/* Desktop resize handle */}
          <div
            onMouseDown={handleCanvasResizeStart}
            className="hidden md:block absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/20 active:bg-emerald-500 transition-colors z-50"
          />
          
          <CanvasView
            artifact={activeArtifact}
            versions={artifactVersions}
            onSelectVersion={(v) => setActiveArtifact(v)}
            isOpen={isCanvasOpen}
            isComplete={isArtifactComplete}
            onClose={() => { setIsCanvasOpen(false); setActiveArtifact(null); }}
          />
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={aiSettings}
        onSave={handleSaveSettings}
        user={user}
        quota={quota}
        onLogout={handleLogout}
        onClearHistory={handleClearHistory}
        onExportHistory={handleExportHistory}
        onQuotaRefresh={refreshQuota}
        sessions={sessions}
        memories={memories}
        onMemoriesChange={loadMemories}
        adminModelConfig={adminModelConfig}
        onAdminModelConfigChange={(newConfig) => setAdminModelConfig(newConfig)}
        initialTab={settingsTab}
      />

      {/* Quota Exceeded Popup */}
      {showQuotaPopup && quota && (
        <QuotaExceededPopup
          limit={quota.limit}
          onClose={() => setShowQuotaPopup(false)}
          lang={aiSettings.language}
        />
      )}

      {showCreditPopup && (
        <CreditNeededPopup
          needed={showCreditPopup.needed}
          have={showCreditPopup.have}
          model={showCreditPopup.model}
          onClose={() => setShowCreditPopup(null)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          lang={aiSettings.language}
        />
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl w-full h-full p-4 flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-500" 
            />
            <div className="absolute top-6 right-6 flex gap-3">
              <button 
                onClick={() => handleDownloadImage(previewImage)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium shadow-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                {aiSettings.language === "th" ? "ดาวน์โหลด" : "Download"}
              </button>
              <button
                onClick={() => setPreviewImage(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium shadow-lg transition-colors"
              >
                <X className="h-4 w-4" />
                {aiSettings.language === "th" ? "ปิด" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      {isMoveModalOpen && movingSession && (
        <MoveToFolderModal
          session={movingSession}
          folders={folders}
          onMove={(folderId) => {
            moveSessionToFolder(movingSession.id, folderId);
            setIsMoveModalOpen(false);
            setMovingSession(null);
          }}
          onClose={() => {
            setIsMoveModalOpen(false);
            setMovingSession(null);
          }}
          lang={aiSettings.language}
        />
      )}

      {/* Share Modal */}
      {isShareModalOpen && sharingSession && (
        <ShareModal
          session={sharingSession}
          onClose={() => {
            setIsShareModalOpen(false);
            setSharingSession(null);
          }}
          lang={aiSettings.language}
        />
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95">
            <div className="p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{confirmDialog.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDialog(null)}
              >
                {confirmDialog.cancelText || (aiSettings.language === "th" ? "ยกเลิก" : "Cancel")}
              </Button>
              <Button
                variant={confirmDialog.variant === "destructive" ? "destructive" : "default"}
                size="sm"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
              >
                {confirmDialog.confirmText || (aiSettings.language === "th" ? "ตกลง" : "Confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MoveToFolderModal({
  session,
  folders,
  onMove,
  onClose,
  lang
}: {
  session: ChatSession;
  folders: Folder[];
  onMove: (folderId: string | null) => void;
  onClose: () => void;
  lang: string;
}) {
  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {lang === "th" ? "ย้ายเข้าโฟลเดอร์" : "Move to Folder"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-2 max-h-[300px] overflow-y-auto">
          <button
            onClick={() => onMove(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              !session.folderId ? "bg-accent text-accent-foreground font-medium" : "hover:bg-gray-50 text-gray-600"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium">{lang === "th" ? "ไม่อยู่ในโฟลเดอร์" : "No Folder"}</div>
            </div>
          </button>

          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => onMove(folder.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mt-1 ${
                session.folderId === folder.id ? "bg-emerald-50 text-emerald-700 font-medium ring-1 ring-emerald-200/50" : "hover:bg-gray-50 text-gray-600"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                session.folderId === folder.id ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-500"
              }`}>
                <FolderIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium truncate">{folder.name}</div>
                <div className="text-[11px] opacity-60">{folder.sessionIds.length} {lang === "th" ? "รายการ" : "items"}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {lang === "th" ? "ยกเลิก" : "Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShareModal({
  session,
  onClose,
  lang
}: {
  session: ChatSession;
  onClose: () => void;
  lang: string;
}) {
  const [days, setDays] = useState(7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiration, setShareExpiration] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`share_url_${session.id}`);
    const savedExp = localStorage.getItem(`share_exp_${session.id}`);
    if (saved) setShareUrl(saved);
    if (savedExp) setShareExpiration(Number(savedExp));
  }, [session.id]);

  const createShareLink = async (update = false) => {
    if (update) setIsUpdating(true);
    else setIsGenerating(true);

    try {
      const res = await fetch("/api/ai/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: session,
          expiresInDays: days === 0 ? -1 : days
        })
      });

      const data = await res.json();
      if (data.url) {
        const fullUrl = `${window.location.origin}${data.url}`;
        setShareUrl(fullUrl);
        
        // Calculate expiration date for UI display
        let expDate: number | null = null;
        if (days > 0) {
          expDate = Date.now() + (days * 24 * 60 * 60 * 1000);
          setShareExpiration(expDate);
          localStorage.setItem(`share_exp_${session.id}`, expDate.toString());
        } else {
          setShareExpiration(null);
          localStorage.removeItem(`share_exp_${session.id}`);
        }
        
        localStorage.setItem(`share_url_${session.id}`, fullUrl);
      }
    } catch (e) {
      console.error("Share failed", e);
    } finally {
      setIsGenerating(false);
      setIsUpdating(false);
    }
  };

  const copyToClipboard = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      // Could add a small toast here if available in this scope
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Share2 className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-gray-900">
              {lang === "th" ? "แชร์การสนทนา" : "Share Conversation"}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {!shareUrl ? (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
                  {lang === "th" ? "ระยะเวลาหมดอายุ" : "Expiration Period"}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 7, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        days === d
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100"
                          : "bg-white border-gray-200 text-gray-500 hover:border-emerald-200 hover:bg-emerald-50"
                      }`}
                    >
                      {d === 0 ? (lang === "th" ? "ไม่มี" : "Never") : `${d}${lang === "th" ? " วัน" : "d"}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {lang === "th"
                    ? "ชื่อและข้อความของคุณจะเปิดเผยต่อสาธารณะสำหรับทุกคนที่มีลิงก์ โปรดตรวจสอบว่าไม่มีข้อมูลส่วนตัวที่สำคัญ"
                    : "Your name and messages will be public to anyone with the link. Please ensure no sensitive information is included."}
                </p>
              </div>

              <Button
                onClick={() => createShareLink()}
                disabled={isGenerating}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-100 transition-all"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                {lang === "th" ? "สร้างลิงก์แชร์" : "Create Share Link"}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                  {lang === "th" ? "ลิงก์แชร์ปัจจุบัน" : "Current Share Link"}
                </label>
                <div className="bg-gray-50 p-1.5 rounded-xl border border-gray-200 flex items-center gap-2 group focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                  <input
                    readOnly
                    value={shareUrl}
                    className="bg-transparent text-xs flex-1 outline-none text-gray-600 font-medium px-2"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="p-2.5 bg-white hover:bg-emerald-50 text-gray-500 hover:text-emerald-600 rounded-lg border border-gray-200 hover:border-emerald-200 shadow-sm transition-all"
                    title={lang === "th" ? "คัดลอก" : "Copy"}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                {shareExpiration && (
                  <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1 px-1">
                    <Calendar className="h-3 w-3" />
                    {lang === "th" ? "หมดอายุวันที่: " : "Expires on: "}
                    {new Date(shareExpiration).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => createShareLink(true)}
                  disabled={isUpdating}
                  variant="outline"
                  className="w-full h-10 rounded-xl border-gray-200 hover:bg-gray-50 text-gray-700 font-bold transition-all"
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {lang === "th" ? "อัปเดตเนื้อหาลิงก์เดิม" : "Update Current Link Content"}
                </Button>
                
                <Button
                  onClick={() => {
                    localStorage.removeItem(`share_url_${session.id}`);
                    setShareUrl(null);
                  }}
                  variant="ghost"
                  className="w-full h-10 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 font-bold transition-all"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {lang === "th" ? "ยกเลิกลิงก์แชร์" : "Delete Share Link"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-center">
          <p className="text-[10px] text-gray-400 font-medium">
            {lang === "th" ? "จัดการความเป็นส่วนตัวได้ที่หน้าตั้งค่า" : "Manage privacy settings in configuration"}
          </p>
        </div>
      </div>
    </div>
  );
}
