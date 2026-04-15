"use client";

import Link from "next/link";
import CanvasView from "./components/CanvasView";
import { parseArtifacts } from "./utils/canvasParser";
import { Artifact } from "./types/canvas";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  Type,
  MessageCircle,
  Image,
  GraduationCap,
  ClipboardList,
  SearchIcon,
  MoreHorizontal,
  Copy,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  SquarePen,
  Brain,
  Mic,
  MicOff,
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

function parseThinking(content: string): { thinking: string; answer: string } {
  const thinkMatch = content.match(/<think>([\s\S]*?)(<\/think>|$)/);
  if (!thinkMatch) return { thinking: "", answer: content };

  // Strip MEMORY_SAVE tags from thinking content
  let thinking = thinkMatch[1].trim();
  thinking = thinking.replace(/\[MEMORY_SAVE:\s*.+?\]/g, "").trim();

  let afterThink = content.replace(/<think>[\s\S]*?(<\/think>|$)/, "").trim();
  // Also strip MEMORY_SAVE from answer
  afterThink = afterThink.replace(/\[MEMORY_SAVE:\s*.+?\]/g, "").trim();

  return { thinking, answer: afterThink };
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
      setOpen(true);
    }
  }, [isStreaming, thinking]);

  if (!thinking && !isStreaming) return null;
  
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
      >
        <Zap className="h-3 w-3" />
        {isStreaming ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {thinking ? "กำลังคิด..." : status}
          </span>
        ) : (
          <span>ดูกระบวนการคิด</span>
        )}
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (thinking || isStreaming) && (
        <div className="mt-1.5 ml-1 pl-3 border-l-2 border-gray-200 text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {thinking || (isStreaming && !thinking && <span className="italic opacity-70">กำลังประมวลผล...</span>)}
        </div>
      )}
    </div>
  );
}
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    creditsCostInfo: "โมเดลฟรีใช้งานได้ไม่จำกัด โมเดลโปรใช้เครดิต",
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
    creditsCostInfo: "Free models are unlimited. Pro models use credits.",
    creditsUsage: "Usage",
    creditsTopupBonus: "Top up",
    creditsRefund: "Refund",
  },
  zh: {
    settings: "设置",
    general: "通用",
    personalization: "个性化",
    dataControl: "数据管理",
    account: "账户",
    defaultModel: "默认模型",
    defaultModelDesc: "选择默认的AI模型",
    autoDesc: "根据复杂度自动选择模型",
    proDesc: "高精度，适合复杂问题",
    flashDesc: "快速，适合一般问题",
    claudeDesc: "Anthropic 的 Claude Sonnet",
    fontSize: "字体大小",
    fontSizeDesc: "调整聊天文字大小",
    fontSmall: "小",
    fontMedium: "中",
    fontLarge: "大",
    sendWithEnter: "按Enter发送",
    sendWithEnterDesc: "按Enter发送消息（Shift+Enter换行）",
    language: "语言",
    languageDesc: "更改AI和界面语言",
    responseStyle: "回复风格",
    responseStyleDesc: "选择简洁或详细的AI回复",
    concise: "简洁",
    conciseDesc: "简短直接",
    detailed: "详细",
    detailedDesc: "详尽并附有示例",
    customInstructions: "自定义指令",
    customInstructionsDesc: "告诉AI关于你的信息或你想要的回复方式",
    customInstructionsPlaceholder: "例如：我是软件工程专业大三学生，喜欢带代码示例的解释...",
    exportHistory: "导出聊天记录",
    exportHistoryDesc: "下载所有聊天为JSON文件",
    export: "导出",
    clearHistory: "清除所有聊天记录",
    chatsCount: "个聊天将被永久删除",
    cancel: "取消",
    confirmDelete: "确认删除",
    deleteAll: "全部删除",
    quota: "使用配额",
    times: "次",
    remaining: "剩余",
    quotaReset: "配额每天午夜重置",
    logout: "退出登录",
    save: "保存",
    newChat: "新聊天",
    search: "搜索...",
    noHistory: "暂无历史记录",
    noSearchResult: "未找到聊天",
    sendMessage: "发送消息或粘贴图片...",
    dropFiles: "将文件拖放到这里",
    dropFilesDesc: "支持图片、PDF、文档（最大4MB）",
    quotaExhausted: "配额已用完",
    quotaExhaustedMsg: "次已使用",
    quotaResetIn: "小时",
    quotaResetDaily: "每天午夜重置",
    understood: "知道了",
    askAI: "提问或发送试卷照片让AI分析",
    preparing: "准备中...",
    loginTitle: "使用Google账号登录AI聊天",
    loginLimit: "每个账户限20次",
    loginNote: "任何Google账户均可即时登录",
    loading: "加载中...",
    today: "今天",
    yesterday: "昨天",
    last7days: "最近7天",
    last30days: "最近30天",
    memory: "记忆",
    memoryDesc: "允许AI在回复时参考和使用保存的记忆",
    memoryEnabled: "启用记忆",
    memoryManage: "管理记忆",
    memoryEmpty: "还没有记忆",
    memoryEmptyDesc: "AI会自动记住对话中的重要信息",
    memoryAdd: "添加记忆",
    memoryAddPlaceholder: "例如：我是软件工程专业大三学生",
    memoryClearAll: "清除所有记忆",
    memoryClearConfirm: "确认清除全部",
    memoryCount: "条记忆",
    memoryAuto: "自动",
    memoryManual: "手动",
    memoryImport: "导入",
    memoryExport: "导出",
    clearTTSCache: "清除TTS缓存",
    clearAllChats: "清除所有聊天",
    importJSON: "从JSON文件导入对话",
    revokePersonalization: "撤销所有用户个性化数据",
    revoke: "撤销",
    importMemory: "导入记忆",
    importMemoryDesc: "从其他AI平台导入记忆",
    importMethodPrompt: "通过提示词导入",
    importMethodPromptDesc: "复制提示词到其他AI，然后将回复粘贴回来",
    importMethodFile: "从文件导入",
    importMethodFileDesc: "上传ChatGPT或Claude的导出文件（.json, .zip）",
    importFrom: "导入自",
    importPromptCopy: "复制提示词",
    importPromptCopied: "已复制！",
    importPromptInstruction: "将此提示词粘贴到其他AI的聊天中，然后将回复复制回来",
    importPasteHere: "在此粘贴其他AI的回复...",
    importParseMemories: "提取记忆",
    importParsing: "正在提取记忆...",
    importReview: "查看记忆",
    importReviewDesc: "选择要导入的记忆",
    importSelectAll: "全选",
    importDeselectAll: "取消全选",
    importSelected: "导入所选",
    importSuccess: "导入成功！",
    importNoMemories: "未在文本中找到记忆",
    importBack: "返回",
    importUploadFile: "选择文件",
    importProcessing: "处理中...",
    importDragDrop: "拖放文件到这里，或点击浏览",
    importSupported: "支持 .json 和 .zip（最大50MB）",
    credits: "积分", creditsBalance: "积分余额", creditsTopup: "充值", creditsPromo: "促销码", creditsPromoPlaceholder: "输入促销码", creditsRedeem: "兑换", creditsHistory: "使用记录", creditsFree: "免费", creditsPerUse: "积分/次", creditsInsufficient: "积分不足", creditsTopupDesc: "充值积分以使用专业模型", creditsCostInfo: "免费模型无限使用，专业模型消耗积分", creditsUsage: "使用", creditsTopupBonus: "充值", creditsRefund: "退款",
  },
  ja: {
    settings: "設定",
    general: "一般",
    personalization: "カスタマイズ",
    dataControl: "データ管理",
    account: "アカウント",
    defaultModel: "デフォルトモデル",
    defaultModelDesc: "デフォルトのAIモデルを選択",
    autoDesc: "複雑さに応じて自動選択",
    proDesc: "高精度、複雑な質問向け",
    flashDesc: "高速、一般的な質問向け",
    claudeDesc: "AnthropicのClaude Sonnet",
    fontSize: "フォントサイズ",
    fontSizeDesc: "チャットのテキストサイズを調整",
    fontSmall: "小",
    fontMedium: "中",
    fontLarge: "大",
    sendWithEnter: "Enterで送信",
    sendWithEnterDesc: "Enterで送信（Shift+Enterで改行）",
    language: "言語",
    languageDesc: "AIとインターフェースの言語を変更",
    responseStyle: "回答スタイル",
    responseStyleDesc: "簡潔または詳細なAI回答を選択",
    concise: "簡潔",
    conciseDesc: "短く要点を押さえた回答",
    detailed: "詳細",
    detailedDesc: "例を含む詳しい回答",
    customInstructions: "カスタム指示",
    customInstructionsDesc: "AIにあなたの情報や希望する回答方法を伝えましょう",
    customInstructionsPlaceholder: "例：ソフトウェア工学科3年生です。コード例付きの説明が好みです...",
    exportHistory: "チャット履歴をエクスポート",
    exportHistoryDesc: "全チャットをJSONでダウンロード",
    export: "エクスポート",
    clearHistory: "全チャット履歴を削除",
    chatsCount: "件のチャットが完全に削除されます",
    cancel: "キャンセル",
    confirmDelete: "削除を確認",
    deleteAll: "全て削除",
    quota: "使用クォータ",
    times: "回",
    remaining: "残り",
    quotaReset: "クォータは毎日午前0時にリセット",
    logout: "ログアウト",
    save: "保存",
    newChat: "新しいチャット",
    search: "検索...",
    noHistory: "履歴がありません",
    noSearchResult: "チャットが見つかりません",
    sendMessage: "メッセージを送信、または画像を貼り付け...",
    dropFiles: "ファイルをここにドロップ",
    dropFilesDesc: "画像、PDF、ドキュメント対応（最大4MB）",
    quotaExhausted: "クォータ超過",
    quotaExhaustedMsg: "回使用済み",
    quotaResetIn: "時間",
    quotaResetDaily: "毎日午前0時にリセット",
    understood: "了解",
    askAI: "質問や試験の写真を送ってAIに分析してもらう",
    preparing: "準備中...",
    loginTitle: "GoogleアカウントでAIチャットにログイン",
    loginLimit: "アカウントあたり20回まで",
    loginNote: "Googleアカウントで即座にログイン可能",
    loading: "読み込み中...",
    today: "今日",
    yesterday: "昨日",
    last7days: "過去7日間",
    last30days: "過去30日間",
    memory: "メモリー",
    memoryDesc: "AIが保存されたメモリーを参照して回答に使用することを許可",
    memoryEnabled: "メモリーを有効化",
    memoryManage: "メモリーを管理",
    memoryEmpty: "メモリーがありません",
    memoryEmptyDesc: "AIは会話から重要な情報を自動的に記憶します",
    memoryAdd: "メモリーを追加",
    memoryAddPlaceholder: "例：ソフトウェア工学科3年生です",
    memoryClearAll: "全メモリーを削除",
    memoryClearConfirm: "全削除を確認",
    memoryCount: "件のメモリー",
    memoryAuto: "自動",
    memoryManual: "手動",
    memoryImport: "インポート",
    memoryExport: "エクスポート",
    clearTTSCache: "TTSキャッシュを削除",
    clearAllChats: "全チャットを削除",
    importJSON: "JSONファイルから会話をインポート",
    revokePersonalization: "全ユーザーパーソナライズデータを取消",
    revoke: "取消",
    importMemory: "メモリーをインポート",
    importMemoryDesc: "他のAIプラットフォームからメモリーをインポート",
    importMethodPrompt: "プロンプトでインポート",
    importMethodPromptDesc: "プロンプトを他のAIにコピーし、回答をここに貼り付け",
    importMethodFile: "ファイルからインポート",
    importMethodFileDesc: "ChatGPTやClaudeのエクスポートファイルをアップロード",
    importFrom: "インポート元",
    importPromptCopy: "プロンプトをコピー",
    importPromptCopied: "コピー済み！",
    importPromptInstruction: "このプロンプトを他のAIに貼り付け、回答をコピーして戻ってください",
    importPasteHere: "他のAIからの回答をここに貼り付け...",
    importParseMemories: "メモリーを抽出",
    importParsing: "メモリーを抽出中...",
    importReview: "メモリーを確認",
    importReviewDesc: "インポートするメモリーを選択",
    importSelectAll: "全選択",
    importDeselectAll: "全解除",
    importSelected: "選択をインポート",
    importSuccess: "インポート成功！",
    importNoMemories: "テキスト内にメモリーが見つかりません",
    importBack: "戻る",
    importUploadFile: "ファイルを選択",
    importProcessing: "処理中...",
    importDragDrop: "ファイルをドラッグ＆ドロップ、またはクリックして選択",
    importSupported: ".json と .zip に対応（最大50MB）",
    credits: "クレジット", creditsBalance: "クレジット残高", creditsTopup: "チャージ", creditsPromo: "プロモコード", creditsPromoPlaceholder: "プロモコードを入力", creditsRedeem: "引換", creditsHistory: "利用履歴", creditsFree: "無料", creditsPerUse: "クレジット/回", creditsInsufficient: "クレジット不足", creditsTopupDesc: "プロモデルを使うにはクレジットをチャージ", creditsCostInfo: "無料モデルは無制限、プロモデルはクレジット消費", creditsUsage: "利用", creditsTopupBonus: "チャージ", creditsRefund: "返金",
  },
  ko: {
    settings: "설정",
    general: "일반",
    personalization: "개인화",
    dataControl: "데이터 관리",
    account: "계정",
    defaultModel: "기본 모델",
    defaultModelDesc: "기본 AI 모델 선택",
    autoDesc: "복잡도에 따라 자동 선택",
    proDesc: "높은 정확도, 복잡한 질문에 적합",
    flashDesc: "빠름, 일반 질문에 적합",
    claudeDesc: "Anthropic의 Claude Sonnet",
    fontSize: "글꼴 크기",
    fontSizeDesc: "채팅 텍스트 크기 조정",
    fontSmall: "작게",
    fontMedium: "보통",
    fontLarge: "크게",
    sendWithEnter: "Enter로 전송",
    sendWithEnterDesc: "Enter를 눌러 전송 (Shift+Enter로 줄바꿈)",
    language: "언어",
    languageDesc: "AI 및 인터페이스 언어 변경",
    responseStyle: "응답 스타일",
    responseStyleDesc: "간결하거나 상세한 AI 응답 선택",
    concise: "간결",
    conciseDesc: "짧고 핵심적인 답변",
    detailed: "상세",
    detailedDesc: "예시를 포함한 자세한 답변",
    customInstructions: "사용자 지정 지침",
    customInstructionsDesc: "AI에게 당신에 대한 정보나 원하는 응답 방식을 알려주세요",
    customInstructionsPlaceholder: "예: 소프트웨어 공학과 3학년입니다. 코드 예시가 포함된 설명을 선호합니다...",
    exportHistory: "채팅 기록 내보내기",
    exportHistoryDesc: "모든 채팅을 JSON으로 다운로드",
    export: "내보내기",
    clearHistory: "모든 채팅 기록 삭제",
    chatsCount: "개의 채팅이 영구 삭제됩니다",
    cancel: "취소",
    confirmDelete: "삭제 확인",
    deleteAll: "모두 삭제",
    quota: "사용 할당량",
    times: "회",
    remaining: "남음",
    quotaReset: "할당량은 매일 자정에 초기화",
    logout: "로그아웃",
    save: "저장",
    newChat: "새 채팅",
    search: "검색...",
    noHistory: "기록 없음",
    noSearchResult: "채팅을 찾을 수 없음",
    sendMessage: "메시지를 보내거나 이미지를 붙여넣기...",
    dropFiles: "여기에 파일을 놓으세요",
    dropFilesDesc: "이미지, PDF, 문서 지원 (최대 4MB)",
    quotaExhausted: "할당량 초과",
    quotaExhaustedMsg: "회 사용됨",
    quotaResetIn: "시간",
    quotaResetDaily: "매일 자정에 초기화",
    understood: "알겠습니다",
    askAI: "질문하거나 시험 사진을 보내 AI 분석을 받으세요",
    preparing: "준비 중...",
    loginTitle: "Google 계정으로 AI 채팅에 로그인",
    loginLimit: "계정당 20회 제한",
    loginNote: "모든 Google 계정으로 즉시 로그인 가능",
    loading: "로딩 중...",
    today: "오늘",
    yesterday: "어제",
    last7days: "지난 7일",
    last30days: "지난 30일",
    memory: "메모리",
    memoryDesc: "AI가 저장된 메모리를 참조하여 응답에 사용하도록 허용",
    memoryEnabled: "메모리 활성화",
    memoryManage: "메모리 관리",
    memoryEmpty: "메모리가 없습니다",
    memoryEmptyDesc: "AI가 대화에서 중요한 정보를 자동으로 기억합니다",
    memoryAdd: "메모리 추가",
    memoryAddPlaceholder: "예: 소프트웨어 공학과 3학년입니다",
    memoryClearAll: "모든 메모리 삭제",
    memoryClearConfirm: "전체 삭제 확인",
    memoryCount: "개의 메모리",
    memoryAuto: "자동",
    memoryManual: "수동",
    memoryImport: "가져오기",
    memoryExport: "내보내기",
    clearTTSCache: "TTS 캐시 삭제",
    clearAllChats: "모든 채팅 삭제",
    importJSON: "JSON 파일에서 대화 가져오기",
    revokePersonalization: "모든 사용자 개인화 데이터 철회",
    revoke: "철회",
    importMemory: "메모리 가져오기",
    importMemoryDesc: "다른 AI 플랫폼에서 메모리 가져오기",
    importMethodPrompt: "프롬프트로 가져오기",
    importMethodPromptDesc: "프롬프트를 다른 AI에 복사하고 응답을 여기에 붙여넣기",
    importMethodFile: "파일에서 가져오기",
    importMethodFileDesc: "ChatGPT 또는 Claude 내보내기 파일 업로드",
    importFrom: "가져오기 소스",
    importPromptCopy: "프롬프트 복사",
    importPromptCopied: "복사됨!",
    importPromptInstruction: "이 프롬프트를 다른 AI에 붙여넣고 응답을 복사해 오세요",
    importPasteHere: "다른 AI의 응답을 여기에 붙여넣기...",
    importParseMemories: "메모리 추출",
    importParsing: "메모리 추출 중...",
    importReview: "메모리 확인",
    importReviewDesc: "가져올 메모리를 선택하세요",
    importSelectAll: "전체 선택",
    importDeselectAll: "전체 해제",
    importSelected: "선택 항목 가져오기",
    importSuccess: "가져오기 성공!",
    importNoMemories: "텍스트에서 메모리를 찾을 수 없습니다",
    importBack: "뒤로",
    importUploadFile: "파일 선택",
    importProcessing: "처리 중...",
    importDragDrop: "파일을 드래그 앤 드롭하거나 클릭하여 선택",
    importSupported: ".json 및 .zip 지원 (최대 50MB)",
    credits: "크레딧", creditsBalance: "크레딧 잔액", creditsTopup: "충전", creditsPromo: "프로모 코드", creditsPromoPlaceholder: "프로모 코드 입력", creditsRedeem: "사용", creditsHistory: "사용 내역", creditsFree: "무료", creditsPerUse: "크레딧/회", creditsInsufficient: "크레딧 부족", creditsTopupDesc: "프로 모델 사용을 위해 크레딧 충전", creditsCostInfo: "무료 모델은 무제한, 프로 모델은 크레딧 소모", creditsUsage: "사용", creditsTopupBonus: "충전", creditsRefund: "환불",
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
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-scale-in"
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
type SettingsTab = "general" | "personalization" | "data" | "account";

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
}: {
  open: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (s: AISettings) => void;
  user: { email: string; name: string; picture: string } | null;
  quota: { usage: number; limit: number; remaining: number; credits?: number; pricing?: Record<string, number> } | null;
  onLogout: () => void;
  onClearHistory: () => void;
  onExportHistory: () => void;
  onQuotaRefresh: () => void;
  sessions: ChatSession[];
  memories: MemoryItem[];
  onMemoriesChange: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
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
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showQuotaPopup, setShowQuotaPopup] = useState(false);
  const [showCreditPopup, setShowCreditPopup] = useState<{ needed: number; have: number; model: string } | null>(null);
  const [aiSettings, setAISettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [apiHealth, setApiHealth] = useState<Record<string, boolean>>({ gemini: true, claude: true, openrouter: true });
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"none" | "webSearch" | "generateImage" | "canvas" | "summarize">("none");
  const [searchingUrls, setSearchingUrls] = useState<string[]>([]);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [artifactVersions, setArtifactVersions] = useState<Artifact[]>([]);
  const [isArtifactComplete, setIsArtifactComplete] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(Math.max(550, typeof window !== "undefined" ? Math.floor(window.innerWidth * 0.45) : 600));
  const [isResizingCanvas, setIsResizingCanvas] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const canvasResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Auth & Quota state
  const [user, setUser] = useState<{ email: string; name: string; picture: string } | null>(null);
  const [quota, setQuota] = useState<{ usage: number; limit: number; remaining: number; credits?: number; pricing?: Record<string, number> } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [gsiReady, setGsiReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState("auto"); // auto, gemini-1.5-pro, gemini-1.5-flash
  const [generatingStatus, setGeneratingStatus] = useState("กำลังวิเคราะห์...");
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MODEL_OPTIONS = [
    { value: "auto", label: "Auto", icon: <Sparkles className="h-3.5 w-3.5 text-amber-500" />, desc: "อัตโนมัติ" },
    { value: "gemini-3.1-pro", label: "Pro 3.1", icon: <Zap className="h-3.5 w-3.5 text-violet-500" />, desc: "Gemini Direct", provider: "gemini" },
    { value: "gemini-2.5-flash", label: "Flash 2.5", icon: <Loader2 className="h-3.5 w-3.5 text-sky-500" />, desc: "Gemini Direct", provider: "gemini" },
    { value: "claude-sonnet", label: "Claude", icon: <Brain className="h-3.5 w-3.5 text-orange-500" />, desc: "Anthropic", provider: "claude" },
    { value: "openrouter/google/gemini-2.5-pro-preview", label: "Gemini 2.5 Pro", icon: <Zap className="h-3.5 w-3.5 text-emerald-500" />, desc: "OpenRouter", provider: "openrouter" },
    { value: "openrouter/google/gemini-2.5-flash", label: "Gemini 2.5 Flash", icon: <Loader2 className="h-3.5 w-3.5 text-emerald-500" />, desc: "OpenRouter", provider: "openrouter" },
    { value: "openrouter/openai/gpt-4.1", label: "GPT-4.1", icon: <Brain className="h-3.5 w-3.5 text-green-500" />, desc: "OpenRouter", provider: "openrouter" },
    { value: "openrouter/openai/o4-mini", label: "o4-mini", icon: <Brain className="h-3.5 w-3.5 text-green-500" />, desc: "OpenRouter", provider: "openrouter" },
    { value: "openrouter/deepseek/deepseek-r1", label: "DeepSeek R1", icon: <Brain className="h-3.5 w-3.5 text-blue-500" />, desc: "OpenRouter", provider: "openrouter" },
    { value: "openrouter/meta-llama/llama-4-maverick", label: "Llama 4", icon: <Brain className="h-3.5 w-3.5 text-indigo-500" />, desc: "OpenRouter", provider: "openrouter" },
  ];

  // Check if a model is available based on API health
  const isModelAvailable = useCallback((modelValue: string): boolean => {
    if (modelValue === "auto") return apiHealth.openrouter || apiHealth.gemini || apiHealth.claude;
    if (modelValue.startsWith("openrouter/")) return apiHealth.openrouter;
    if (modelValue.startsWith("claude-")) return apiHealth.claude;
    // Gemini direct models
    return apiHealth.gemini;
  }, [apiHealth]);

  const currentModel = MODEL_OPTIONS.find(m => m.value === selectedModel) || MODEL_OPTIONS[0];

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

  // Load sessions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("allquiz_ai_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
          setMessages(parsed[0].messages);
        }
      } catch (e) {
        console.error("Failed to load chat history", e);
      }
    }
  }, []);

  // Save sessions to localStorage (strip large base64 images to avoid QuotaExceededError)
  useEffect(() => {
    if (sessions.length > 0) {
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
    }
  }, [sessions]);

  // Sync messages with active session
  useEffect(() => {
    if (activeSessionId) {
      const session = sessions.find((s) => s.id === activeSessionId);
      if (session) {
        setMessages(session.messages);
      }
    } else {
      setMessages([]);
    }
  }, [activeSessionId, sessions]);

  const createNewSession = () => {
    const now = Date.now();
    const newSession: ChatSession = {
      id: now.toString(),
      title: "แชทใหม่",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    if (activeSessionId === id) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else {
        setActiveSessionId(null);
      }
    }
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

  const filteredSessions = sidebarSearch.trim()
    ? sessions.filter(s =>
        s.title.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
        s.messages.some(m => m.content.toLowerCase().includes(sidebarSearch.toLowerCase()))
      )
    : sessions;

  const groupedSessions = groupSessionsByDate(filteredSessions);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  }, []);

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
        alert(`ไฟล์ ${file.name} ใหญ่เกินไป (สูงสุด 4MB)`);
        continue;
      }

      if (attachments.length + newFiles.length >= 5) {
        alert("อัปโหลดได้สูงสุด 5 ไฟล์ต่อครั้ง");
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
      alert(aiSettings.language === "th" ? "เบราว์เซอร์ไม่รองรับการรับเสียง" : "Browser does not support speech recognition");
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
  }, [isRecording, aiSettings.language]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    const hasAttachments = attachments.length > 0;

    if ((!msg && !hasAttachments) || loading) return;

    // Check quota client-side for better UX
    if (quota && quota.usage >= quota.limit) {
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
                
                // --- ARTIFACT PARSING ---
                const { artifact: parsedArtifact, isComplete: artComplete } = parseArtifacts(fullText);
                if (parsedArtifact) {
                  setActiveArtifact(prev => {
                    // Keep existing version number if same content is streaming
                    if (prev && prev.title === parsedArtifact.title) {
                      return { ...parsedArtifact, id: prev.id, version: prev.version };
                    }
                    return parsedArtifact;
                  });
                  setIsArtifactComplete(artComplete);
                  if (!isCanvasOpen) setIsCanvasOpen(true);
                }
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

              // Update session with all collected data
              setSessions((prev) => prev.map(s => {
                if (s.id === currentSessionId) {
                  const updatedMessages = [...s.messages];
                  const lastMsg = updatedMessages[updatedMessages.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
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
            } catch {
              // skip
            }
          }
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

  const renderMarkdown = useCallback((text: string) => {
    // 0. KaTeX: render math formulas before anything else
    // Block math: $$...$$
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

    // Inline math: $...$  (but not $$)
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

    // 1. Extract fenced code blocks — apply syntax highlighting
    const codeBlocks: string[] = [];
    // Match both complete (```) and incomplete (streaming) code blocks
    processed = processed.replace(/```(\w*)\n([\s\S]*?)(?:```|$)/g, (_m, lang: string, code: string) => {
      const idx = codeBlocks.length;
      const trimmed = code.replace(/\n$/, "");
      const langLower = (lang || "").toLowerCase();
      const langLabel = langLower || "code";

      // Syntax highlight
      let highlighted: string;
      if (langLower && hljs.getLanguage(langLower)) {
        highlighted = hljs.highlight(trimmed, { language: langLower, ignoreIllegals: true }).value;
      } else if (trimmed.length > 20) {
        const auto = hljs.highlightAuto(trimmed);
        highlighted = auto.value;
      } else {
        highlighted = trimmed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }

      codeBlocks.push(
        `<div class="aq-code my-3 rounded-xl overflow-hidden border border-gray-700/50 bg-[#1e1e2e] shadow-lg">` +
        `<div class="flex items-center justify-between px-4 py-2 bg-[#181825] border-b border-gray-700/50">` +
        `<div class="flex items-center gap-2"><div class="flex gap-1.5"><span class="w-3 h-3 rounded-full bg-[#f38ba8]"></span><span class="w-3 h-3 rounded-full bg-[#f9e2af]"></span><span class="w-3 h-3 rounded-full bg-[#a6e3a1]"></span></div>` +
        `<span class="text-[11px] text-gray-400 font-medium ml-2">${langLabel}</span></div>` +
        `<button onclick="(function(b){var p=b.closest('.aq-code');var c=p&&p.querySelector('code');if(c){navigator.clipboard.writeText(c.textContent||'');b.innerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><polyline points=\\'20 6 9 17 4 12\\'></polyline></svg> Copied';setTimeout(function(){b.innerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><rect x=\\'9\\' y=\\'9\\' width=\\'13\\' height=\\'13\\' rx=\\'2\\' ry=\\'2\\'></rect><path d=\\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\'></path></svg> Copy'},1500)}})(this)" class="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 text-xs px-2.5 py-1 rounded-md hover:bg-white/10 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy</button>` +
        `</div>` +
        `<pre class="p-4 text-[13px] leading-relaxed overflow-x-auto" style="word-break:break-word;overflow-wrap:break-word;white-space:pre-wrap"><code class="hljs">${highlighted}</code></pre>` +
        `</div>`
      );
      return `\x00CODE${idx}\x00`;
    });

    // 2. Parse tables
    processed = processed.replace(
      /(?:^|\n)((?:\|[^\n]+\|\s*\n){2,})/g,
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

    // 3. Inline formatting
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

    // 4. Restore code blocks and math blocks
    processed = processed.replace(/\x00CODE(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)]);
    processed = processed.replace(/\x00MATH(\d+)\x00/g, (_m, idx) => mathBlocks[Number(idx)] || "");

    return processed;
  }, []);

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
    setSessions([]);
    setActiveSessionId(null);
    localStorage.removeItem("allquiz_ai_sessions");
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
            <span className="text-xs">(จำกัด 20 ครั้งต่อบัญชี)</span>
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
    <div className="flex h-[100dvh] md:h-[calc(100vh-64px)] bg-background overflow-hidden">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? "w-64" : "w-0"
        } transition-all duration-200 border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden z-30 ${
          isSidebarOpen ? "fixed md:relative inset-y-0 left-0 shadow-xl md:shadow-none" : ""
        }`}
      >
        <div className="p-2 flex flex-col h-full w-64 shrink-0">
          {/* New Chat + Close */}
          <div className="flex items-center gap-1.5 mb-2">
            <Button
              onClick={createNewSession}
              variant="outline"
              className="flex-1 justify-start gap-2 h-9 text-sm"
            >
              <Plus className="h-4 w-4" />
              แชทใหม่
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={() => setIsSidebarOpen(false)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="ค้นหา..."
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-transparent border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {filteredSessions.length === 0 ? (
              <div className="px-2 py-10 text-center text-muted-foreground">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-40" />
                <p className="text-xs">
                  {sidebarSearch ? "ไม่พบแชทที่ค้นหา" : "ยังไม่มีประวัติ"}
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
                      onClick={() => { setActiveSessionId(s.id); setEditingSessionId(null); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                      className={`group/item relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                        activeSessionId === s.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
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
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={(e) => startEditing(s, e)}
                              className="p-1 hover:bg-accent text-muted-foreground hover:text-foreground rounded-sm transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => deleteSession(s.id, e)}
                              className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-sm transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
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
                <div className="w-full h-1.5 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      quota.remaining <= 3 ? "bg-red-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${(quota.remaining / quota.limit) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 flex-1 transition-colors"
              >
                <Settings className="h-3 w-3" />
                ตั้งค่า
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive px-2 py-1 transition-colors"
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
        className="flex-1 flex flex-col min-w-0 relative h-full"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drag overlay with blur */}
        {isDragging && (
          <div className="absolute inset-0 z-50 backdrop-blur-sm bg-white/60 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center pointer-events-none">
            <div className="text-center bg-white/80 rounded-xl px-8 py-6 shadow-lg">
              <Paperclip className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">วางไฟล์ที่นี่</p>
              <p className="text-xs text-gray-500 mt-1">รองรับรูปภาพ, PDF, เอกสาร (สูงสุด 4MB)</p>
            </div>
          </div>
        )}
        {/* Sidebar Toggle */}
        {!isSidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-3 top-3 z-50 h-8 w-8"
            onClick={() => setIsSidebarOpen(true)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}

        <main className="flex-1 overflow-hidden flex flex-col">
          <div ref={scrollRef} className={`flex-1 overflow-y-auto px-4 py-6 scroll-smooth ${
            aiSettings.fontSize === "small" ? "text-xs" : aiSettings.fontSize === "large" ? "text-base" : "text-sm"
          }`}>
            <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-12 w-12 mb-4 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-1">
                Allquiz AI
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8">
                ถามหรือส่งรูปข้อสอบเพื่อให้ AI ช่วยวิเคราะห์
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    disabled={!!(quota && quota.usage >= quota.limit)}
                    onClick={() => s.includes("📷") ? fileInputRef.current?.click() : sendMessage(s)}
                    className="group text-left px-3 py-2.5 rounded-md border border-gray-200 hover:bg-accent/50 transition-colors disabled:opacity-50"
                  >
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex group ${
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              } gap-3 w-full`}
            >
              <div className="shrink-0 pt-0.5">
                {m.role === "assistant" ? (
                  <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                    <Zap className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-md overflow-hidden border border-gray-200">
                    {user ? (
                      <img src={user.picture} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center"><User className="h-4 w-4 text-muted-foreground" /></div>
                    )}
                  </div>
                )}
              </div>

              <div className={`flex flex-col max-w-[85%] sm:max-w-[80%] min-w-0 ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3 py-2 rounded-lg text-sm overflow-hidden break-words ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.files && m.files.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {m.files.map((file, idx) => (
                        <div key={idx} className="relative rounded-md overflow-hidden border border-gray-200">
                          {file.type.startsWith("image/") ? (
                            <img src={file.data} alt={file.name} className="h-20 w-20 object-cover" />
                          ) : (
                            <div className="h-20 w-20 flex flex-col items-center justify-center p-1.5 text-center bg-muted">
                              <FileText className="h-6 w-6 text-muted-foreground mb-0.5" />
                              <span className="text-[9px] line-clamp-2 break-all text-muted-foreground">{file.name}</span>
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
                        // Strip <canvas> tags from chat display — content shows in Canvas panel
                        const { cleanedContent: answer, artifact: msgArtifact } = parseArtifacts(rawAnswer);
                        const isStreaming = loading && i === messages.length - 1;
                        const isStillThinking = isStreaming && !m.content.includes("</think>");
                        const isWebSearching = isStreaming && activeTool === "webSearch";
                        // Hide thinking for flash/small models — their thinking is too shallow to be useful
                        const isProModel = selectedModel.includes("pro") || selectedModel.includes("opus") || selectedModel.includes("3.1");
                        const isAutoMaybeFlash = selectedModel === "auto" && thinking && thinking.split("\n").filter(l => l.trim()).length <= 2;
                        const showThinking = isProModel || (selectedModel === "auto" && !isAutoMaybeFlash);
                        return (
                          <div className="w-full overflow-hidden text-left">
                            {showThinking && (thinking || isStillThinking) && (
                              <ThinkingBlock
                                thinking={thinking}
                                isStreaming={isStillThinking}
                                status={generatingStatus}
                              />
                            )}
                            {answer && (
                              <div
                                className="text-sm leading-relaxed prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 w-full max-w-none text-left"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(answer.replace(/\*\(Artifact generated in Canvas\)\*/g, "")) }}
                              />
                            )}
                            {/* Open Canvas button */}
                            {msgArtifact && (
                              <button
                                onClick={() => {
                                  setActiveArtifact(msgArtifact);
                                  setIsArtifactComplete(true);
                                  setIsCanvasOpen(true);
                                }}
                                className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all text-sm text-gray-700 group"
                              >
                                <div className="p-1 rounded-md bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                                  <SquarePen className="h-3.5 w-3.5 text-emerald-600" />
                                </div>
                                <span className="font-medium">{msgArtifact.title}</span>
                                <span className="text-[10px] text-gray-400 uppercase">{msgArtifact.type}</span>
                              </button>
                            )}
                            {/* Generated images */}
                            {m.images && m.images.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-3">
                                {m.images.map((img, imgIdx) => (
                                  <div key={imgIdx} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-200">
                                    <img
                                      src={img}
                                      alt={`Generated ${imgIdx + 1}`}
                                      className="w-full max-w-[240px] sm:max-w-sm max-h-56 sm:max-h-72 object-contain cursor-pointer"
                                      onClick={() => setPreviewImage(img)}
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setPreviewImage(img); }}
                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white/90 hover:bg-white text-gray-800 text-xs font-medium transition-colors"
                                      >
                                        <Search className="h-3 w-3" />
                                        {aiSettings.language === "th" ? "ดูรูป" : "Preview"}
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDownloadImage(img, `generated-image-${imgIdx + 1}.png`); }}
                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white/90 hover:bg-white text-gray-800 text-xs font-medium transition-colors"
                                      >
                                        <Download className="h-3 w-3" />
                                        {aiSettings.language === "th" ? "ดาวน์โหลด" : "Download"}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Search sources */}
                            {m.sources && m.sources.length > 0 && (
                              <div className="mt-3 border-t border-gray-100 pt-2">
                                <p className="text-[11px] font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {aiSettings.language === "th" ? "แหล่งอ้างอิง" : "Sources"}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {m.sources.map((src, srcIdx) => (
                                    <a key={srcIdx} href={src.url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 text-[11px] text-gray-600 hover:text-gray-900 transition-colors border border-gray-100">
                                      <ExternalLink className="h-2.5 w-2.5" />
                                      <span className="max-w-[180px] truncate">{src.title}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex items-center gap-2 py-1">
                        {activeTool === "generateImage" ? (
                          <div className="flex flex-col items-center gap-2 py-3 px-6">
                            <div className="relative h-10 w-10">
                              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-violet-400 to-pink-400 animate-pulse" />
                              <div className="absolute inset-1 rounded-md bg-white flex items-center justify-center">
                                <Image className="h-5 w-5 text-violet-500" />
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">{generatingStatus}</span>
                          </div>
                        ) : activeTool === "webSearch" ? (
                          <div className="flex flex-col gap-1.5 py-1 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <Globe className="h-3.5 w-3.5 animate-pulse text-blue-500 shrink-0" />
                              <span className="text-sm text-muted-foreground">{generatingStatus}</span>
                            </div>
                            {searchingUrls.length > 0 && (
                              <div className="flex flex-wrap gap-1 ml-5">
                                {searchingUrls.map((url, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-[10px] text-blue-600">
                                    <Globe className="h-2.5 w-2.5" />
                                    {url}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{generatingStatus}</span>
                          </>
                        )}
                      </div>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  )}
                </div>

                {/* Message action toolbar */}
                {!loading && m.content && (
                  <div className={`flex items-center gap-0.5 mt-1 ${m.role === "user" ? "mr-1 flex-row-reverse" : "ml-1"} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {/* Copy */}
                    <button
                      onClick={() => copyMessage(m.content, i)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
                      title={aiSettings.language === "th" ? "คัดลอก" : "Copy"}
                    >
                      {copiedIndex === i ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>

                    {/* Retry (assistant) / Edit (user) */}
                    {m.role === "assistant" ? (
                      <button
                        onClick={() => retryMessage(i)}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
                        title={aiSettings.language === "th" ? "ลองอีกครั้ง" : "Retry"}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => editMessage(i)}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
                        title={aiSettings.language === "th" ? "แก้ไข" : "Edit"}
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Thumbs (assistant only) */}
                    {m.role === "assistant" && (
                      <>
                        <button className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors" title={aiSettings.language === "th" ? "ดี" : "Good"}>
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors" title={aiSettings.language === "th" ? "ไม่ดี" : "Bad"}>
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

        </main>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-background px-4 py-3 shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="border border-gray-200 rounded-lg bg-background focus-within:ring-1 focus-within:ring-ring transition-shadow">
              {attachments.length > 0 && (
                <div className="px-3 pt-2.5 pb-1 border-b border-gray-200">
                  <div className="flex flex-wrap gap-1.5">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="relative group/file shrink-0">
                        {file.type.startsWith("image/") ? (
                          <img src={file.data} className="h-12 w-12 object-cover rounded-md border border-gray-200" />
                        ) : (
                          <div className="h-12 w-auto min-w-[48px] max-w-[120px] bg-muted rounded-md border border-gray-200 flex items-center gap-1.5 px-2 py-1">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-[10px] line-clamp-2 break-all text-muted-foreground">{file.name}</span>
                          </div>
                        )}
                        <button
                          onClick={() => removeAttachment(idx)}
                          className="absolute -top-1 -right-1 h-4 w-4 bg-foreground text-background rounded-full flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-opacity"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && aiSettings.sendWithEnter) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                onPaste={handlePaste}
                placeholder="ส่งข้อความ หรือวางรูปภาพ..."
                rows={1}
                className="w-full px-3 py-2.5 bg-transparent text-sm focus:outline-none resize-none min-h-[36px] max-h-[200px] text-foreground placeholder:text-muted-foreground"
              />

              {/* Active tool indicator */}
              {activeTool !== "none" && (
                <div className="flex items-center gap-1.5 px-3 pb-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    activeTool === "webSearch" ? "bg-blue-50 text-blue-700"
                    : activeTool === "canvas" ? "bg-emerald-50 text-emerald-700"
                    : "bg-violet-50 text-violet-700"
                  }`}>
                    {activeTool === "webSearch" ? <Globe className="h-3 w-3" />
                      : activeTool === "canvas" ? <SquarePen className="h-3 w-3" />
                      : <Image className="h-3 w-3" />}
                    {activeTool === "webSearch"
                      ? (aiSettings.language === "th" ? "ค้นหาเว็บ" : "Web search")
                      : activeTool === "canvas"
                      ? "Canvas"
                      : (aiSettings.language === "th" ? "สร้างรูปภาพ" : "Image generation")
                    }
                    <button onClick={() => { setActiveTool("none"); if (activeTool === "canvas") setIsCanvasOpen(false); }} className="ml-0.5 hover:opacity-70">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-0.5">
                  {/* Tools Menu (+ button) */}
                  <div className="relative" ref={toolsMenuRef}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
                      disabled={loading || !!(quota && quota.usage >= quota.limit)}
                    >
                      <Plus className={`h-4 w-4 transition-transform duration-200 ${isToolsMenuOpen ? "rotate-45" : ""}`} />
                    </Button>

                    {isToolsMenuOpen && (
                      <div className="absolute bottom-full left-0 mb-1.5 w-52 sm:w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1.5 z-50 max-h-[60vh] overflow-y-auto">
                        <button
                          onClick={() => { fileInputRef.current?.click(); setIsToolsMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                        >
                          <Paperclip className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-900">{aiSettings.language === "th" ? "เพิ่มรูปภาพและไฟล์" : "Add images & files"}</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTool(activeTool === "generateImage" ? "none" : "generateImage");
                            setIsToolsMenuOpen(false);
                            inputRef.current?.focus();
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${activeTool === "generateImage" ? "bg-violet-50 text-violet-700" : "hover:bg-gray-50"}`}
                        >
                          <Image className={`h-4 w-4 ${activeTool === "generateImage" ? "text-violet-500" : "text-gray-500"}`} />
                          <span className="text-sm flex-1">{aiSettings.language === "th" ? "สร้างรูปภาพ" : "Generate image"}</span>
                          {activeTool === "generateImage" && <Check className="h-3.5 w-3.5 text-violet-500" />}
                        </button>
                        <button
                          onClick={() => {
                            setActiveTool(activeTool === "canvas" ? "none" : "canvas");
                            setIsToolsMenuOpen(false);
                            inputRef.current?.focus();
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${activeTool === "canvas" ? "bg-emerald-50 text-emerald-700" : "hover:bg-gray-50"}`}
                        >
                          <SquarePen className={`h-4 w-4 ${activeTool === "canvas" ? "text-emerald-500" : "text-gray-500"}`} />
                          <span className="text-sm flex-1">Canvas</span>
                          {activeTool === "canvas" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                        </button>
                        <button
                          onClick={() => {
                            setActiveTool(activeTool === "webSearch" ? "none" : "webSearch");
                            setIsToolsMenuOpen(false);
                            inputRef.current?.focus();
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${activeTool === "webSearch" ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"}`}
                        >
                          <Globe className={`h-4 w-4 ${activeTool === "webSearch" ? "text-blue-500" : "text-gray-500"}`} />
                          <span className="text-sm flex-1">{aiSettings.language === "th" ? "ค้นหาเว็บ" : "Web search"}</span>
                          {activeTool === "webSearch" && <Check className="h-3.5 w-3.5 text-blue-500" />}
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => {
                            setInput(aiSettings.language === "th" ? "สรุปเนื้อหาวิชา " : "Summarize subject ");
                            setIsToolsMenuOpen(false);
                            inputRef.current?.focus();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                        >
                          <GraduationCap className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-900">{aiSettings.language === "th" ? "ศึกษาและเรียนรู้" : "Study & learn"}</span>
                        </button>
                        <button
                          onClick={() => {
                            setInput(aiSettings.language === "th" ? "สร้างแบบทดสอบจากเนื้อหา: " : "Create quiz from: ");
                            setIsToolsMenuOpen(false);
                            inputRef.current?.focus();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                        >
                          <ClipboardList className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-900">{aiSettings.language === "th" ? "แบบทดสอบ" : "Quiz"}</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTool(activeTool === "webSearch" ? "none" : "webSearch");
                            setInput(aiSettings.language === "th" ? "หาข้อมูลเชิงลึกเกี่ยวกับ: " : "Deep research about: ");
                            setIsToolsMenuOpen(false);
                            inputRef.current?.focus();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                        >
                          <SearchIcon className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-900">{aiSettings.language === "th" ? "การหาข้อมูลเชิงลึก" : "Deep research"}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="h-4 w-px bg-gray-200 mx-1" />

                  <div className="relative" ref={modelPickerRef}>
                    <button
                      onClick={() => setIsModelPickerOpen(!isModelPickerOpen)}
                      className="flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      {currentModel.icon}
                      <span>{currentModel.label}</span>
                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isModelPickerOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isModelPickerOpen && (
                      <div className="absolute bottom-full left-0 mb-1.5 w-44 sm:w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50">
                        <div className="px-2 py-1">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Model</span>
                        </div>
                        {MODEL_OPTIONS.map((model) => {
                          const available = isModelAvailable(model.value);
                          const cost = quota?.pricing?.[model.value] ?? (model.value === "auto" ? 0 : undefined);
                          const hasCredits = cost === undefined || cost === 0 || (quota?.credits ?? 0) >= cost;
                          const canUse = available && hasCredits;
                          return (
                            <button
                              key={model.value}
                              onClick={() => { if (canUse) { setSelectedModel(model.value); setIsModelPickerOpen(false); } }}
                              disabled={!canUse}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                                !canUse ? "opacity-40 cursor-not-allowed" :
                                selectedModel === model.value ? "bg-gray-100" : "hover:bg-gray-50"
                              }`}
                            >
                              {model.icon}
                              <span className="text-xs flex-1 text-gray-900">{model.label}</span>
                              {!available ? (
                                <span className="text-[9px] text-red-400 font-medium">ไม่พร้อม</span>
                              ) : cost !== undefined && cost > 0 ? (
                                <span className={`text-[9px] font-semibold tabular-nums ${hasCredits ? "text-amber-500" : "text-red-400"}`}>
                                  {cost}cr
                                </span>
                              ) : cost === 0 ? (
                                <span className="text-[9px] text-emerald-500 font-medium">FREE</span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">{model.desc}</span>
                              )}
                              {selectedModel === model.value && canUse && <Check className="h-3 w-3 text-primary" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${isRecording ? "bg-red-500 text-white animate-pulse" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                    title={isRecording ? (aiSettings.language === "th" ? "หยุดฟัง" : "Stop listening") : (aiSettings.language === "th" ? "พูดข้อความ" : "Voice input")}
                  >
                    {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                  <Button
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={() => sendMessage()}
                    disabled={(!input.trim() && attachments.length === 0) || loading || !!(quota && quota.usage >= quota.limit)}
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowUp className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-center text-muted-foreground mt-2">
              Allquiz AI can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </div>

      {/* Canvas Side Panel */}
      {isCanvasOpen && activeArtifact && (
        <div
          className="h-full flex-shrink-0 hidden md:flex relative"
          style={{ width: canvasWidth }}
        >
          {/* Resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group hover:bg-primary/20 active:bg-primary/30 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              canvasResizeRef.current = { startX: e.clientX, startWidth: canvasWidth };
              setIsResizingCanvas(true);
            }}
          >
            <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-gray-300 group-hover:bg-primary/50 transition-colors" />
          </div>
          <div className="flex-1 border-l border-gray-200 overflow-hidden">
            <CanvasView
              artifact={activeArtifact}
              versions={artifactVersions}
              onSelectVersion={(v) => setActiveArtifact(v)}
              isOpen={isCanvasOpen}
              isComplete={isArtifactComplete}
              onClose={() => { setIsCanvasOpen(false); setActiveArtifact(null); }}
            />
          </div>
        </div>
      )}

      {/* Canvas Mobile Full-Screen */}
      {isCanvasOpen && activeArtifact && (
        <div className="fixed inset-0 z-[80] bg-white md:hidden">
          <CanvasView
            artifact={activeArtifact}
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadImage(previewImage)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-100 text-gray-800 text-sm font-medium shadow-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                {aiSettings.language === "th" ? "ดาวน์โหลดรูปภาพ" : "Download Image"}
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
    </div>
  );
}
