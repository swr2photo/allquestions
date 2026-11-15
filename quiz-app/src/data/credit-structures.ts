// โครงสร้างหน่วยกิตของหลักสูตร วท.บ. คณะวิทยาศาสตร์ ม.อ. (วิทยาเขตหาดใหญ่)
//
// ตัวเลขถอดจากหัวข้อ "โครงสร้างหลักสูตร" ในเล่มหลักสูตร (มคอ.2) ที่เผยแพร่บน www.sci.psu.ac.th
// ฉบับปรับปรุง พ.ศ. 2564 และ 2569 — ตรวจด้วยมือทีละฉบับให้ผลรวมรายหมวดเท่ากับหน่วยกิตรวมตลอดหลักสูตร
// รายชื่อรายวิชาในแต่ละหมวดใช้จาก public/timetable/curricula/sci.json (แผนการศึกษา + รายวิชาเลือก)

export interface CreditPlan {
  id: string;
  label: string;
  /** กลุ่มวิชาบังคับ/วิชาเอกบังคับ (ไม่รวมกลุ่มวิชาพื้นฐาน/วิชาแกน) */
  required: number;
  /** กลุ่มวิชาเลือกในหมวดวิชาเฉพาะ */
  elective: number;
  /** แผนสหกิจศึกษา — ใช้จับคู่กับแผนใน sci.json */
  coop?: boolean;
}

export interface CreditStructure {
  programId: string;
  curriculumYear: number;
  /** หมวดวิชาศึกษาทั่วไป */
  ge: number;
  /** กลุ่มวิชาวิทยาศาสตร์พื้นฐาน / วิชาแกน */
  basic: number;
  /** หมวดวิชาเลือกเสรี */
  free: number;
  plans: CreditPlan[];
  /** หน่วยกิตบังคับนอกหมวด เช่น ฝึกงาน */
  extra?: { label: string; credits: number }[];
  /** true = ไม่มีเล่มหลักสูตรฉบับเต็ม ตัวเลขประมาณจากแผนการศึกษา */
  approx?: boolean;
}

const one = (required: number, elective: number): CreditPlan[] => [{ id: "all", label: "ทุกแผน", required, elective }];
const two = (n: [number, number], c: [number, number], normalLabel = "แผนปกติ"): CreditPlan[] => [
  { id: "normal", label: normalLabel, required: n[0], elective: n[1] },
  { id: "coop", label: "แผนสหกิจศึกษา", required: c[0], elective: c[1], coop: true },
];

export const SCI_CREDIT_STRUCTURES: CreditStructure[] = [
  { programId: "biology", curriculumYear: 2569, ge: 24, basic: 15, free: 6, plans: two([69, 9], [69, 9]) },
  { programId: "biology", curriculumYear: 2564, ge: 30, basic: 26, free: 6, plans: two([48, 12], [51, 9]) },
  { programId: "biotechnology", curriculumYear: 2569, ge: 24, basic: 12, free: 6, plans: two([68, 10], [68, 10]) },
  { programId: "biotechnology", curriculumYear: 2564, ge: 30, basic: 47, free: 6, plans: one(37, 6) },
  { programId: "microbiology", curriculumYear: 2569, ge: 24, basic: 15, free: 6, plans: two([53, 24], [56, 21]) },
  {
    programId: "microbiology", curriculumYear: 2564, ge: 30, basic: 26, free: 6, plans: two([52, 21], [55, 18]),
    extra: [{ label: "ฝึกงาน", credits: 1 }],
  },
  { programId: "chemistry", curriculumYear: 2569, ge: 24, basic: 16, free: 6, plans: two([45, 29], [49, 25]) },
  { programId: "chemistry", curriculumYear: 2564, ge: 30, basic: 25, free: 6, plans: two([52, 8], [56, 4]) },
  { programId: "chemistry-biology", curriculumYear: 2569, ge: 24, basic: 12, free: 6, plans: two([61, 17], [64, 14]) },
  { programId: "chemistry-biology", curriculumYear: 2564, ge: 30, basic: 20, free: 6, plans: two([47, 17], [50, 14]) },
  { programId: "physics", curriculumYear: 2569, ge: 24, basic: 24, free: 6, plans: two([44, 22], [47, 19], "แผนโครงงาน") },
  {
    programId: "physics", curriculumYear: 2564, ge: 30, basic: 25, free: 6,
    plans: [
      { id: "normal", label: "แผนโครงงาน", required: 43, elective: 19 },
      { id: "coop", label: "สหกิจศึกษา 1 ภาค", required: 43, elective: 19, coop: true },
      { id: "coop2", label: "สหกิจศึกษา 2 ภาค", required: 49, elective: 13, coop: true },
    ],
  },
  { programId: "materials-science", curriculumYear: 2569, ge: 24, basic: 17, free: 6, plans: two([44, 29], [47, 26]) },
  { programId: "materials-science", curriculumYear: 2564, ge: 30, basic: 22, free: 6, plans: two([38, 24], [41, 21]) },
  { programId: "polymer-science", curriculumYear: 2569, ge: 24, basic: 12, free: 6, plans: two([64, 14], [66, 12]) },
  { programId: "polymer-science", curriculumYear: 2564, ge: 30, basic: 15, free: 6, plans: one(66, 8) },
  // คณิตศาสตร์: "บังคับ" = กลุ่มวิชาคณิตศาสตร์พื้นฐาน + กลุ่มวิชาเฉพาะด้าน 24 หน่วยกิต
  { programId: "mathematics", curriculumYear: 2569, ge: 24, basic: 12, free: 6, plans: two([65, 13], [68, 10]) },
  { programId: "mathematics", curriculumYear: 2564, ge: 30, basic: 24, free: 6, plans: two([57, 13], [60, 10]) },
  { programId: "statistics", curriculumYear: 2569, ge: 24, basic: 12, free: 6, plans: two([51, 27], [54, 24]) },
  { programId: "statistics", curriculumYear: 2564, ge: 30, basic: 24, free: 6, plans: two([57, 21], [61, 17]) },
  { programId: "computer-science", curriculumYear: 2569, ge: 24, basic: 12, free: 6, plans: one(56, 27) },
  { programId: "computer-science", curriculumYear: 2564, ge: 30, basic: 12, free: 6, plans: two([51, 33], [54, 30]) },
  {
    programId: "information-and-communication-technology", curriculumYear: 2564, ge: 30, basic: 0, free: 9,
    plans: one(79, 18), approx: true,
  },
];

