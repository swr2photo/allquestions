// Draws a timetable onto a <canvas> for image / PDF export.
//
// Rendered directly with the Canvas 2D API (no html2canvas): the output is
// identical on every device, works offline and stays crisp at 2–3× scale.
// Thai line-breaking uses Intl.Segmenter so names wrap at word boundaries.
//
// Layout: a full-bleed background (colour/gradient + optional pattern) with
// three floating cards on top — header, week grid, summary — like a poster.

import {
  DAY_COLORS,
  DAY_EN,
  DAY_NAMES,
  DAY_SHORT,
  PALETTE,
  fmtDuration,
  fmtExamDate,
  fmtRange,
  layoutLanes,
  type PlannedEntry,
} from "./timetable";

export type ExportThemeId =
  | "classic"
  | "pastel"
  | "midnight"
  | "minimal"
  | "sunset"
  | "ocean"
  | "sakura"
  | "matcha"
  | "kraft";
export type ExportLayoutId = "landscape" | "a4" | "story" | "square";
export type ExportFormat = "png" | "jpeg" | "pdf";
export type ExportPatternId =
  | "none"
  | "dots"
  | "grid"
  | "diagonal"
  | "waves"
  | "zigzag"
  | "gingham"
  | "plus"
  | "hearts"
  | "flowers"
  | "stars"
  | "bubbles"
  | "confetti";
export type ExportBlockStyle = "soft" | "solid" | "outline" | "sticker";

export interface ExportOptions {
  theme: ExportThemeId;
  layout: ExportLayoutId;
  format: ExportFormat;
  scale: 1 | 2 | 3;
  title: string;
  pattern: ExportPatternId;
  patternStrength: 1 | 2 | 3;
  blockStyle: ExportBlockStyle;
  dayColors: boolean;
  showTime: boolean;
  showRoom: boolean;
  showSec: boolean;
  showInstructor: boolean;
  showSummary: boolean;
  showExams: boolean;
  weekend: "auto" | "show" | "hide";
}

export const DEFAULT_EXPORT: ExportOptions = {
  theme: "classic",
  layout: "landscape",
  format: "png",
  scale: 2,
  title: "ตารางเรียนของฉัน",
  pattern: "dots",
  patternStrength: 2,
  blockStyle: "soft",
  dayColors: true,
  showTime: true,
  showRoom: true,
  showSec: true,
  showInstructor: false,
  showSummary: true,
  showExams: false,
  weekend: "auto",
};

interface BlockColor {
  bg: string;
  border: string;
  text: string;
}

export interface ExportTheme {
  id: ExportThemeId;
  name: string;
  /** solid colour or two gradient stops (top-left → bottom-right) */
  bg: string | [string, string];
  surface: string;
  ink: string;
  muted: string;
  grid: string;
  headBg: string;
  dark: boolean;
  blocks: BlockColor[];
  /** chart series — validated categorical slots (light/dark steps) */
  series: [string, string, string];
  track: string;
  /** "r,g,b" + base alpha for background patterns */
  patternInk: string;
  patternAlpha: number;
  /** title icon / stat pills */
  accent: string;
  /** text drawn straight on the background (footer) */
  onBg: string;
}

const LIGHT_SERIES: [string, string, string] = ["#2a78d6", "#eb6834", "#1baf7a"];
const DARK_SERIES: [string, string, string] = ["#3987e5", "#d95926", "#199e70"];
const CLASSIC_BLOCKS: BlockColor[] = PALETTE.map((p) => ({ ...p }));
const PASTEL_BLOCKS: BlockColor[] = [
  { bg: "#ffe4e6", border: "#fb7185", text: "#881337" },
  { bg: "#e0f2fe", border: "#38bdf8", text: "#0c4a6e" },
  { bg: "#fef9c3", border: "#eab308", text: "#713f12" },
  { bg: "#dcfce7", border: "#4ade80", text: "#14532d" },
  { bg: "#ede9fe", border: "#a78bfa", text: "#4c1d95" },
  { bg: "#ffedd5", border: "#fb923c", text: "#7c2d12" },
  { bg: "#cffafe", border: "#22d3ee", text: "#164e63" },
  { bg: "#fae8ff", border: "#e879f9", text: "#701a75" },
  { bg: "#f1f5f9", border: "#94a3b8", text: "#1e293b" },
  { bg: "#ecfccb", border: "#84cc16", text: "#365314" },
];
const VINTAGE_BLOCKS: BlockColor[] = [
  { bg: "#fde2c8", border: "#c2410c", text: "#7c2d12" },
  { bg: "#d9ead3", border: "#4d7c0f", text: "#365314" },
  { bg: "#dbe7f3", border: "#1d4ed8", text: "#1e3a8a" },
  { bg: "#f6d6d6", border: "#b91c1c", text: "#7f1d1d" },
  { bg: "#e9dcf3", border: "#7e22ce", text: "#581c87" },
  { bg: "#fbeec1", border: "#a16207", text: "#713f12" },
  { bg: "#d5ece9", border: "#0f766e", text: "#134e4a" },
  { bg: "#f3dce8", border: "#be185d", text: "#831843" },
  { bg: "#e2e4f0", border: "#4338ca", text: "#312e81" },
  { bg: "#e6efd0", border: "#65a30d", text: "#3f6212" },
];

