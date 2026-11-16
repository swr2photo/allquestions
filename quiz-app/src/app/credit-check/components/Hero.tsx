import { FileText, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { BUCKETS, BUCKET_META } from "@/lib/credit-check";

/** ภาพประกอบส่วนหัว: วงแหวนสี่หมวด + แท่งรายภาค (ตกแต่งล้วน ไม่มีตัวเลขจริง) */
function HeroArt() {
  const cx = 196;
  const cy = 122;
  const r = 52;
  const circ = 2 * Math.PI * r;
  // สัดส่วนโดยประมาณของสี่หมวด และส่วนที่เติมแล้วของแต่ละหมวด
  const shares = [0.2, 0.52, 0.16, 0.12];
  const fills = [1, 0.7, 0.45, 0.6];
  const arcs = BUCKETS.map((b, i) => {
    const start = shares.slice(0, i).reduce((a, s) => a + s, 0) * circ + 3;
    const len = shares[i] * circ - 6;
    return { color: BUCKET_META[b].color, start, len, fill: len * fills[i] };
  });
  const bars = [18, 30, 24, 38, 28];
  return (
    <svg viewBox="0 0 340 244" className="h-full w-full" aria-hidden>
      <defs>
        <pattern id="credit-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.3" fill="#fff" opacity="0.2" />
        </pattern>
        <radialGradient id="credit-hero-fade" cx="58%" cy="50%" r="60%">
          <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="credit-hero-mask">
          <rect width="340" height="244" fill="url(#credit-hero-fade)" />
        </mask>
      </defs>
      <rect width="340" height="244" fill="url(#credit-hero-dots)" mask="url(#credit-hero-mask)" />
      <circle cx={cx} cy={cy} r="112" fill="none" stroke="#fff" strokeOpacity="0.14" />
      <circle cx={cx} cy={cy} r="90" fill="none" stroke="#fff" strokeOpacity="0.22" strokeDasharray="2 7" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="74" fill="#fff" fillOpacity="0.97" />
      <g transform={`rotate(-90 ${cx} ${cy})`} fill="none" strokeWidth="13">
        {arcs.map((a) => (
          <g key={a.color}>
            <circle cx={cx} cy={cy} r={r} stroke={a.color} strokeOpacity="0.18" strokeDasharray={`${a.len} ${circ}`} strokeDashoffset={-a.start} />
            <circle cx={cx} cy={cy} r={r} stroke={a.color} strokeDasharray={`${a.fill} ${circ}`} strokeDashoffset={-a.start} />
          </g>
        ))}
      </g>
      <GraduationCap x={cx - 17} y={cy - 17} width={34} height={34} color="#047857" strokeWidth={1.8} />

      {/* การ์ดแท่งรายภาค */}
      <g transform="translate(34 136) rotate(-6)">
        <rect width="96" height="74" rx="14" fill="#fff" fillOpacity="0.97" />
        <rect x="12" y="58" width="72" height="1.5" rx="0.75" fill="#e5e7eb" />
        {bars.map((h, i) => (
          <rect key={i} x={14 + i * 14.5} y={58 - h} width="9" height={h} rx="3" fill={BUCKET_META[BUCKETS[i % 4]].color} />
        ))}
      </g>

      {/* ป้ายผ่านเกณฑ์ */}
      <g transform="translate(262 34) rotate(8)">
        <rect width="58" height="30" rx="15" fill="#fff" fillOpacity="0.97" />
        <circle cx="16" cy="15" r="8" fill="#10b981" />
        <path d="M12.2 15.2l2.6 2.6 5-5.2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="29" y="11" width="20" height="3.5" rx="1.75" fill="#d1d5db" />
        <rect x="29" y="17" width="13" height="3.5" rx="1.75" fill="#e5e7eb" />
      </g>
      <Sparkles x={286} y={176} width={22} height={22} color="#fff" strokeWidth={1.6} opacity={0.75} />
      <circle cx="96" cy="60" r="4" fill="#fff" opacity="0.5" />
      <circle cx="118" cy="38" r="2.5" fill="#fff" opacity="0.35" />
    </svg>
  );
}

const POINTS = [
  { icon: FileText, text: "ใช้ PDF ใบเกรดหรือใบลงทะเบียนจาก SIS" },
  { icon: GraduationCap, text: "หลักสูตร วท.บ. ฉบับ 2564 และ 2569" },
  { icon: ShieldCheck, text: "ข้อมูลอยู่ในเครื่องของคุณเท่านั้น" },
];

export function Hero() {
  return (
    <header className="relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg shadow-emerald-900/10">
      <div className="pointer-events-none absolute inset-y-0 -right-16 w-[250px] opacity-20 sm:right-0 sm:opacity-100 lg:w-[340px]">
        <HeroArt />
      </div>
      <div className="relative px-5 py-6 sm:py-9 sm:pr-[250px] sm:pl-8 lg:pr-[350px]">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-white/25 ring-inset">
          คณะวิทยาศาสตร์ ม.อ. วิทยาเขตหาดใหญ่
        </p>
        <h1 className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">เช็กหน่วยกิต</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-emerald-50 sm:text-base">
          ดูว่าแต่ละหมวดของหลักสูตรครบหรือยัง ขาดอีกเท่าไร และผ่านเกณฑ์สำเร็จการศึกษาข้อไหนแล้วบ้าง
        </p>
        <ul className="mt-4 flex flex-col gap-1.5 text-xs font-medium text-emerald-50 sm:flex-row sm:flex-wrap sm:gap-x-4">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> {text}
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
