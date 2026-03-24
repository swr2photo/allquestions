"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
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
} from "lucide-react";

function parseThinking(content: string): { thinking: string; answer: string } {
  const thinkMatch = content.match(/<think>([\s\S]*?)(<\/think>|$)/);
  if (!thinkMatch) return { thinking: "", answer: content };
  
  const thinking = thinkMatch[1].trim();
  const afterThink = content.replace(/<think>[\s\S]*?(<\/think>|$)/, "").trim();
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
}

const DEFAULT_SETTINGS: AISettings = {
  defaultModel: "auto",
  fontSize: "medium",
  responseStyle: "concise",
  customInstructions: "",
  sendWithEnter: true,
  language: "th",
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
  sessions,
}: {
  open: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (s: AISettings) => void;
  user: { email: string; name: string; picture: string } | null;
  quota: { usage: number; limit: number; remaining: number } | null;
  onLogout: () => void;
  onClearHistory: () => void;
  onExportHistory: () => void;
  sessions: ChatSession[];
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [draft, setDraft] = useState<AISettings>(settings);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const lang = draft.language;

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

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
                    {(["auto", "gemini-3.1-pro", "gemini-2.5-flash"] as const).map((value) => (
                      <label
                        key={value}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          draft.defaultModel === value ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input type="radio" name="model" value={value} checked={draft.defaultModel === value}
                          onChange={() => setDraft({ ...draft, defaultModel: value })} className="accent-primary" />
                        <div>
                          <span className="text-sm font-medium text-gray-900">{value === "auto" ? "Auto" : value === "gemini-3.1-pro" ? "Pro 3.1" : "Flash 2.5"}</span>
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
                <div className="flex items-center justify-between p-4 rounded-lg border border-red-100 bg-red-50/50">
                  <div>
                    <span className="text-sm font-medium text-gray-900 block">{t("clearHistory", lang)}</span>
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
                    <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)} className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("deleteAll", lang)}
                    </Button>
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
                {quota && (
                  <div className="p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-900">{t("quota", lang)}</span>
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
  const [aiSettings, setAISettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [isDragging, setIsDragging] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"none" | "webSearch" | "generateImage">("none");
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Auth & Quota state
  const [user, setUser] = useState<{ email: string; name: string; picture: string } | null>(null);
  const [quota, setQuota] = useState<{ usage: number; limit: number; remaining: number } | null>(null);
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
    { value: "gemini-3.1-pro", label: "Pro 3.1", icon: <Zap className="h-3.5 w-3.5 text-violet-500" />, desc: "แม่นยำสูง" },
    { value: "gemini-2.5-flash", label: "Flash 2.5", icon: <Loader2 className="h-3.5 w-3.5 text-sky-500" />, desc: "เร็ว" },
  ];

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

  // Load settings from localStorage
  useEffect(() => {
    const loaded = loadSettings();
    setAISettings(loaded);
    setSelectedModel(loaded.defaultModel);
  }, []);

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
      let searchingUrls: string[] = [];

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
                searchingUrls = siteNames;
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

    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const errorMsg = isAbort
        ? "❌ หมดเวลาการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง"
        : `❌ เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : "ไม่สามารถเชื่อมต่อ AI ได้"}`;
      setSessions((prev) => prev.map(s => {
        if (s.id === currentSessionId) {
          const updatedMessages = [...s.messages];
          const lastMsg = updatedMessages[updatedMessages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            updatedMessages[updatedMessages.length - 1] = { ...lastMsg, content: errorMsg };
          } else {
            updatedMessages.push({ role: "assistant", content: errorMsg });
          }
          return { ...s, messages: updatedMessages };
        }
        return s;
      }));
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMarkdown = (text: string) => {
    let html = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/^### (.*$)/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="font-bold text-xl mt-3 mb-1">$1</h1>')
      .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal">$1. $2</li>')
      .replace(/✓/g, '<span class="text-emerald-600 font-bold">✓</span>')
      .replace(/✗/g, '<span class="text-red-400">✗</span>')
      .replace(/\n/g, "<br/>");
    return html;
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
    <div className="flex h-[calc(100vh-64px)] bg-background overflow-hidden">
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
        } transition-all duration-200 border-r border-gray-200 bg-sidebar flex flex-col h-full overflow-hidden z-30 ${
          isSidebarOpen ? "fixed md:relative inset-y-0 left-0" : ""
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

              <div className={`flex flex-col max-w-[90%] sm:max-w-[85%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3 py-2 rounded-lg text-sm ${
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
                        const { thinking, answer } = parseThinking(m.content);
                        const isStreaming = loading && i === messages.length - 1;
                        const isStillThinking = isStreaming && !m.content.includes("</think>");
                        const isWebSearching = isStreaming && activeTool === "webSearch";
                        return (
                          <div className="w-full overflow-hidden text-left">
                            {(thinking || isStillThinking) && (
                              <ThinkingBlock
                                thinking={thinking}
                                isStreaming={isStillThinking}
                                status={generatingStatus}
                              />
                            )}
                            {answer && (
                              <div
                                className="text-sm leading-relaxed prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 w-full max-w-none text-left"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(answer) }}
                              />
                            )}
                            {/* Generated images */}
                            {m.images && m.images.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {m.images.map((img, imgIdx) => (
                                  <a key={imgIdx} href={img} target="_blank" rel="noopener noreferrer" download={`generated-${imgIdx}.png`}
                                    className="block rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow">
                                    <img src={img} alt={`Generated ${imgIdx + 1}`} className="max-w-[250px] sm:max-w-xs max-h-48 sm:max-h-64 object-contain" />
                                  </a>
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
                          <div className="flex flex-col gap-1.5 py-1">
                            <div className="flex items-center gap-2">
                              <Globe className="h-3.5 w-3.5 animate-pulse text-blue-500" />
                              <span className="text-sm text-muted-foreground">{generatingStatus}</span>
                            </div>
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
                    activeTool === "webSearch" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
                  }`}>
                    {activeTool === "webSearch" ? <Globe className="h-3 w-3" /> : <Image className="h-3 w-3" />}
                    {activeTool === "webSearch"
                      ? (aiSettings.language === "th" ? "ค้นหาเว็บ" : "Web search")
                      : (aiSettings.language === "th" ? "สร้างรูปภาพ" : "Image generation")
                    }
                    <button onClick={() => setActiveTool("none")} className="ml-0.5 hover:opacity-70">
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
                      <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1.5 z-50">
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
                      <div className="absolute bottom-full left-0 mb-1.5 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50">
                        <div className="px-2 py-1">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Model</span>
                        </div>
                        {MODEL_OPTIONS.map((model) => (
                          <button
                            key={model.value}
                            onClick={() => { setSelectedModel(model.value); setIsModelPickerOpen(false); }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                              selectedModel === model.value ? "bg-gray-100" : "hover:bg-gray-50"
                            }`}
                          >
                            {model.icon}
                            <span className="text-xs flex-1 text-gray-900">{model.label}</span>
                            <span className="text-[10px] text-muted-foreground">{model.desc}</span>
                            {selectedModel === model.value && <Check className="h-3 w-3 text-primary" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

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

            <p className="text-[10px] text-center text-muted-foreground mt-2">
              Allquiz AI can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </div>

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
        sessions={sessions}
      />

      {/* Quota Exceeded Popup */}
      {showQuotaPopup && quota && (
        <QuotaExceededPopup
          limit={quota.limit}
          onClose={() => setShowQuotaPopup(false)}
          lang={aiSettings.language}
        />
      )}
    </div>
  );
}