export const EXPORT_THEMES: ExportTheme[] = [
  {
    id: "classic",
    name: "คลาสสิก",
    bg: ["#ecfdf5", "#e0f2fe"],
    surface: "#ffffff",
    ink: "#0b0b0b",
    muted: "#6b7280",
    grid: "#e5e7eb",
    headBg: "#f9fafb",
    dark: false,
    blocks: CLASSIC_BLOCKS,
    series: LIGHT_SERIES,
    track: "#eef0f2",
    patternInk: "5,150,105",
    patternAlpha: 0.14,
    accent: "#059669",
    onBg: "#4b5563",
  },
  {
    id: "pastel",
    name: "พาสเทล",
    bg: ["#fdf2f8", "#e0e7ff"],
    surface: "#ffffff",
    ink: "#1f1b2e",
    muted: "#7c7391",
    grid: "#ece7f5",
    headBg: "#faf7ff",
    dark: false,
    blocks: PASTEL_BLOCKS,
    series: LIGHT_SERIES,
    track: "#f1edf8",
    patternInk: "139,92,246",
    patternAlpha: 0.13,
    accent: "#8b5cf6",
    onBg: "#6b5b84",
  },
  {
    id: "sakura",
    name: "ซากุระ",
    bg: ["#fff1f2", "#fbcfe8"],
    surface: "#ffffff",
    ink: "#3b0a1e",
    muted: "#9d5c74",
    grid: "#fbe3ea",
    headBg: "#fff7f9",
    dark: false,
    blocks: PASTEL_BLOCKS,
    series: LIGHT_SERIES,
    track: "#fdecf1",
    patternInk: "219,39,119",
    patternAlpha: 0.16,
    accent: "#db2777",
    onBg: "#9d4f6c",
  },
  {
    id: "matcha",
    name: "มัทฉะ",
    bg: ["#ecf7e2", "#c9e7b3"],
    surface: "#fbfdf8",
    ink: "#14290f",
    muted: "#5f7a55",
    grid: "#e3eedb",
    headBg: "#f4f9ef",
    dark: false,
    blocks: VINTAGE_BLOCKS,
    series: LIGHT_SERIES,
    track: "#e9f1e2",
    patternInk: "63,98,18",
    patternAlpha: 0.15,
    accent: "#4d7c0f",
    onBg: "#3f5a2e",
  },
  {
    id: "kraft",
    name: "กระดาษคราฟท์",
    bg: "#eadfca",
    surface: "#fffdf7",
    ink: "#2b2118",
    muted: "#8a7a66",
    grid: "#ece3d3",
    headBg: "#faf5ea",
    dark: false,
    blocks: VINTAGE_BLOCKS,
    series: LIGHT_SERIES,
    track: "#f1eadc",
    patternInk: "120,85,40",
    patternAlpha: 0.16,
    accent: "#b45309",
    onBg: "#6f5b45",
  },
  {
    id: "sunset",
    name: "ซันเซ็ต",
    bg: ["#fb923c", "#db2777"],
    surface: "#fffaf6",
    ink: "#2a1410",
    muted: "#8a6a60",
    grid: "#f4e4dc",
    headBg: "#fff4ec",
    dark: false,
    blocks: CLASSIC_BLOCKS,
    series: LIGHT_SERIES,
    track: "#f6ebe5",
    patternInk: "255,255,255",
    patternAlpha: 0.2,
    accent: "#ea580c",
    onBg: "#fff7ed",
  },
  {
    id: "ocean",
    name: "โอเชียน",
    bg: ["#0ea5e9", "#4f46e5"],
    surface: "#f8fbff",
    ink: "#0b1530",
    muted: "#5b6b8a",
    grid: "#e3eaf5",
    headBg: "#f0f6ff",
    dark: false,
    blocks: CLASSIC_BLOCKS,
    series: LIGHT_SERIES,
    track: "#e8eef7",
    patternInk: "255,255,255",
    patternAlpha: 0.18,
    accent: "#2563eb",
    onBg: "#eff6ff",
  },
  {
    id: "midnight",
    name: "มิดไนท์",
    bg: ["#0b1020", "#1e1b4b"],
    surface: "#111827",
    ink: "#f0efec",
    muted: "#9ca3af",
    grid: "#243045",
    headBg: "#0f172a",
    dark: true,
    blocks: [
      { bg: "#1e3a5f", border: "#60a5fa", text: "#dbeafe" },
      { bg: "#3b1f2b", border: "#f472b6", text: "#fce7f3" },
      { bg: "#14352a", border: "#34d399", text: "#d1fae5" },
      { bg: "#3a2a12", border: "#fbbf24", text: "#fef3c7" },
      { bg: "#2e1f4d", border: "#a78bfa", text: "#ede9fe" },
      { bg: "#3b2213", border: "#fb923c", text: "#ffedd5" },
      { bg: "#123a3d", border: "#2dd4bf", text: "#ccfbf1" },
      { bg: "#3f1d1d", border: "#f87171", text: "#fee2e2" },
      { bg: "#1f2a4d", border: "#818cf8", text: "#e0e7ff" },
      { bg: "#26361a", border: "#a3e635", text: "#ecfccb" },
    ],
    series: DARK_SERIES,
    track: "#1f2937",
    patternInk: "255,255,255",
    patternAlpha: 0.08,
    accent: "#34d399",
    onBg: "#9ca3af",
  },
  {
    id: "minimal",
    name: "มินิมอล",
    bg: "#ffffff",
    surface: "#ffffff",
    ink: "#111827",
    muted: "#6b7280",
    grid: "#eceff3",
    headBg: "#ffffff",
    dark: false,
    blocks: PALETTE.map((p) => ({ bg: "#f8fafc", border: p.border, text: "#111827" })),
    series: LIGHT_SERIES,
    track: "#eef0f2",
    patternInk: "17,24,39",
    patternAlpha: 0.07,
    accent: "#111827",
    onBg: "#6b7280",
  },
];

export const EXPORT_PATTERNS: { id: ExportPatternId; name: string }[] = [
  { id: "none", name: "เรียบ" },
  { id: "dots", name: "จุด" },
  { id: "grid", name: "สมุดกราฟ" },
  { id: "diagonal", name: "เส้นทแยง" },
  { id: "waves", name: "คลื่น" },
  { id: "zigzag", name: "ซิกแซก" },
  { id: "gingham", name: "ลายผ้า" },
  { id: "plus", name: "บวก" },
  { id: "hearts", name: "หัวใจ" },
  { id: "flowers", name: "ดอกไม้" },
  { id: "stars", name: "ประกายดาว" },
  { id: "bubbles", name: "ฟองสบู่" },
  { id: "confetti", name: "คอนเฟตตี" },
];

export const EXPORT_BLOCK_STYLES: { id: ExportBlockStyle; name: string }[] = [
  { id: "soft", name: "ละมุน" },
  { id: "solid", name: "สีสด" },
  { id: "outline", name: "เส้นขอบ" },
  { id: "sticker", name: "สติกเกอร์" },
];

export const EXPORT_LAYOUTS: Record<ExportLayoutId, { w: number; h: number; vertical: boolean; name: string }> = {
  landscape: { w: 1600, h: 1000, vertical: false, name: "แนวนอน 16:10" },
  a4: { w: 1754, h: 1240, vertical: false, name: "A4 แนวนอน" },
  square: { w: 1400, h: 1400, vertical: false, name: "จัตุรัส" },
  story: { w: 1080, h: 1920, vertical: true, name: "สตอรี่ 9:16" },
};

export interface ExportData {
  entries: PlannedEntry[];
  termLabel: string;
  totalCredits: number;
  /** "ge" for GE courses — drives the credit-composition chart */
  isGe: (e: PlannedEntry) => boolean;
  fontFamily: string;
  generatedAt: string;
}

/** Fill unknown / stale stored values (older prefs, removed themes) with defaults. */
export function normalizeExportOptions(o: Partial<ExportOptions>): ExportOptions {
  const out = { ...DEFAULT_EXPORT, ...o };
  if (!EXPORT_THEMES.some((t) => t.id === out.theme)) out.theme = DEFAULT_EXPORT.theme;
  if (!EXPORT_PATTERNS.some((p) => p.id === out.pattern)) out.pattern = DEFAULT_EXPORT.pattern;
  if (!EXPORT_BLOCK_STYLES.some((b) => b.id === out.blockStyle)) out.blockStyle = DEFAULT_EXPORT.blockStyle;
  if (!(out.layout in EXPORT_LAYOUTS)) out.layout = DEFAULT_EXPORT.layout;
  if (![1, 2, 3].includes(out.patternStrength)) out.patternStrength = 2;
  if (![1, 2, 3].includes(out.scale)) out.scale = 2;
  return out;
}

