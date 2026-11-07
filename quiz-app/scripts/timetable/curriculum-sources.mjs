/*
 * แหล่งข้อมูลแผนการศึกษา (study plans) ที่ import-curriculum.mjs ใช้ — แยกตามคณะ
 *
 * Every faculty entry becomes one file public/timetable/curricula/<id>.json plus one entry in
 * public/timetable/curricula/index.json. `faculty` / `campus` must match the SIS names exactly
 * (see public/timetable/terms/*.json) — the app joins on them.
 *
 * An edition's source is one of
 *   pdf:   "https://…/plan.pdf"         a public PDF (text layer required, no OCR)
 *   drive: "<Google Drive file id>"      a public Drive PDF
 *   sheet: "<Google Sheets id>"          a public Google Sheet (every tab is read)
 * Optional per edition:
 *   section: { start: RegExp, end?: RegExp }  only parse lines between these (for documents that
 *            hold several majors, or a whole มคอ.2 where the plan sits in หมวดที่ 3)
 *   page:    the page that links to the file (shown as the source when the file id is opaque)
 *
 * Only add sources a faculty publishes itself; never guess a plan.
 */

const SCI = "https://www.sci.psu.ac.th/wp-content/uploads";
const sciPdf = (p) => `${SCI}/${p}`;

export const FACULTIES = [
  {
    id: "sci",
    faculty: "คณะวิทยาศาสตร์",
    campus: "วิทยาเขตหาดใหญ่",
    title: "คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
    source: "https://www.sci.psu.ac.th",
    programs: [
      {
        id: "biology", name: "ชีววิทยา", division: "วิทยาศาสตร์ชีวภาพ",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.ชีววิทยา.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2021/09/Biology2564.pdf") },
        ],
      },
      {
        id: "biotechnology", name: "เทคโนโลยีชีวภาพ", division: "วิทยาศาสตร์ชีวภาพ",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.เทคโนโลยีชีวภาพ.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2021/09/Biotechnology2564.pdf") },
        ],
      },
      {
        id: "microbiology", name: "จุลชีววิทยา", division: "วิทยาศาสตร์ชีวภาพ",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.จุลชีววิทยา.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2021/09/Microbiology2564.pdf") },
        ],
      },
      {
        id: "chemistry", name: "เคมี", division: "วิทยาศาสตร์กายภาพ",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.เคมี.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2021/09/Chemistry2564.pdf") },
        ],
      },
      {
        id: "chemistry-biology", name: "เคมี-ชีววิทยาประยุกต์", division: "วิทยาศาสตร์สุขภาพและวิทยาศาสตร์ประยุกต์",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.เคมี-ชีววิทยาประยุกต์.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2021/09/AppliedChemistryBiology2564.pdf") },
        ],
      },
      {
        id: "physics", name: "ฟิสิกส์", division: "วิทยาศาสตร์กายภาพ",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.ฟิสิกส์.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2021/09/Physics2564-compressed.pdf") },
        ],
      },
      {
        id: "materials-science", name: "วัสดุศาสตร์", division: "วิทยาศาสตร์กายภาพ",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.วัสดุศาสตร์.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2021/09/MaterialsScience2564.pdf") },
        ],
      },
      {
        id: "polymer-science", name: "วิทยาศาสตร์พอลิเมอร์", division: "วิทยาศาสตร์กายภาพ",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.วิทยาศาสตร์พอลิเมอร์.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2021/09/PolymerScience2564.pdf") },
        ],
      },
      {
        id: "mathematics", name: "คณิตศาสตร์", division: "วิทยาศาสตร์การคำนวณ",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.คณิตศาสตร์.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2021/09/Mathematics2564.pdf") },
        ],
      },
      {
        id: "statistics", name: "สถิติประยุกต์และวิทยาการข้อมูล", division: "วิทยาศาสตร์การคำนวณ",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.สถิติประยุกต์และวิทยาการข้อมูล.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2021/09/Statistics2564.pdf") },
        ],
      },
      {
        id: "computer-science", name: "วิทยาการคอมพิวเตอร์", division: "วิทยาศาสตร์การคำนวณ",
        editions: [
          { curriculumYear: 2569, pdf: sciPdf("2026/06/2569-วท.บ.วิทยาการคอมพิวเตอร์.pdf") },
          { curriculumYear: 2564, pdf: sciPdf("2023/10/ComputerScience25641.pdf") },
        ],
      },
      {
        id: "information-and-communication-technology", name: "เทคโนโลยีสารสนเทศและการสื่อสาร", division: "วิทยาศาสตร์การคำนวณ",
        editions: [{ curriculumYear: 2564, pdf: sciPdf("2021/09/ict2564-แผนการศึกษา.pdf") }],
      },
    ],
  },
];
