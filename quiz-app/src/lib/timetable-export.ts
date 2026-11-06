// Draws a timetable onto a <canvas> for image / PDF export.
//
// Rendered directly with the Canvas 2D API (no html2canvas): the output is
// identical on every device, works offline and stays crisp at 2–3× scale.
// Thai line-breaking uses Intl.Segmenter so names wrap at word boundaries.

import {
  DAY_EN,
  DAY_NAMES,
  DAY_SHORT,
  PALETTE,
  fmtExamDate,
  fmtRange,
  layoutLanes,
  type PlannedEntry,
} from "./timetable";

export type ExportThemeId = "classic" | "pastel" | "midnight" | "minimal" | "sunset" | "ocean";
export type ExportLayoutId = "landscape" | "a4" | "story" | "square";
export type ExportFormat = "png" | "jpeg" | "pdf";

export interface ExportOptions {
  theme: ExportThemeId;
  layout: ExportLayoutId;
  format: ExportFormat;
  scale: 1 | 2 | 3;
  title: string;
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
}

const LIGHT_SERIES: [string, string, string] = ["#2a78d6", "#eb6834", "#1baf7a"];
const DARK_SERIES: [string, string, string] = ["#3987e5", "#d95926", "#199e70"];
const CLASSIC_BLOCKS: BlockColor[] = PALETTE.map((p) => ({ ...p }));