// ------------------------------------------------------------------ drawing helpers

type Ctx = CanvasRenderingContext2D;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else {
    const rad = Math.min(typeof r === "number" ? r : r[0], w / 2, h / 2);
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** mix two hex colours, t = 0 → a, 1 → b */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexRgb(a);
  const [r2, g2, b2] = hexRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
}

function alpha(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** deterministic RNG so the preview and the saved file show the same confetti */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;

function words(text: string): string[] {
  if (segmenter) return [...segmenter.segment(text)].map((s) => s.segment);
  return text.split(/(\s+)/);
}

/** Wrap text into ≤ maxLines lines; last line gets an ellipsis if cut. */
function wrap(ctx: Ctx, text: string, maxW: number, maxLines: number): string[] {
  if (maxLines <= 0 || maxW <= 8) return [];
  const lines: string[] = [];
  let line = "";
  const parts = words(text);
  for (let i = 0; i < parts.length; i++) {
    const next = line + parts[i];
    if (ctx.measureText(next).width <= maxW || !line) {
      // a single over-long word: hard-break by characters
      if (!line && ctx.measureText(next).width > maxW) {
        let chunk = "";
        for (const ch of [...parts[i]]) {
          if (ctx.measureText(chunk + ch).width > maxW && chunk) {
            lines.push(chunk);
            if (lines.length === maxLines) return ellipsize(ctx, lines, maxW);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else line = next;
    } else {
      lines.push(line.trimEnd());
      if (lines.length === maxLines) return ellipsize(ctx, lines, maxW);
      line = parts[i].trimStart();
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.slice(0, maxLines);
}

function ellipsize(ctx: Ctx, lines: string[], maxW: number): string[] {
  let last = lines[lines.length - 1];
  while (last.length > 1 && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
  lines[lines.length - 1] = last + "…";
  return lines;
}

function fit(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  return wrap(ctx, text, maxW, 1)[0] ?? "";
}

function font(ctx: Ctx, family: string, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px ${family}`;
}

function fillBackground(ctx: Ctx, theme: ExportTheme, W: number, H: number) {
  if (Array.isArray(theme.bg)) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, theme.bg[0]);
    g.addColorStop(1, theme.bg[1]);
    ctx.fillStyle = g;
  } else ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ background patterns

const STRENGTH = { 1: 0.55, 2: 1, 3: 1.7 } as const;

function heartPath(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y - s * 0.1, x - s * 0.6, y - s * 0.1, x - s * 0.6, y + s * 0.28);
  ctx.bezierCurveTo(x - s * 0.6, y + s * 0.62, x - s * 0.1, y + s * 0.82, x, y + s);
  ctx.bezierCurveTo(x + s * 0.1, y + s * 0.82, x + s * 0.6, y + s * 0.62, x + s * 0.6, y + s * 0.28);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.1, x, y - s * 0.1, x, y + s * 0.3);
  ctx.closePath();
}

function sparklePath(ctx: Ctx, x: number, y: number, r: number) {
  const k = r * 0.28;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.closePath();
}

/** Draw a decorative pattern over `b` (caller clips if needed). */
export function drawPattern(
  ctx: Ctx,
  id: ExportPatternId,
  b: Box,
  theme: ExportTheme,
  strength: 1 | 2 | 3,
  seed = 11
) {
  if (id === "none") return;
  const a = Math.min(0.9, theme.patternAlpha * STRENGTH[strength]);
  const ink = `rgba(${theme.patternInk},${a})`;
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  const rand = rng(seed);
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (id) {
    case "dots": {
      const s = 26;
      for (let y = b.y, row = 0; y < y1 + s; y += s, row++) {
        for (let x = b.x + (row % 2 ? s / 2 : 0); x < x1 + s; x += s) {
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "grid": {
      const s = 30;
      ctx.lineWidth = 1;
      for (let x = b.x; x < x1; x += s) ctx.fillRect(Math.round(x), b.y, 1, b.h);
      for (let y = b.y; y < y1; y += s) ctx.fillRect(b.x, Math.round(y), b.w, 1);
      ctx.fillStyle = `rgba(${theme.patternInk},${Math.min(0.9, a * 1.6)})`;
      for (let x = b.x; x < x1; x += s * 5) ctx.fillRect(Math.round(x), b.y, 1.5, b.h);
      for (let y = b.y; y < y1; y += s * 5) ctx.fillRect(b.x, Math.round(y), b.w, 1.5);
      break;
    }
    case "diagonal": {
      const s = 24;
      ctx.lineWidth = 5;
      ctx.lineCap = "butt";
      for (let x = b.x - b.h; x < x1; x += s) {
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x + b.h, b.y);
        ctx.stroke();
      }
      break;
    }
    case "waves": {
      const s = 30;
      const amp = 6;
      const len = 52;
      ctx.lineWidth = 2.2;
      for (let y = b.y, row = 0; y < y1 + s; y += s, row++) {
        ctx.beginPath();
        for (let x = b.x - len; x <= x1 + len; x += 4) {
          const yy = y + Math.sin(((x + (row % 2) * (len / 2)) / len) * Math.PI * 2) * amp;
          if (x === b.x - len) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      break;
    }
    case "zigzag": {
      const s = 28;
      const p = 18;
      ctx.lineWidth = 2.6;
      for (let y = b.y; y < y1 + s; y += s) {
        ctx.beginPath();
        let up = false;
        for (let x = b.x - p; x <= x1 + p; x += p) {
          const yy = y + (up ? -7 : 7);
          if (x === b.x - p) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
          up = !up;
        }
        ctx.stroke();
      }
      break;
    }
    case "gingham": {
      const s = 36;
      const w = 16;
      for (let x = b.x; x < x1; x += s) ctx.fillRect(x, b.y, w, b.h);
      for (let y = b.y; y < y1; y += s) ctx.fillRect(b.x, y, b.w, w);
      break;
    }
    case "plus": {
      const s = 36;
      const r = 5.5;
      ctx.lineWidth = 2.6;
      for (let y = b.y + s / 2, row = 0; y < y1 + s; y += s, row++) {
        for (let x = b.x + (row % 2 ? s / 2 : 0); x < x1 + s; x += s) {
          ctx.beginPath();
          ctx.moveTo(x - r, y);
          ctx.lineTo(x + r, y);
          ctx.moveTo(x, y - r);
          ctx.lineTo(x, y + r);
          ctx.stroke();
        }
      }
      break;
    }
    case "hearts": {
      const s = 58;
      for (let y = b.y, row = 0; y < y1 + s; y += s * 0.75, row++) {
        for (let x = b.x + (row % 2 ? s / 2 : 0); x < x1 + s; x += s) {
          heartPath(ctx, x, y - 7, 14);
          ctx.fill();
        }
      }
      break;
    }
    case "flowers": {
      const s = 70;
      for (let y = b.y, row = 0; y < y1 + s; y += s * 0.8, row++) {
        for (let x = b.x + (row % 2 ? s / 2 : 0); x < x1 + s; x += s) {
          const rot = rand() * Math.PI;
          for (let k = 0; k < 5; k++) {
            const t = rot + (k / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.ellipse(x + Math.cos(t) * 7, y + Math.sin(t) * 7, 6, 4, t, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = `rgba(${theme.patternInk},${Math.min(1, a * 2)})`;
          ctx.beginPath();
          ctx.arc(x, y, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      break;
    }
    case "stars": {
      const n = Math.round((b.w * b.h) / 7000);
      for (let i = 0; i < n; i++) {
        const r = 4 + rand() ** 2 * 14;
        sparklePath(ctx, b.x + rand() * b.w, b.y + rand() * b.h, r);
        ctx.fill();
      }
      break;
    }
    case "bubbles": {
      const n = Math.round((b.w * b.h) / 24000);
      ctx.lineWidth = 2;
      for (let i = 0; i < n; i++) {
        const r = 8 + rand() ** 2 * 44;
        const x = b.x + rand() * b.w;
        const y = b.y + rand() * b.h;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (rand() < 0.45) ctx.fill();
        else ctx.stroke();
        // little shine
        ctx.beginPath();
        ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(1.5, r * 0.14), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "confetti": {
      const n = Math.round((b.w * b.h) / 4200);
      const colors = theme.blocks.map((c) => c.border);
      const ca = Math.min(0.9, 0.42 * STRENGTH[strength]);
      for (let i = 0; i < n; i++) {
        const x = b.x + rand() * b.w;
        const y = b.y + rand() * b.h;
        ctx.fillStyle = alpha(colors[Math.floor(rand() * colors.length)], ca);
        const kind = rand();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rand() * Math.PI);
        if (kind < 0.55) {
          rr(ctx, -6, -2.5, 12, 5, 2);
          ctx.fill();
        } else if (kind < 0.85) {
          ctx.beginPath();
          ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -5);
          ctx.lineTo(5, 4);
          ctx.lineTo(-5, 4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      break;
    }
  }
  ctx.restore();
}

/** small swatch for the pattern picker — a crop of the real background at half size */
export function renderPatternSwatch(
  canvas: HTMLCanvasElement,
  themeId: ExportThemeId,
  pattern: ExportPatternId,
  strength: 1 | 2 | 3
) {
  const theme = EXPORT_THEMES.find((t) => t.id === themeId) ?? EXPORT_THEMES[0];
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const w = canvas.clientWidth || 96;
  const h = canvas.clientHeight || 56;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const zoom = 0.55;
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
  const W = w / zoom;
  const H = h / zoom;
  fillBackground(ctx, theme, W, H);
  drawPattern(ctx, pattern, { x: 0, y: 0, w: W, h: H }, theme, strength);
}

// ------------------------------------------------------------------ main renderer

export function renderTimetable(canvas: HTMLCanvasElement, data: ExportData, raw: ExportOptions) {
  const opt = normalizeExportOptions(raw);
  const theme = EXPORT_THEMES.find((t) => t.id === opt.theme) ?? EXPORT_THEMES[0];
  const layout = EXPORT_LAYOUTS[opt.layout];
  const { w: W, h: H } = layout;
  canvas.width = Math.round(W * opt.scale);
  canvas.height = Math.round(H * opt.scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(opt.scale, 0, 0, opt.scale, 0, 0);
  ctx.textBaseline = "alphabetic";
  const F = data.fontFamily;
  const V = layout.vertical;

  // background + pattern (full bleed)
  fillBackground(ctx, theme, W, H);
  drawPattern(ctx, opt.pattern, { x: 0, y: 0, w: W, h: H }, theme, opt.patternStrength);

  const M = V ? 44 : 40;
  const GAP = 18;
  const footerH = 30;
  const content = { x: M, y: M, w: W - M * 2, h: H - M * 2 - footerH + 12 };

  // stats
  const entries = data.entries;
  const all = entries.flatMap((e) => e.slots);
  const courseCount = entries.filter((e) => e.item.kind === "course").length;
  // same rounding as the hours-per-day chart so the two numbers always agree
  const weekHours = +(all.reduce((n, s) => n + (s.end - s.start), 0) / 60).toFixed(1);

  // ---- header card
  const headerH = V ? 178 : 112;
  const header = { x: content.x, y: content.y, w: content.w, h: headerH };
  card(ctx, theme, header, 24);
  drawHeader(ctx, F, theme, opt, data, header, V, { courseCount, weekHours });

  // ---- summary card (bottom)
  const summaryInner = opt.showSummary ? (V ? 470 : opt.layout === "landscape" ? 206 : 316) : 0;
  const summaryH = summaryInner ? summaryInner + 48 : 0;

  // ---- grid card
  const grid = {
    x: content.x,
    y: header.y + header.h + GAP,
    w: content.w,
    h: content.h - header.h - GAP - (summaryH ? summaryH + GAP : 0),
  };

  const startMin = Math.min(8 * 60, ...all.map((s) => Math.floor(s.start / 60) * 60));
  const endMin = Math.max(17 * 60, ...all.map((s) => Math.ceil(s.end / 60) * 60));
  const hours: number[] = [];
  for (let m = startMin; m < endMin; m += 60) hours.push(m);
  const usesWeekend = all.some((s) => s.day >= 5);
  const showWeekend = opt.weekend === "show" || (opt.weekend === "auto" && usesWeekend);
  const days = showWeekend ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];

  card(ctx, theme, grid, 22);
  rr(ctx, grid.x, grid.y, grid.w, grid.h, 22);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = theme.headBg;
  ctx.fillRect(grid.x, grid.y, grid.w, grid.h);
  if (!V) drawHorizontal(ctx, F, theme, opt, entries, days, hours, startMin, grid);
  else drawVertical(ctx, F, theme, opt, entries, days, hours, startMin, grid);
  ctx.restore();
  rr(ctx, grid.x, grid.y, grid.w, grid.h, 22);
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (!all.length) {
    font(ctx, F, 22, 600);
    ctx.fillStyle = theme.muted;
    ctx.textAlign = "center";
    ctx.fillText("ยังไม่มีวิชาที่มีเวลาเรียนในตาราง", grid.x + grid.w / 2, grid.y + grid.h / 2);
    ctx.textAlign = "left";
  }

  if (summaryH) {
    const box = { x: content.x, y: grid.y + grid.h + GAP, w: content.w, h: summaryH };
    card(ctx, theme, box, 22);
    drawSummary(ctx, F, theme, opt, data, { x: box.x + 26, y: box.y + 24, w: box.w - 52, h: summaryInner, vertical: V });
  }

  // footer (on the background)
  const fy = H - M + 6;
  font(ctx, F, 13, 600);
  ctx.fillStyle = theme.onBg;
  ctx.fillText(fit(ctx, `PSU Timetable · Allquiz · ข้อมูลจาก SIS ม.อ. · ${data.generatedAt}`, W / 2 - M), M + 4, fy);
  ctx.textAlign = "right";
  font(ctx, F, 13, 500);
  ctx.fillText(fit(ctx, "ตรวจสอบกับระบบลงทะเบียนจริงก่อนลงทะเบียน", W / 2 - M), W - M - 4, fy);
  ctx.textAlign = "left";
}

function card(ctx: Ctx, theme: ExportTheme, b: Box, r: number) {
  ctx.save();
  ctx.shadowColor = theme.dark ? "rgba(0,0,0,0.5)" : "rgba(15,23,42,0.13)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 10;
  rr(ctx, b.x, b.y, b.w, b.h, r);
  ctx.fillStyle = theme.surface;
  ctx.fill();
  ctx.restore();
}

function drawCalendarIcon(ctx: Ctx, x: number, y: number, s: number, accent: string) {
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, accent);
  g.addColorStop(1, mix(accent, "#000000", 0.28));
  rr(ctx, x, y, s, s, s * 0.28);
  ctx.fillStyle = g;
  ctx.fill();
  // glyph
  const p = s * 0.24;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = s * 0.065;
  ctx.lineCap = "round";
  rr(ctx, x + p, y + p * 1.15, s - p * 2, s - p * 2.15, s * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + p, y + p * 1.15 + s * 0.17);
  ctx.lineTo(x + s - p, y + p * 1.15 + s * 0.17);
  ctx.moveTo(x + s * 0.38, y + p * 0.75);
  ctx.lineTo(x + s * 0.38, y + p * 1.45);
  ctx.moveTo(x + s * 0.62, y + p * 0.75);
  ctx.lineTo(x + s * 0.62, y + p * 1.45);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + s * (0.38 + i * 0.12), y + s * 0.64, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pill(ctx: Ctx, F: string, text: string, x: number, y: number, h: number, bg: string, fg: string, dot?: string) {
  font(ctx, F, h * 0.46, 700);
  const tw = ctx.measureText(text).width;
  const w = tw + h * 0.9 + (dot ? h * 0.45 : 0);
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  let tx = x + h * 0.45;
  if (dot) {
    ctx.beginPath();
    ctx.arc(tx + h * 0.12, y + h / 2, h * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = dot;
    ctx.fill();
    tx += h * 0.42;
  }
  ctx.fillStyle = fg;
  ctx.fillText(text, tx, y + h * 0.66);
  return w;
}

function measurePill(ctx: Ctx, F: string, text: string, h: number, dot: boolean) {
  font(ctx, F, h * 0.46, 700);
  return ctx.measureText(text).width + h * 0.9 + (dot ? h * 0.45 : 0);
}

function drawHeader(
  ctx: Ctx,
  F: string,
  theme: ExportTheme,
  opt: ExportOptions,
  data: ExportData,
  b: Box,
  vertical: boolean,
  stats: { courseCount: number; weekHours: number }
) {
  const pad = 28;
  const icon = vertical ? 64 : 58;
  drawCalendarIcon(ctx, b.x + pad, b.y + (vertical ? pad : (b.h - icon) / 2), icon, theme.accent);
  const tx = b.x + pad + icon + 20;

  const pills = [
    { text: `${stats.courseCount} วิชา`, dot: theme.series[0] },
    { text: `${data.totalCredits} หน่วยกิต`, dot: theme.series[1] },
    { text: `${stats.weekHours} ชม./สัปดาห์`, dot: theme.series[2] },
  ];
  const pillH = vertical ? 40 : 36;
  const pillBg = theme.dark ? "rgba(255,255,255,0.07)" : alpha(theme.accent, 0.08);
  const pillsW = pills.reduce((n, p) => n + measurePill(ctx, F, p.text, pillH, true) + 10, -10);

  const titleMax = vertical ? b.w - (tx - b.x) - pad : b.w - (tx - b.x) - pad - pillsW - 28;
  font(ctx, F, vertical ? 42 : 36, 800);
  ctx.fillStyle = theme.ink;
  const titleY = vertical ? b.y + pad + 40 : b.y + b.h / 2 - 4;
  ctx.fillText(fit(ctx, opt.title || "ตารางเรียน", titleMax), tx, titleY);
  font(ctx, F, vertical ? 20 : 17, 600);
  ctx.fillStyle = theme.muted;
  ctx.fillText(fit(ctx, `ภาคการศึกษา ${data.termLabel}`, titleMax), tx, titleY + (vertical ? 32 : 28));

  if (vertical) {
    let px = b.x + pad;
    const py = b.y + b.h - pad - pillH;
    for (const p of pills) px += pill(ctx, F, p.text, px, py, pillH, pillBg, theme.ink, p.dot) + 10;
  } else {
    let px = b.x + b.w - pad - pillsW;
    const py = b.y + (b.h - pillH) / 2;
    for (const p of pills) px += pill(ctx, F, p.text, px, py, pillH, pillBg, theme.ink, p.dot) + 10;
  }
}

// ------------------------------------------------------------------ blocks

function blockTextColors(style: ExportBlockStyle, c: BlockColor) {
  if (style === "solid") return { main: "#ffffff", sub: "rgba(255,255,255,0.86)", chip: "rgba(255,255,255,0.22)" };
  return { main: c.text, sub: c.text, chip: style === "outline" ? alpha(c.border, 0.14) : "rgba(255,255,255,0.7)" };
}

function drawBlock(ctx: Ctx, theme: ExportTheme, style: ExportBlockStyle, c: BlockColor, b: Box) {
  const r = Math.min(12, b.h / 3, b.w / 3);
  ctx.save();
  if (style === "sticker") {
    rr(ctx, b.x + 4, b.y + 4, b.w, b.h, r);
    ctx.fillStyle = theme.ink;
    ctx.fill();
    rr(ctx, b.x, b.y, b.w, b.h, r);
    ctx.fillStyle = c.bg;
    ctx.fill();
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else if (style === "solid") {
    ctx.shadowColor = alpha(c.border, 0.4);
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    rr(ctx, b.x, b.y, b.w, b.h, r);
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, c.border);
    g.addColorStop(1, mix(c.border, "#000000", 0.28));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = "transparent";
    // glossy top
    const gl = ctx.createLinearGradient(0, b.y, 0, b.y + b.h * 0.6);
    gl.addColorStop(0, "rgba(255,255,255,0.2)");
    gl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gl;
    ctx.fill();
  } else if (style === "outline") {
    rr(ctx, b.x, b.y, b.w, b.h, r);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    ctx.shadowColor = alpha(c.border, theme.dark ? 0.35 : 0.22);
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    rr(ctx, b.x, b.y, b.w, b.h, r);
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, c.bg);
    g.addColorStop(1, theme.dark ? mix(c.bg, "#000000", 0.2) : mix(c.bg, "#ffffff", 0.5));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = "transparent";
    if (theme.id === "minimal") {
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // corner bubble + accent bar, clipped to the block
  rr(ctx, b.x, b.y, b.w, b.h, r);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(b.x + b.w, b.y, Math.min(b.w, b.h) * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = style === "solid" ? "rgba(255,255,255,0.13)" : alpha(c.border, 0.12);
  ctx.fill();
  if (style === "soft" || style === "sticker") {
    rr(ctx, b.x + 5, b.y + 6, 4, Math.max(4, b.h - 12), 2);
    ctx.fillStyle = c.border;
    ctx.fill();
  }
  ctx.restore();
}

function blockText(
  ctx: Ctx,
  F: string,
  e: PlannedEntry,
  s: PlannedEntry["slots"][number],
  c: BlockColor,
  box: Box,
  opt: ExportOptions
) {
  const col = blockTextColors(opt.blockStyle, c);
  const pad = Math.max(5, Math.min(12, box.w / 14, box.h / 10));
  const tx = box.x + pad + (opt.blockStyle === "soft" || opt.blockStyle === "sticker" ? 6 : 2);
  const tw = box.x + box.w - pad - tx;
  if (tw < 14 || box.h < 18) return;
  const base = Math.max(10.5, Math.min(17, box.w / 9, box.h / 5.4));
  let y = box.y + pad + base;

  // duration chip — only when the course code still fits beside it
  font(ctx, F, base, 800);
  const codeFull = ctx.measureText(e.code).width;
  font(ctx, F, Math.max(9.5, base * 0.66), 700);
  const dur = fmtDuration(s.start, s.end);
  const dw = ctx.measureText(dur).width + 12;
  let codeW = tw;
  if (opt.showTime && box.h >= 54 && codeFull + dw + 8 <= tw) {
    const ch = Math.max(14, base * 1.05);
    rr(ctx, tx + tw - dw, y - base * 0.86, dw, ch, ch / 2);
    ctx.fillStyle = col.chip;
    ctx.fill();
    ctx.fillStyle = col.main;
    ctx.fillText(dur, tx + tw - dw + 6, y - base * 0.86 + ch * 0.72);
    codeW = tw - dw - 6;
  }

  ctx.fillStyle = col.main;
  font(ctx, F, base, 800);
  ctx.fillText(fit(ctx, e.code, codeW), tx, y);

  const meta: string[] = [];
  if (opt.showTime) meta.push(fmtRange(s.start, s.end));
  if (opt.showSec && e.sec !== "-") meta.push(`Sec ${e.sec}`);
  if (opt.showRoom && s.room && s.room !== "-") meta.push(s.room);
  const metaSize = Math.max(9.5, base * 0.74);
  const instructor = opt.showInstructor && e.instructors.length ? e.instructors.join(", ") : "";
  const footerLines = (meta.length ? 1 : 0) + (instructor ? 1 : 0);
  const nameSize = Math.max(10, base * 0.84);
  const lineH = nameSize * 1.25;
  const room = box.y + box.h - pad - footerLines * metaSize * 1.3 - (y + 4);
  const nameLines = Math.max(0, Math.floor(room / lineH));
  font(ctx, F, nameSize, 500);
  ctx.fillStyle = col.sub;
  ctx.globalAlpha = 0.95;
  for (const line of wrap(ctx, e.name, tw, Math.min(3, nameLines))) {
    y += lineH;
    ctx.fillText(line, tx, y);
  }
  if (!footerLines) {
    ctx.globalAlpha = 1;
    return;
  }
  ctx.globalAlpha = 0.88;
  font(ctx, F, metaSize, 600);
  let fy = box.y + box.h - pad - (footerLines - 1) * metaSize * 1.3;
  if (fy - metaSize > y - 2) {
    if (meta.length) {
      ctx.fillText(fit(ctx, meta.join(" · "), tw), tx, fy);
      fy += metaSize * 1.3;
    }
    if (instructor) {
      font(ctx, F, metaSize, 500);
      ctx.fillText(fit(ctx, instructor, tw), tx, fy);
    }
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ grids

function zebra(theme: ExportTheme) {
  return theme.dark ? "rgba(255,255,255,0.025)" : "rgba(15,23,42,0.022)";
}

function halfHourLine(ctx: Ctx, theme: ExportTheme, x1: number, y1: number, x2: number, y2: number) {
  ctx.save();
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawHorizontal(
  ctx: Ctx,
  F: string,
  theme: ExportTheme,
  opt: ExportOptions,
  entries: PlannedEntry[],
  days: number[],
  hours: number[],
  startMin: number,
  g: Box
) {
  const dayW = 122;
  const headH = 42;
  const hourW = (g.w - dayW) / hours.length;
  const rowH = (g.h - headH) / days.length;

  // body background
  ctx.fillStyle = theme.surface;
  ctx.fillRect(g.x + dayW, g.y + headH, g.w - dayW, g.h - headH);
  days.forEach((_, r) => {
    if (r % 2 === 1) {
      ctx.fillStyle = zebra(theme);
      ctx.fillRect(g.x, g.y + headH + r * rowH, g.w, rowH);
    }
  });

  font(ctx, F, 14, 700);
  hours.forEach((h, i) => {
    const x = g.x + dayW + i * hourW;
    ctx.fillStyle = theme.muted;
    ctx.fillText(`${String(h / 60).padStart(2, "0")}:00`, x + 8, g.y + 27);
    ctx.fillStyle = theme.grid;
    ctx.fillRect(x, g.y, 1, g.h);
    halfHourLine(ctx, theme, x + hourW / 2, g.y + headH, x + hourW / 2, g.y + g.h);
  });
  ctx.fillStyle = theme.grid;
  ctx.fillRect(g.x, g.y + headH, g.w, 1);

  days.forEach((day, r) => {
    const y = g.y + headH + r * rowH;
    if (r > 0) {
      ctx.fillStyle = theme.grid;
      ctx.fillRect(g.x, y, g.w, 1);
    }
    if (opt.dayColors) {
      ctx.fillStyle = alpha(DAY_COLORS[day], theme.dark ? 0.16 : 0.1);
      ctx.fillRect(g.x, y + 1, dayW, rowH - 1);
      rr(ctx, g.x + 12, y + rowH * 0.22, 5, rowH * 0.56, 3);
      ctx.fillStyle = DAY_COLORS[day];
      ctx.fill();
    }
    const lx = g.x + (opt.dayColors ? 28 : 18);
    font(ctx, F, 20, 800);
    ctx.fillStyle = theme.ink;
    ctx.fillText(fit(ctx, DAY_NAMES[day], dayW - (lx - g.x) - 6), lx, y + rowH / 2 + 2);
    font(ctx, F, 12, 700);
    ctx.fillStyle = theme.muted;
    ctx.fillText(DAY_EN[day], lx, y + rowH / 2 + 20);

    const blocks = entries.flatMap((e) => e.slots.filter((s) => s.day === day).map((s) => ({ e, s })));
    const lanes = layoutLanes(blocks.map((b) => b.s));
    blocks.forEach(({ e, s }, i) => {
      const { lane, lanes: n } = lanes[i];
      const laneH = (rowH - 14) / n;
      const box = {
        x: g.x + dayW + ((s.start - startMin) / 60) * hourW + 4,
        y: y + 7 + lane * laneH + (lane ? 2 : 0),
        w: ((s.end - s.start) / 60) * hourW - 8,
        h: laneH - (n > 1 ? 4 : 0),
      };
      const c = theme.blocks[e.color % theme.blocks.length];
      drawBlock(ctx, theme, opt.blockStyle, c, box);
      blockText(ctx, F, e, s, c, box, opt);
    });
  });
}

function drawVertical(
  ctx: Ctx,
  F: string,
  theme: ExportTheme,
  opt: ExportOptions,
  entries: PlannedEntry[],
  days: number[],
  hours: number[],
  startMin: number,
  g: Box
) {
  const timeW = 66;
  const headH = 64;
  const colW = (g.w - timeW) / days.length;
  const hourH = (g.h - headH) / hours.length;

  ctx.fillStyle = theme.surface;
  ctx.fillRect(g.x + timeW, g.y + headH, g.w - timeW, g.h - headH);
  days.forEach((_, i) => {
    if (i % 2 === 1) {
      ctx.fillStyle = zebra(theme);
      ctx.fillRect(g.x + timeW + i * colW, g.y + headH, colW, g.h - headH);
    }
  });

  font(ctx, F, 14, 700);
  hours.forEach((h, i) => {
    const y = g.y + headH + i * hourH;
    ctx.fillStyle = theme.grid;
    ctx.fillRect(g.x, y, g.w, 1);
    halfHourLine(ctx, theme, g.x + timeW, y + hourH / 2, g.x + g.w, y + hourH / 2);
    ctx.fillStyle = theme.muted;
    ctx.fillText(`${String(h / 60).padStart(2, "0")}:00`, g.x + 10, y + 20);
  });

  days.forEach((day, i) => {
    const x = g.x + timeW + i * colW;
    ctx.fillStyle = theme.grid;
    ctx.fillRect(x, g.y, 1, g.h);
    if (opt.dayColors) {
      ctx.fillStyle = alpha(DAY_COLORS[day], theme.dark ? 0.18 : 0.12);
      ctx.fillRect(x + 1, g.y, colW - 1, headH);
      rr(ctx, x + colW * 0.25, g.y + headH - 7, colW * 0.5, 4, 2);
      ctx.fillStyle = DAY_COLORS[day];
      ctx.fill();
    }
    ctx.textAlign = "center";
    font(ctx, F, 19, 800);
    ctx.fillStyle = theme.ink;
    ctx.fillText(DAY_NAMES[day].replace("พฤหัสบดี", "พฤหัส"), x + colW / 2, g.y + 29);
    font(ctx, F, 11, 700);
    ctx.fillStyle = theme.muted;
    ctx.fillText(DAY_EN[day], x + colW / 2, g.y + 47);
    ctx.textAlign = "left";

    const blocks = entries.flatMap((e) => e.slots.filter((s) => s.day === day).map((s) => ({ e, s })));
    const lanes = layoutLanes(blocks.map((b) => b.s));
    blocks.forEach(({ e, s }, j) => {
      const { lane, lanes: n } = lanes[j];
      const laneW = (colW - 10) / n;
      const box = {
        x: x + 5 + lane * laneW,
        y: g.y + headH + ((s.start - startMin) / 60) * hourH + 3,
        w: laneW - (n > 1 ? 3 : 0),
        h: ((s.end - s.start) / 60) * hourH - 6,
      };
      const c = theme.blocks[e.color % theme.blocks.length];
      drawBlock(ctx, theme, opt.blockStyle, c, box);
      blockText(ctx, F, e, s, c, box, opt);
    });
  });
  ctx.fillStyle = theme.grid;
  ctx.fillRect(g.x, g.y + headH, g.w, 1);
}

// ------------------------------------------------------------------ summary + charts

function drawSummary(
  ctx: Ctx,
  F: string,
  theme: ExportTheme,
  opt: ExportOptions,
  data: ExportData,
  box: Box & { vertical: boolean }
) {
  const listW = box.vertical ? box.w : box.w * 0.56;
  const chartsX = box.vertical ? box.x : box.x + listW + 32;
  const chartsW = box.vertical ? box.w : box.w - listW - 32;
  const listH = box.vertical ? box.h - 210 : box.h;

  // divider between list and charts
  if (!box.vertical) {
    ctx.fillStyle = theme.grid;
    ctx.fillRect(box.x + listW + 16, box.y, 1, box.h);
  }

  // course list
  font(ctx, F, 17, 800);
  ctx.fillStyle = theme.ink;
  ctx.fillText("รายวิชา", box.x, box.y + 18);
  const rows = data.entries;
  const rowH = opt.showExams ? 46 : 32;
  const cols = box.vertical ? 1 : rows.length * rowH > listH - 30 ? 2 : 1;
  const colW = (listW - (cols - 1) * 20) / cols;
  const perCol = Math.max(1, Math.floor((listH - 34) / rowH));
  rows.slice(0, perCol * cols).forEach((e, i) => {
    const col = Math.floor(i / perCol);
    const x = box.x + col * (colW + 20);
    const y = box.y + 34 + (i % perCol) * rowH;
    const c = theme.blocks[e.color % theme.blocks.length];
    rr(ctx, x, y + 3, 12, 12, 4);
    ctx.fillStyle = c.border;
    ctx.fill();
    font(ctx, F, 14.5, 800);
    ctx.fillStyle = theme.ink;
    const code = e.code;
    ctx.fillText(code, x + 20, y + 15);
    const cw = ctx.measureText(code).width;
    font(ctx, F, 14.5, 500);
    const right = `${e.sec !== "-" ? `Sec ${e.sec} · ` : ""}${e.credits || 0} นก.`;
    const rw = ctx.measureText(right).width;
    ctx.fillText(fit(ctx, e.name, colW - 20 - cw - 10 - rw - 12), x + 20 + cw + 10, y + 15);
    ctx.fillStyle = theme.muted;
    ctx.fillText(right, x + colW - rw, y + 15);
    if (opt.showExams) {
      font(ctx, F, 12.5, 500);
      const ex = [
        e.midterm ? `กลางภาค ${fmtExamDate(e.midterm.date)} ${fmtRange(e.midterm.start, e.midterm.end)}` : "",
        e.final ? `ปลายภาค ${fmtExamDate(e.final.date)} ${fmtRange(e.final.start, e.final.end)}` : "",
      ]
        .filter(Boolean)
        .join("  ·  ");
      ctx.fillText(fit(ctx, ex || "ยังไม่มีกำหนดสอบ", colW - 20), x + 20, y + 34);
    }
  });
  if (rows.length > perCol * cols) {
    font(ctx, F, 13, 600);
    ctx.fillStyle = theme.muted;
    ctx.fillText(`+ อีก ${rows.length - perCol * cols} วิชา`, box.x + 20, box.y + 34 + perCol * rowH + 4);
  }

  // charts
  const cy = box.vertical ? box.y + listH + 10 : box.y;
  const ch = box.vertical ? 200 : box.h;
  const halfW = box.vertical ? (chartsW - 28) / 2 : chartsW;
  drawComposition(ctx, F, theme, data, { x: chartsX, y: cy, w: halfW, h: box.vertical ? ch : ch * 0.42 });
  drawHoursPerDay(ctx, F, theme, opt, data, {
    x: box.vertical ? chartsX + halfW + 28 : chartsX,
    y: box.vertical ? cy : cy + ch * 0.46,
    w: halfW,
    h: box.vertical ? ch : ch * 0.54,
  });
}

/** Credit composition — one 100% stacked bar, legend with values (identity never colour-only). */
function drawComposition(ctx: Ctx, F: string, theme: ExportTheme, data: ExportData, b: Box) {
  let ge = 0;
  let custom = 0;
  let other = 0;
  for (const e of data.entries) {
    if (e.item.kind === "custom") custom += e.credits;
    else if (data.isGe(e)) ge += e.credits;
    else other += e.credits;
  }
  const total = ge + other + custom;
  const parts = [
    { label: "ศึกษาทั่วไป (GE)", v: ge, color: theme.series[0] },
    { label: "วิชาเฉพาะ / อื่น ๆ", v: other, color: theme.series[1] },
    { label: "เพิ่มเอง", v: custom, color: theme.series[2] },
  ].filter((p) => p.v > 0);

  font(ctx, F, 17, 800);
  ctx.fillStyle = theme.ink;
  ctx.fillText("สัดส่วนหน่วยกิต", b.x, b.y + 18);
  const barY = b.y + 32;
  const barH = 16;
  rr(ctx, b.x, barY, b.w, barH, 8);
  ctx.fillStyle = theme.track;
  ctx.fill();
  if (total > 0) {
    let x = b.x;
    parts.forEach((p, i) => {
      const w = (p.v / total) * b.w - (i < parts.length - 1 ? 2 : 0);
      rr(ctx, x, barY, Math.max(2, w), barH, 8);
      ctx.fillStyle = p.color;
      ctx.fill();
      x += w + 2;
    });
  }
  // legend
  let lx = b.x;
  const ly = barY + barH + 24;
  font(ctx, F, 13.5, 600);
  for (const p of parts.length ? parts : [{ label: "ยังไม่มีหน่วยกิต", v: 0, color: theme.track }]) {
    const text = `${p.label} ${p.v} นก.`;
    const tw = ctx.measureText(text).width;
    if (lx + tw + 24 > b.x + b.w) break;
    rr(ctx, lx, ly - 10, 10, 10, 3);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.fillStyle = theme.ink;
    ctx.fillText(text, lx + 16, ly);
    lx += tw + 34;
  }
}

/** Class hours per day — single series, value labels (static image has no hover). */
function drawHoursPerDay(ctx: Ctx, F: string, theme: ExportTheme, opt: ExportOptions, data: ExportData, b: Box) {
  const hrs = [0, 0, 0, 0, 0, 0, 0];
  for (const e of data.entries) for (const s of e.slots) hrs[s.day] += (s.end - s.start) / 60;
  const days = hrs[5] || hrs[6] ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const max = Math.max(1, ...days.map((d) => hrs[d]));
  const total = hrs.reduce((a, v) => a + v, 0);

  font(ctx, F, 17, 800);
  ctx.fillStyle = theme.ink;
  ctx.fillText("ชั่วโมงเรียนต่อวัน", b.x, b.y + 18);
  font(ctx, F, 13, 600);
  ctx.fillStyle = theme.muted;
  ctx.textAlign = "right";
  ctx.fillText(`รวม ${+total.toFixed(1)} ชม./สัปดาห์`, b.x + b.w, b.y + 18);
  ctx.textAlign = "left";

  const top = b.y + 40;
  const labelH = 20;
  const plotH = Math.max(30, b.h - 40 - labelH - 18);
  const slot = b.w / days.length;
  const barW = Math.min(44, slot * 0.5);
  const base = top + plotH + 16;
  ctx.fillStyle = theme.grid;
  ctx.fillRect(b.x, base, b.w, 1);
  days.forEach((d, i) => {
    const v = hrs[d];
    const h = (v / max) * plotH;
    const x = b.x + i * slot + (slot - barW) / 2;
    if (v > 0) {
      rr(ctx, x, base - h, barW, h, [6, 6, 0, 0]);
      ctx.fillStyle = opt.dayColors ? DAY_COLORS[d] : theme.series[0];
      ctx.fill();
      font(ctx, F, 12.5, 700);
      ctx.fillStyle = theme.ink;
      ctx.textAlign = "center";
      ctx.fillText(`${+v.toFixed(1)}`, x + barW / 2, base - h - 6);
    }
    font(ctx, F, 13, 600);
    ctx.fillStyle = theme.muted;
    ctx.textAlign = "center";
    ctx.fillText(DAY_SHORT[d], x + barW / 2, base + labelH);
    ctx.textAlign = "left";
  });
}

// ------------------------------------------------------------------ output

export function canvasToBlob(canvas: HTMLCanvasElement, format: "png" | "jpeg"): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("สร้างไฟล์รูปไม่สำเร็จ"))),
      format === "jpeg" ? "image/jpeg" : "image/png",
      0.95
    )
  );
}

/** Print the rendered image through a hidden iframe → browser "Save as PDF". */
export function printCanvasAsPdf(canvas: HTMLCanvasElement, landscape: boolean, title: string) {
  const url = canvas.toDataURL("image/png");
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title><style>@page{size:A4 ${
      landscape ? "landscape" : "portrait"
    };margin:8mm}html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body><img src="${url}"></body></html>`
  );
  doc.close();
  const img = doc.querySelector("img");
  const go = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 60_000);
  };
  if (img && !img.complete) img.onload = go;
  else setTimeout(go, 50);
}

/** Resolve the page's font stack (next/font hashed family names) and wait for Thai glyphs. */
export async function exportFontFamily(): Promise<string> {
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  try {
    await Promise.all([
      document.fonts.load(`400 16px ${family}`, "ตารางเรียน"),
      document.fonts.load(`700 16px ${family}`, "ตารางเรียน"),
      document.fonts.load(`800 16px ${family}`, "ตารางเรียน ABC"),
    ]);
    await document.fonts.ready;
  } catch {
    /* fall back to whatever is available */
  }
  return family;
}