export function findCreditStructure(programId: string, curriculumYear: number): CreditStructure | undefined {
  return SCI_CREDIT_STRUCTURES.find((s) => s.programId === programId && s.curriculumYear === curriculumYear);
}

export function structureTotal(s: CreditStructure, plan: CreditPlan): number {
  return s.ge + s.basic + plan.required + plan.elective + s.free + (s.extra ?? []).reduce((a, e) => a + e.credits, 0);
}

/** เกณฑ์ขั้นต่ำรายสาระของ GE โครงสร้างใหม่ (ปรับปรุง 2567 / หลักสูตร 2569): บังคับ GE1–GE7 รวม 18 หน่วยกิต ที่เหลือเป็น GE8 */
export const GE_AREA_MIN: Record<string, number> = { GE1: 4, GE2: 4, GE3: 2, GE4: 2, GE5: 2, GE6: 2, GE7: 2 };

/** เกณฑ์ย่อยของ GE2 การพัฒนาความคิด (4 หน่วยกิต): ต้องเรียนทั้ง 2A และ 2B อย่างละ 2 หน่วยกิต */
export const GE2_SUB_MIN = [
  { key: "GE2A" as const, short: "2A ตรรกะ/ตัวเลข", need: 2 },
  { key: "GE2B" as const, short: "2B คิดเชิงระบบ", need: 2 },
];

/**
 * รายวิชาหมวดศึกษาทั่วไปของหลักสูตร 2564 (สาระที่ 1–7 + วิชาเลือก) ที่ระบุในเล่มหลักสูตรคณะวิทยาศาสตร์
 * — รหัสรุ่นนี้ไม่มีส่วนท้าย G1–G8 และไม่อยู่ในหมวด GE1–GE8 ของ gened.psu.ac.th
 */
export const LEGACY_GE_CODES: ReadonlySet<string> = new Set([
  "001-101", "001-102", "001-103", "001-131", "061-001", "142-111", "142-112", "142-115", "142-116", "142-129",
  "142-135", "142-136", "142-137", "142-138", "142-139", "142-211", "142-212", "142-214", "142-224", "142-225",
  "142-226", "142-227", "142-228", "142-229", "142-234", "142-237", "142-238", "142-239", "190-404", "315-103",
  "315-200", "315-201", "315-202", "322-100", "332-100", "336-214", "336-215", "336-216", "340-103", "340-151",
  "340-162", "345-104", "348-103", "388-100", "472-116", "472-117", "472-118", "874-192", "874-193", "874-194",
  "874-195", "890-001", "890-002", "890-003", "890-004", "890-005", "890-010", "890-011", "890-012", "890-013",
  "890-014", "890-015", "890-020", "890-021", "890-022", "890-023", "890-024", "890-025", "890-026", "890-030",
  "890-031", "890-032", "890-033", "890-040", "890-041", "890-050", "890-060", "890-061", "890-070", "890-071",
  "891-010", "891-011", "891-012", "891-020", "891-021", "891-022", "891-030", "891-031", "891-032", "891-033",
  "891-034", "891-040", "891-041", "891-042", "891-050", "895-001", "895-010", "895-020", "895-021", "895-022",
  "895-023", "895-024", "895-025", "895-026", "895-027", "895-028", "895-030", "895-031", "895-032", "895-033",
  "895-034", "895-035", "895-036", "895-037", "895-038", "895-039", "895-040", "895-041", "895-042", "895-043",
  "895-044", "895-045", "895-046", "895-047", "895-048", "895-049", "895-050", "895-051", "895-052", "895-053",
  "895-054", "895-055", "895-056", "895-057", "895-058", "895-059", "895-060", "895-061", "895-062", "895-063",
  "895-070", "950-102",
]);