export const EXPORT_THEMES: ExportTheme[] = [
  {
    id: "classic",
    name: "คลาสสิก",
    bg: "#f3f6f4",
    surface: "#ffffff",
    ink: "#0b0b0b",
    muted: "#6b7280",
    grid: "#e5e7eb",
    headBg: "#f9fafb",
    dark: false,
    blocks: CLASSIC_BLOCKS,
    series: LIGHT_SERIES,
    track: "#eef0f2",
  },
  {
    id: "pastel",
    name: "พาสเทล",
    bg: ["#fdf2f8", "#e0e7ff"],
    surface: "#ffffffee",
    ink: "#1f1b2e",
    muted: "#7c7391",
    grid: "#ece7f5",
    headBg: "#faf7ff",
    dark: false,
    blocks: [
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
    ],
    series: LIGHT_SERIES,
    track: "#f1edf8",
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
  },
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

// ------------------------------------------------------------------ drawing helpers

type Ctx = CanvasRenderingContext2D;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else {
    const rad = typeof r === "number" ? r : r[0];
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
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

// ------------------------------------------------------------------ main renderer

export function renderTimetable(canvas: HTMLCanvasElement, data: ExportData, opt: ExportOptions) {
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

  // background
  if (Array.isArray(theme.bg)) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, theme.bg[0]);
    g.addColorStop(1, theme.bg[1]);
    ctx.fillStyle = g;
  } else ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  const M = layout.vertical ? 44 : 40;
  const card = { x: M, y: M, w: W - M * 2, h: H - M * 2 };
  ctx.save();
  ctx.shadowColor = theme.dark ? "rgba(0,0,0,0.45)" : "rgba(15,23,42,0.12)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  rr(ctx, card.x, card.y, card.w, card.h, 28);
  ctx.fillStyle = theme.surface;
  ctx.fill();
  ctx.restore();

  const P = layout.vertical ? 36 : 36;
  const inner = { x: card.x + P, y: card.y + P, w: card.w - P * 2, h: card.h - P * 2 };

  // header
  const courseCount = data.entries.filter((e) => e.item.kind === "course").length;
  font(ctx, F, layout.vertical ? 46 : 40, 800);
  ctx.fillStyle = theme.ink;
  ctx.fillText(fit(ctx, opt.title || "ตารางเรียน", inner.w * 0.72), inner.x, inner.y + 40);
  font(ctx, F, layout.vertical ? 22 : 19, 500);
  ctx.fillStyle = theme.muted;
  ctx.fillText(
    `ภาคการศึกษา ${data.termLabel} · ${courseCount} วิชา · ${data.totalCredits} หน่วยกิต`,
    inner.x,
    inner.y + (layout.vertical ? 80 : 72)
  );
  // brand pill (top-right)
  font(ctx, F, 15, 700);
  const brand = "PSU Timetable";
  const bw = ctx.measureText(brand).width + 28;
  rr(ctx, inner.x + inner.w - bw, inner.y + 12, bw, 32, 16);
  ctx.fillStyle = theme.dark ? "#1f2937" : "#ecfdf5";
  ctx.fill();
  ctx.fillStyle = theme.dark ? "#6ee7b7" : "#047857";
  ctx.fillText(brand, inner.x + inner.w - bw + 14, inner.y + 33);

  const headerH = layout.vertical ? 112 : 100;
  const footerH = 26;
  const summaryH = opt.showSummary ? (layout.vertical ? 470 : opt.layout === "landscape" ? 230 : 330) : 0;
  const grid = {
    x: inner.x,
    y: inner.y + headerH,
    w: inner.w,
    h: inner.h - headerH - footerH - (summaryH ? summaryH + 24 : 0),
  };

  const entries = data.entries;
  const all = entries.flatMap((e) => e.slots);
  const startMin = Math.min(8 * 60, ...all.map((s) => Math.floor(s.start / 60) * 60));
  const endMin = Math.max(17 * 60, ...all.map((s) => Math.ceil(s.end / 60) * 60));
  const hours: number[] = [];
  for (let m = startMin; m < endMin; m += 60) hours.push(m);
  const usesWeekend = all.some((s) => s.day >= 5);
  const showWeekend = opt.weekend === "show" || (opt.weekend === "auto" && usesWeekend);
  const days = showWeekend ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];

  // grid frame
  rr(ctx, grid.x, grid.y, grid.w, grid.h, 18);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = theme.headBg;
  ctx.fillRect(grid.x, grid.y, grid.w, grid.h);

  if (!layout.vertical) {
    drawHorizontal(ctx, F, theme, opt, entries, days, hours, startMin, grid);
  } else {
    drawVertical(ctx, F, theme, opt, entries, days, hours, startMin, grid);
  }
  ctx.restore();
  rr(ctx, grid.x, grid.y, grid.w, grid.h, 18);
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (!entries.some((e) => e.slots.length)) {
    font(ctx, F, 22, 500);
    ctx.fillStyle = theme.muted;
    ctx.textAlign = "center";
    ctx.fillText("ยังไม่มีวิชาที่มีเวลาเรียนในตาราง", grid.x + grid.w / 2, grid.y + grid.h / 2);
    ctx.textAlign = "left";
  }

  if (summaryH) {
    drawSummary(ctx, F, theme, opt, data, {
      x: inner.x,
      y: grid.y + grid.h + 24,
      w: inner.w,
      h: summaryH,
      vertical: layout.vertical,
    });
  }

  // footer
  font(ctx, F, 13, 500);
  ctx.fillStyle = theme.muted;
  ctx.fillText(`สร้างด้วย Allquiz · ข้อมูลจาก SIS ม.อ. · ${data.generatedAt}`, inner.x, inner.y + inner.h - 4);
  ctx.textAlign = "right";
  ctx.fillText("ตรวจสอบกับระบบลงทะเบียนจริงก่อนลงทะเบียน", inner.x + inner.w, inner.y + inner.h - 4);
  ctx.textAlign = "left";
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
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
  const pad = Math.max(5, Math.min(12, box.w / 14, box.h / 10));
  const tx = box.x + pad + 4;
  const tw = box.w - pad * 2 - 4;
  if (tw < 14 || box.h < 18) return;
  const base = Math.max(10.5, Math.min(17, box.w / 9, box.h / 5.4));
  let y = box.y + pad + base;
  ctx.fillStyle = c.text;
  font(ctx, F, base, 800);
  ctx.fillText(fit(ctx, e.code, tw), tx, y);

  const meta: string[] = [fmtRange(s.start, s.end)];
  if (opt.showSec && e.sec !== "-") meta.push(`Sec ${e.sec}`);
  if (opt.showRoom && s.room && s.room !== "-") meta.push(s.room);
  const metaSize = Math.max(9.5, base * 0.74);
  const instructor = opt.showInstructor && e.instructors.length ? e.instructors.join(", ") : "";
  const footerLines = 1 + (instructor ? 1 : 0);
  const nameSize = Math.max(10, base * 0.84);
  const lineH = nameSize * 1.25;
  const room = box.y + box.h - pad - footerLines * metaSize * 1.3 - (y + 4);
  const nameLines = Math.max(0, Math.floor(room / lineH));
  font(ctx, F, nameSize, 500);
  ctx.globalAlpha = 0.92;
  for (const line of wrap(ctx, e.name, tw, Math.min(3, nameLines))) {
    y += lineH;
    ctx.fillText(line, tx, y);
  }
  ctx.globalAlpha = 0.85;
  font(ctx, F, metaSize, 600);
  let fy = box.y + box.h - pad - (footerLines - 1) * metaSize * 1.3;
  if (fy - metaSize > y - 2) {
    ctx.fillText(fit(ctx, meta.join(" · "), tw), tx, fy);
    if (instructor) {
      fy += metaSize * 1.3;
      font(ctx, F, metaSize, 500);
      ctx.fillText(fit(ctx, instructor, tw), tx, fy);
    }
  }
  ctx.globalAlpha = 1;
}

function drawBlock(ctx: Ctx, theme: ExportTheme, c: BlockColor, b: Box) {
  rr(ctx, b.x, b.y, b.w, b.h, 12);
  ctx.fillStyle = c.bg;
  ctx.fill();
  if (theme.id === "minimal") {
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // accent bar
  ctx.save();
  rr(ctx, b.x, b.y, b.w, b.h, 12);
  ctx.clip();
  ctx.fillStyle = c.border;
  ctx.fillRect(b.x, b.y, 5, b.h);
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
  const dayW = 116;
  const headH = 40;
  const hourW = (g.w - dayW) / hours.length;
  const rowH = (g.h - headH) / days.length;

  // body background
  ctx.fillStyle = theme.surface;
  ctx.fillRect(g.x + dayW, g.y + headH, g.w - dayW, g.h - headH);

  font(ctx, F, 14, 600);
  ctx.fillStyle = theme.muted;
  hours.forEach((h, i) => {
    const x = g.x + dayW + i * hourW;
    ctx.fillText(`${String(h / 60).padStart(2, "0")}:00`, x + 8, g.y + 26);
    ctx.fillStyle = theme.grid;
    ctx.fillRect(x, g.y, 1, g.h);
    ctx.fillStyle = theme.muted;
  });
  ctx.fillStyle = theme.grid;
  ctx.fillRect(g.x, g.y + headH, g.w, 1);

  days.forEach((day, r) => {
    const y = g.y + headH + r * rowH;
    if (r > 0) {
      ctx.fillStyle = theme.grid;
      ctx.fillRect(g.x, y, g.w, 1);
    }
    font(ctx, F, 20, 700);
    ctx.fillStyle = theme.ink;
    ctx.fillText(DAY_NAMES[day], g.x + 18, y + rowH / 2 + 2);
    font(ctx, F, 12, 600);
    ctx.fillStyle = theme.muted;
    ctx.fillText(DAY_EN[day], g.x + 18, y + rowH / 2 + 20);

    const blocks = entries.flatMap((e) => e.slots.filter((s) => s.day === day).map((s) => ({ e, s })));
    const lanes = layoutLanes(blocks.map((b) => b.s));
    blocks.forEach(({ e, s }, i) => {
      const { lane, lanes: n } = lanes[i];
      const laneH = (rowH - 12) / n;
      const box = {
        x: g.x + dayW + ((s.start - startMin) / 60) * hourW + 3,
        y: y + 6 + lane * laneH + (lane ? 2 : 0),
        w: ((s.end - s.start) / 60) * hourW - 6,
        h: laneH - (n > 1 ? 4 : 0),
      };
      const c = theme.blocks[e.color % theme.blocks.length];
      drawBlock(ctx, theme, c, box);
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
  const timeW = 64;
  const headH = 58;
  const colW = (g.w - timeW) / days.length;
  const hourH = (g.h - headH) / hours.length;

  ctx.fillStyle = theme.surface;
  ctx.fillRect(g.x + timeW, g.y + headH, g.w - timeW, g.h - headH);

  font(ctx, F, 14, 600);
  hours.forEach((h, i) => {
    const y = g.y + headH + i * hourH;
    ctx.fillStyle = theme.grid;
    ctx.fillRect(g.x, y, g.w, 1);
    ctx.fillStyle = theme.muted;
    ctx.fillText(`${String(h / 60).padStart(2, "0")}:00`, g.x + 10, y + 20);
  });

  days.forEach((day, i) => {
    const x = g.x + timeW + i * colW;
    ctx.fillStyle = theme.grid;
    ctx.fillRect(x, g.y, 1, g.h);
    ctx.textAlign = "center";
    font(ctx, F, 19, 700);
    ctx.fillStyle = theme.ink;
    ctx.fillText(DAY_NAMES[day].replace("พฤหัสบดี", "พฤหัส"), x + colW / 2, g.y + 28);
    font(ctx, F, 11, 600);
    ctx.fillStyle = theme.muted;
    ctx.fillText(DAY_EN[day], x + colW / 2, g.y + 46);
    ctx.textAlign = "left";

    const blocks = entries.flatMap((e) => e.slots.filter((s) => s.day === day).map((s) => ({ e, s })));
    const lanes = layoutLanes(blocks.map((b) => b.s));
    blocks.forEach(({ e, s }, j) => {
      const { lane, lanes: n } = lanes[j];
      const laneW = (colW - 8) / n;
      const box = {
        x: x + 4 + lane * laneW,
        y: g.y + headH + ((s.start - startMin) / 60) * hourH + 2,
        w: laneW - (n > 1 ? 3 : 0),
        h: ((s.end - s.start) / 60) * hourH - 4,
      };
      const c = theme.blocks[e.color % theme.blocks.length];
      drawBlock(ctx, theme, c, box);
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
  const chartsX = box.vertical ? box.x : box.x + listW + 28;
  const chartsW = box.vertical ? box.w : box.w - listW - 28;
  const listH = box.vertical ? box.h - 210 : box.h;

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
    rr(ctx, x, y + 4, 10, 10, 3);
    ctx.fillStyle = c.border;
    ctx.fill();
    font(ctx, F, 14.5, 700);
    ctx.fillStyle = theme.ink;
    const code = e.code;
    ctx.fillText(code, x + 18, y + 15);
    const cw = ctx.measureText(code).width;
    font(ctx, F, 14.5, 500);
    const right = `${e.sec !== "-" ? `Sec ${e.sec} · ` : ""}${e.credits || 0} นก.`;
    const rw = ctx.measureText(right).width;
    ctx.fillText(fit(ctx, e.name, colW - 18 - cw - 10 - rw - 12), x + 18 + cw + 10, y + 15);
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
      ctx.fillText(fit(ctx, ex || "ยังไม่มีกำหนดสอบ", colW - 18), x + 18, y + 34);
    }
  });
  if (rows.length > perCol * cols) {
    font(ctx, F, 13, 600);
    ctx.fillStyle = theme.muted;
    ctx.fillText(`+ อีก ${rows.length - perCol * cols} วิชา`, box.x + 18, box.y + 34 + perCol * rowH + 4);
  }

  // charts
  const cy = box.vertical ? box.y + listH + 10 : box.y;
  const ch = box.vertical ? 200 : box.h;
  const halfW = box.vertical ? (chartsW - 28) / 2 : chartsW;
  drawComposition(ctx, F, theme, data, { x: chartsX, y: cy, w: halfW, h: box.vertical ? ch : ch * 0.42 });
  drawHoursPerDay(ctx, F, theme, data, {
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
  rr(ctx, b.x, barY, b.w, barH, 4);
  ctx.fillStyle = theme.track;
  ctx.fill();
  if (total > 0) {
    let x = b.x;
    parts.forEach((p, i) => {
      const w = (p.v / total) * b.w - (i < parts.length - 1 ? 2 : 0);
      rr(ctx, x, barY, Math.max(2, w), barH, 4);
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
    rr(ctx, lx, ly - 10, 10, 10, 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.fillStyle = theme.ink;
    ctx.fillText(text, lx + 16, ly);
    lx += tw + 34;
  }
}

/** Class hours per day — single series, value labels (static image has no hover). */
function drawHoursPerDay(ctx: Ctx, F: string, theme: ExportTheme, data: ExportData, b: Box) {
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
      rr(ctx, x, base - h, barW, h, [4, 4, 0, 0]);
      ctx.fillStyle = theme.series[0];
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
