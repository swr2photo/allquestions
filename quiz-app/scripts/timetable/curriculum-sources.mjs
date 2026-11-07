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

  // Engineering publishes each program's แผนการศึกษา as a public Google Sheet, linked from
  // https://www.eng.psu.ac.th/course/<n>-bch-<program> ("หลักสูตรปรับปรุง ปี พ.ศ. 2569 (สำหรับนักศึกษารหัส
  // 69-73)" / "… 2564 (… รหัส 65-68)"). Divisions are the SIS department names of each program's codes.
  {
    id: "eng",
    faculty: "คณะวิศวกรรมศาสตร์",
    campus: "วิทยาเขตหาดใหญ่",
    title: "คณะวิศวกรรมศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
    source: "https://www.eng.psu.ac.th/apply-undergraduated",
    programs: [
      {
        id: "electrical", name: "วิศวกรรมไฟฟ้า", division: "สาขาวิชาวิศวกรรมไฟฟ้าและชีวการแพทย์",
        editions: [
          { curriculumYear: 2569, sheet: "1ncQpwuYJcp8rzxK5Nh5xWPykurMMoPR92ItHAFElfbc", page: "https://www.eng.psu.ac.th/course/84-bch-ee" },
          { curriculumYear: 2564, sheet: "1JdOB-LJprjvDD4escpqQElboIFGjDT_jlF8kb2gFzjQ", page: "https://www.eng.psu.ac.th/course/84-bch-ee" },
        ],
      },
      {
        id: "biomedical", name: "วิศวกรรมชีวการแพทย์", division: "สาขาวิชาวิศวกรรมไฟฟ้าและชีวการแพทย์",
        editions: [
          { curriculumYear: 2569, sheet: "16k6kX6w8BZjMTEdnQG1tEm6nee4zeIbVMWcX1u7LoEA", page: "https://www.eng.psu.ac.th/course/85-bch-be" },
          { curriculumYear: 2564, sheet: "1e5YaQsDJdvUkpA98RQlQzU2xvgT646VcDnAKs47s0cQ", page: "https://www.eng.psu.ac.th/course/85-bch-be" },
        ],
      },
      {
        id: "mechanical", name: "วิศวกรรมเครื่องกล", division: "สาขาวิชาวิศวกรรมเครื่องกลและเมคาทรอนิกส์",
        editions: [
          { curriculumYear: 2569, sheet: "1lib_7vCAXE4gRWNG328bgwHnESh41BBd-TPGD1Zon2E", page: "https://www.eng.psu.ac.th/course/86-bch-me" },
          { curriculumYear: 2564, sheet: "1ZKw1N10qC-GWQjjE5VZCIX7VYk0KNEy31hhGuaRrd2Y", page: "https://www.eng.psu.ac.th/course/86-bch-me" },
        ],
      },
      {
        id: "mechatronics", name: "วิศวกรรมเมคาทรอนิกส์", division: "สาขาวิชาวิศวกรรมเครื่องกลและเมคาทรอนิกส์",
        editions: [
          { curriculumYear: 2569, sheet: "1wHwBcXhKkcMc1m9ZO3ZorNlQeTnB9SVOGOxHVjPnUHc", page: "https://www.eng.psu.ac.th/course/87-bch-mce" },
          { curriculumYear: 2564, sheet: "1Q15hXRWaGip5DNXg3RTAth6SxH_XGW8pel0y1QXlzww", page: "https://www.eng.psu.ac.th/course/87-bch-mce" },
        ],
      },
      {
        id: "civil", name: "วิศวกรรมโยธา", division: "สาขาวิชาวิศวกรรมโยธาและสิ่งแวดล้อม",
        editions: [
          { curriculumYear: 2569, sheet: "1rQ4lI4TrV3ntAq6JUdEQBBHG5iUOBUbRXGQBcToEMT4", page: "https://www.eng.psu.ac.th/course/88-bch-ce" },
          { curriculumYear: 2564, sheet: "1d-Jhj-3eQ2pqxCAhJCopqPLfDXjqsmxie7cP_tTkwIk", page: "https://www.eng.psu.ac.th/course/88-bch-ce" },
        ],
      },
      {
        id: "environmental", name: "วิศวกรรมสิ่งแวดล้อม", division: "สาขาวิชาวิศวกรรมโยธาและสิ่งแวดล้อม",
        editions: [
          { curriculumYear: 2569, sheet: "1H-_AUo-HujX1COOL17T6Fr01vPQRsWc6xDZ9kghD5no", page: "https://www.eng.psu.ac.th/course/89-bch-eve" },
          { curriculumYear: 2564, sheet: "1xZbn1UZmKquRz9GMvA2weevG6I9pvItp_upGxzQ_HgI", page: "https://www.eng.psu.ac.th/course/89-bch-eve" },
        ],
      },
      {
        id: "industrial", name: "วิศวกรรมอุตสาหการ", division: "สาขาวิชาวิศวกรรมอุตสาหการและการผลิต",
        editions: [
          { curriculumYear: 2569, sheet: "1mBJ-70SzrifNcaGJsCV9XMOk2Y-MBglAVvJRecTJpXo", page: "https://www.eng.psu.ac.th/course/90-bch-ie" },
          { curriculumYear: 2564, sheet: "1l3v8mECrG-FlrIByqkZb8aKOWaa1V7snOA4XQer3I70", page: "https://www.eng.psu.ac.th/course/90-bch-ie" },
        ],
      },
      {
        id: "manufacturing", name: "วิศวกรรมการผลิต", division: "สาขาวิชาวิศวกรรมอุตสาหการและการผลิต",
        editions: [
          { curriculumYear: 2569, sheet: "1He9Uz_fWvRgtwD6ppQqZr7fgjtfglg0zNyrY8l01qJ8", page: "https://www.eng.psu.ac.th/course/91-bch-mfe" },
          { curriculumYear: 2564, sheet: "1Ytjsdrq4-3QyNNpf2e7Rb0BmAkOhyS20gc3b_-Hr8oo", page: "https://www.eng.psu.ac.th/course/91-bch-mfe" },
        ],
      },
      {
        id: "chemical", name: "วิศวกรรมเคมี", division: "สาขาวิชาวิศวกรรมเคมี",
        editions: [
          { curriculumYear: 2569, sheet: "1BvAjtqo-Rd_9w6NxjCWEpsIvMdmVpw6bOybzWrLFhIM", page: "https://www.eng.psu.ac.th/course/92-bch-che" },
          { curriculumYear: 2564, sheet: "1WNJHiVMmHEBUbTUBMatqGCqp-NsNsar-bSS61T4yuYk", page: "https://www.eng.psu.ac.th/course/92-bch-che" },
        ],
      },
      {
        id: "computer", name: "วิศวกรรมคอมพิวเตอร์", division: "สาขาวิชาวิศวกรรมคอมพิวเตอร์",
        editions: [
          { curriculumYear: 2569, sheet: "1APwCzatO6o83scmi89LmksbcDqis9VpjwtfRG67nDmE", page: "https://www.eng.psu.ac.th/course/93-bch-coe" },
          { curriculumYear: 2564, sheet: "1TtmO0WhKBu2ffPcTsbbGKjt1R7BxVKFBOvvPp2ttyiM", page: "https://www.eng.psu.ac.th/course/93-bch-coe" },
        ],
      },
      {
        id: "artificial-intelligence", name: "วิศวกรรมปัญญาประดิษฐ์", division: "สาขาวิชาวิศวกรรมคอมพิวเตอร์",
        editions: [
          { curriculumYear: 2569, sheet: "1LVF6PXXH-qvmqJX3gTtX-TVUzurAbjMV7cV9M8SyCH8", page: "https://www.eng.psu.ac.th/course/121-bch-ai" },
          { curriculumYear: 2564, sheet: "18Uz9nnwwipjf4Tdqq796NWf2DUhd325mBc4aRGcbsw0", page: "https://www.eng.psu.ac.th/course/121-bch-ai" },
        ],
      },
      {
        id: "mining-materials", name: "วิศวกรรมเหมืองแร่และวัสดุ", division: "สาขาวิชาวิศวกรรมเหมืองแร่และวัสดุ",
        editions: [
          { curriculumYear: 2569, sheet: "130lM6HtEmZo1Ohi0hYpqY01St-2Fi4fRaEoVm53UmQE", page: "https://www.eng.psu.ac.th/course/94-bch-mne" },
          { curriculumYear: 2564, sheet: "1SBgZ1si9plYXvee4MAGETjcj0gXmm5_ga1--LxrOH8k", page: "https://www.eng.psu.ac.th/course/94-bch-mne" },
        ],
      },
      {
        id: "innovation-management", name: "วิศวกรรมและการจัดการนวัตกรรม (นานาชาติ)", division: "สาขาวิชาวิศวกรรมสหวิทยาการ",
        editions: [
          { curriculumYear: 2569, sheet: "1oeiMNlitRKVuJJczISuYFRck-caUzEUBVH9eQUVdfCc", page: "https://www.eng.psu.ac.th/course/122-bch-innoem" },
          { curriculumYear: 2564, sheet: "1LD12SaQUmNQg91AQaP4D3fN1fOcXOxpRQ_X_mku6WzY", page: "https://www.eng.psu.ac.th/course/122-bch-innoem" },
        ],
      },
      {
        id: "rubber", name: "วิศวกรรมยาง (นานาชาติ)", division: "สาขาวิชาวิศวกรรมสหวิทยาการ",
        editions: [
          { curriculumYear: 2568, sheet: "1aguCLtQky5a5J4FXGHHm-R4m5QoNFkMCDkeqPTVrJBY", page: "https://www.eng.psu.ac.th/course/1127-bch-irc" },
        ],
      },
      {
        id: "semiconductor", name: "วิศวกรรมเซมิคอนดักเตอร์", division: "สาขาวิชาวิศวกรรมสหวิทยาการ",
        editions: [
          { curriculumYear: 2568, sheet: "1I_VDQ4Rqwue59oIfTlS2vizsCiX3amXRNUG4_j3qzqU", page: "https://www.eng.psu.ac.th/course/1203-sc-irc" },
        ],
      },
    ],
  },

  // Bachelor plans linked from https://agro.psu.ac.th/agro6/curriculum. The page also lists
  // เทคโนโลยีการจัดการอุตสาหกรรมอาหาร 2565 and การกำหนดอาหารและโภชนาการเพื่อสุขภาพ 2566, but their
  // plan links are bare file names that don't resolve — not imported.
  {
    id: "agro",
    faculty: "คณะอุตสาหกรรมเกษตร",
    campus: "วิทยาเขตหาดใหญ่",
    title: "คณะอุตสาหกรรมเกษตร มหาวิทยาลัยสงขลานครินทร์",
    source: "https://agro.psu.ac.th/agro6/curriculum",
    programs: [
      {
        id: "food-science", name: "วิทยาศาสตร์และเทคโนโลยีอาหาร", division: "อุตสาหกรรมเกษตร",
        editions: [{ curriculumYear: 2565, pdf: "https://agro.psu.ac.th/agro6/wp-content/uploads/2026/07/plan-bachelor-foodsci-2565.pdf" }],
      },
      {
        id: "packaging", name: "เทคโนโลยีบรรจุภัณฑ์และวัสดุ", division: "อุตสาหกรรมเกษตร",
        editions: [{ curriculumYear: 2567, pdf: "https://agro.psu.ac.th/agro6/wp-content/uploads/2026/08/plan-bachelor-packaging-2567.pdf" }],
      },
    ],
  },

  // Management Sciences: "เอกสารหลักสูตรฉบับเต็ม" (มคอ.2) linked from https://www.fms.psu.ac.th/?page=curriculum-detail&id=N.
  // The BBA 2567 document (same file for ids 3, 4, 6) holds every major's plan under "3.N วิชาเอก…";
  // each major is cut out with `section`. The international BBA (id 7) lists courses per year
  // ("Semester 1 and 2"), not per term, and รัฐประศาสนศาสตร์ (id 9) has no document — not imported.
  {
    id: "fms",
    faculty: "คณะวิทยาการจัดการ",
    campus: "วิทยาเขตหาดใหญ่",
    title: "คณะวิทยาการจัดการ มหาวิทยาลัยสงขลานครินทร์",
    source: "https://www.fms.psu.ac.th/?page=courses-type&id=1",
    programs: [
      ...[
        ["finance", "บริหารธุรกิจ วิชาเอกการเงินและการลงทุน", 1],
        ["marketing", "บริหารธุรกิจ วิชาเอกการตลาดและการสื่อสาร", 2],
        ["hrm", "บริหารธุรกิจ วิชาเอกการจัดการทรัพยากรมนุษย์", 3],
        ["logistics", "บริหารธุรกิจ วิชาเอกการจัดการโลจิสติกส์และโซ่อุปทาน", 4],
        ["bis", "บริหารธุรกิจ วิชาเอกระบบสารสนเทศทางธุรกิจ", 5],
        ["mice", "บริหารธุรกิจ วิชาเอกการจัดการไมซ์", 6],
      ].map(([id, name, n]) => ({
        id: `bba-${id}`, name, division: "สาขาวิชาบริหารธุรกิจ",
        editions: [{
          curriculumYear: 2567,
          pdf: "https://www.fms.psu.ac.th/files/curriculum/documents/CURR20250003_document.pdf",
          section: { start: new RegExp(`^\\s*3\\.${n} วิชาเอก`), end: n < 6 ? new RegExp(`^\\s*3\\.${n + 1} วิชาเอก`) : undefined },
          statedTotal: null,
        }],
      })),
      {
        id: "accounting", name: "บัญชีบัณฑิต", division: "สาขาวิชาการบัญชี",
        editions: [{ curriculumYear: 2568, pdf: "https://www.fms.psu.ac.th/files/curriculum/documents/CURR20250008_document.pdf" }],
      },
    ],
  },

  // Natural Resources: program pages (Google Sites) linked from https://natres.psu.ac.th/main/?page_id=977.
  // วาริชศาสตร์ 2564 "โครงสร้างและแผนหลักสูตร" is on natres.psu.ac.th. Not imported:
  //   - เกษตรศาสตร์ 2564 (4 majors, Drive PDFs on sites.google.com/psu.ac.th/nr-aim/…/bs-c-agri):
  //     two terms side by side with codes and credits wrapped onto separate lines ("514-" / "202") —
  //     rows and term totals can't be told apart reliably;
  //   - นวัตกรรมการเกษตรและการจัดการ (plan PDF states no curriculum year);
  //   - สัตวศาสตร์ (program site needs a PSU sign-in).
  {
    id: "natres",
    faculty: "คณะทรัพยากรธรรมชาติ",
    campus: "วิทยาเขตหาดใหญ่",
    title: "คณะทรัพยากรธรรมชาติ มหาวิทยาลัยสงขลานครินทร์",
    source: "https://natres.psu.ac.th/main/?page_id=977",
    programs: [
      {
        id: "aquatic-science", name: "วาริชศาสตร์", division: "สาขาวิชาวาริชศาสตร์และนวัตกรรมการจัดการ",
        editions: [{
          curriculumYear: 2564,
          pdf: "https://natres.psu.ac.th/department/aqutic/document/b/โครงสร้างและแผนหลักสูตร-2_2.pdf",
        }],
      },
    ],
  },

  // Liberal Arts (Hat Yai): each B.A. program's "แผนการศึกษา" page on the faculty's Google Site
  // (https://sites.google.com/view/fla-es/bachelor-of-arts/…) embeds the plan as a Drive PDF.
  {
    id: "libarts",
    faculty: "คณะศิลปศาสตร์",
    campus: "วิทยาเขตหาดใหญ่",
    title: "คณะศิลปศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
    source: "https://sites.google.com/view/fla-es/bachelor-of-arts",
    programs: [
      {
        id: "applied-thai", name: "ภาษาไทยประยุกต์", division: "สาขาวิชาสังคม วัฒนธรรมและการพัฒนามนุษย์",
        editions: [{ curriculumYear: 2564, drive: "1eZ_Oas7BXq6kjXYN1WYgwYp7OMD8HNcA", page: "https://sites.google.com/view/fla-es/bachelor-of-arts/applied-thai" }],
      },
      {
        id: "english", name: "ภาษาอังกฤษ", division: "สาขาวิชาภาษาต่างประเทศ",
        editions: [{ curriculumYear: 2563, drive: "1pSWY7ZN-bNOTHGgyQBYcb2jJ1SJWX3eR", page: "https://sites.google.com/view/fla-es/bachelor-of-arts/english" }],
      },
      {
        id: "chinese", name: "ภาษาจีน", division: "สาขาวิชาภาษาต่างประเทศ",
        editions: [{ curriculumYear: 2564, drive: "1Znugq1tlAHI2LAAwH-Y398pd0fYvTnOw", page: "https://sites.google.com/view/fla-es/bachelor-of-arts/chinese" }],
      },
      {
        id: "community-studies", name: "ชุมชนศึกษาเพื่อการพัฒนาที่ยั่งยืน", division: "สาขาวิชาสังคม วัฒนธรรมและการพัฒนามนุษย์",
        editions: [{ curriculumYear: 2564, drive: "1rNwLI6BewaKYxnku_CI-kDN2pXBQl-Z1", page: "https://sites.google.com/view/fla-es/bachelor-of-arts/community-studies" }],
      },
      {
        id: "aviation", name: "การจัดการอุตสาหกรรมการบินและการบริการ", division: "สาขาวิชาภาษาต่างประเทศ",
        editions: [{ curriculumYear: 2563, drive: "17tRutSeYKXhpgg45ATfa4ShVpPr2MyM_", page: "https://sites.google.com/view/fla-es/bachelor-of-arts/aviation" }],
      },
    ],
  },

  // Nursing (Hat Yai): "แผนการศึกษาหลักสูตรพยาบาลศาสตรบัณฑิต หลักสูตรปรับปรุง พ.ศ. 2567" linked from
  // https://www.nur.psu.ac.th/nur/student_info.aspx. Years 3–4 are split into four student groups
  // (ตอน 01–04, one credits column each) — each becomes a plan; all four add up to the stated 127.
  // Not imported: หลักสูตร 2563 — its years 3–4 were re-planned from 1/2565 (Docs_03042566.pdf holds the
  // new plan only as a side-by-side old/new comparison table), so neither the มคอ.2 plan nor the
  // English-class plan (plan_2563_eng_edit.pdf, updated 9/6/2564) is current for years 3–4.
  {
    id: "nur",
    faculty: "คณะพยาบาลศาสตร์",
    campus: "วิทยาเขตหาดใหญ่",
    title: "คณะพยาบาลศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
    source: "https://www.nur.psu.ac.th/nur/student_info.aspx",
    programs: [
      {
        id: "nursing", name: "พยาบาลศาสตร์", division: "คณะพยาบาลศาสตร์",
        editions: [{
          curriculumYear: 2567,
          pdf: "https://www.nur.psu.ac.th/nur/file_courses/Docs_08042568.pdf",
          statedTotal: 127, // "หลักสูตรพยาบาลศาสตรบัณฑิต (หลักสูตรปรับปรุง พ.ศ. 2567) จำนวน 127 หน่วยกิต"
        }],
      },
    ],
  },

  // Law (Hat Yai): the มคอ.2 of each curriculum is embedded as a Drive PDF on
  // https://law.psu.ac.th/index.php/course/bachelor-degree.html (the site rejects scripted requests,
  // the Drive files don't). Both list the co-op plan (and 2564 the ASEAN-exchange plan) only for the
  // terms that differ — "ในปีที่ 1 ถึง ปีที่ 3 ใช้แผนการศึกษาเดียวกับแผนการศึกษาปกติ" — so the rest is
  // filled from แผนปกติ; co-op / exchange students "ไม่จำเป็นต้องลงทะเบียนในภาคฤดูร้อน" (year 3 summer).
  // The third file on that page (โครงสร้างหลักสูตร 2569) has no plan.
  {
    id: "law",
    faculty: "คณะนิติศาสตร์",
    campus: "วิทยาเขตหาดใหญ่",
    title: "คณะนิติศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
    source: "https://law.psu.ac.th/index.php/course/bachelor-degree.html",
    programs: [
      {
        id: "law", name: "นิติศาสตร์", division: "คณะนิติศาสตร์",
        editions: [
          {
            curriculumYear: 2569,
            drive: "1X7B9ieAAuMH2ckiCK8rJejymcRNAcyVm",
            page: "https://law.psu.ac.th/index.php/course/bachelor-degree.html",
            fill: { from: "ปกติ" },
          },
          {
            curriculumYear: 2564,
            drive: "1roEyPvTPe_zrae5KQKzm9YUWBr9VUQVL",
            page: "https://law.psu.ac.th/index.php/course/bachelor-degree.html",
            lineFixes: [
              // a row whose "(สาระ 5)" wraps around its credits
              [/\(สาระ 2\(\(2\)-0-4\)\s*$/, "(สาระ 5) 2((2)-0-4)"],
              // exchange plan, year 4 term 2: the one row has no code
              [/^(\s*)(ลงทะเบียนเรียนรายวิชาที่เกี่ยวกับกฎหมายภายในของประเทศ)/, "$1xxx-xxx $2"],
            ],
            renamePlans: { "แผน 2": "สหกิจศึกษา", "นักศึกษาที่เลือกเรียนรายวิชากฎหมาย": "ศึกษา ณ ต่างประเทศ" },
            fill: { from: "ปกติ", except: ["3/3"] },
          },
        ],
      },
    ],
  },

  // Medicine (Hat Yai): curriculum documents linked from https://school.medicine.psu.ac.th/undergraduate-program/.
  // Only years split into ภาคการศึกษา are imported — later clinical years are one block per year
  // (กายภาพบำบัด 2568 year 4 "ตลอดปีการศึกษา" 20 หน่วยกิต; รังสีเทคนิค 2567 years 3–4, 34 + 21), which
  // the app's terms can't hold (กายภาพบำบัด 2563 year 4: 29). Not imported:
  //   - แพทยศาสตรบัณฑิต 2564 (all four แผนการศึกษา): every year is one block (ปีที่ 1 39, ปีที่ 2 41 …);
  //   - ปฏิบัติการฉุกเฉินการแพทย์ 2565: only year 1 has terms ("ชั้นปีที่ 2-4 จัดการศึกษาเป็นปีการศึกษา");
  //   - รังสีเทคนิค 2562 (doc2022110406.pdf): its text layer drops rows — every term reads 2–8 credits
  //     short of its own "รวม".
  {
    id: "med",
    faculty: "คณะแพทยศาสตร์",
    campus: "วิทยาเขตหาดใหญ่",
    title: "คณะแพทยศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
    source: "https://school.medicine.psu.ac.th/undergraduate-program/",
    programs: [
      {
        id: "physical-therapy", name: "กายภาพบำบัด", division: "สาขาวิชากายภาพบำบัด",
        editions: [
          { curriculumYear: 2568, drive: "1eEz1lUc1bkdXd6_rEhy3LaajTCrh7PTp", page: "https://school.medicine.psu.ac.th/undergraduate-program/" },
          { curriculumYear: 2563, pdf: "https://school.medicine.psu.ac.th/wp-content/uploads/2022/11/doc2022110901.pdf" },
        ],
      },
      {
        id: "radiological-technology", name: "รังสีเทคนิค", division: "สาขาวิชารังสีวิทยา",
        editions: [{ curriculumYear: 2567, drive: "1p-Mzs3KTTl4uucDHStUj0DWQuD4EF4fe", page: "https://school.medicine.psu.ac.th/undergraduate-program/" }],
      },
    ],
  },

  // International College (Hat Yai): CMDT's study-plan page https://cmdt-uic.psu.ac.th/study-plan/
  // links the 2568 มคอ.2. Term totals there are bare "18 หน่วยกิต" lines and year 4 term 2 lists two
  // groups side by side ("เลือกลงทะเบียนตามกลุ่มที่ 1 หรือ กลุ่มที่ 2"), so lineFixes restore one row per
  // line. Not imported: CMDT 2563 (https://cmdt-uic.psu.ac.th/study-plan-2/ — its "แผนการศึกษาตามแผน
  // การเรียนการสอนแบบโมดูล" lists modules per term, "เลือก M01.1 …", without course codes or credits).
  {
    id: "psuic",
    faculty: "วิทยาลัยนานาชาติ",
    campus: "วิทยาเขตหาดใหญ่",
    title: "วิทยาลัยนานาชาติ มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตหาดใหญ่",
    source: "https://uic.psu.ac.th/creative-media-and-digital-technologies/",
    programs: [
      {
        id: "cmdt", name: "สื่อสร้างสรรค์และเทคโนโลยีดิจิทัล (นานาชาติ)", division: "วิทยาลัยนานาชาติ วิทยาเขตหาดใหญ่",
        editions: [{
          curriculumYear: 2568,
          pdf: "https://cmdt-uic.psu.ac.th/wp-content/uploads/2026/05/หลักสูตรวท.บ. สื่อสร้างสรรค์และเทคโนโลยีดิจิทัล_นานาชาติ 2568 เพิ่มวิทยาเขตแล้ว.pdf",
          lineFixes: [
            [/^(\s+)(\d{1,2}) หน่วยกิต\s*$/, "$1รวม $2 หน่วยกิต"],
            [/^(?:หมวดวิชา|กลุ่มวิชา)[ก-๙]+\s*$/, ""], // group headings (would be read as wrapped names)
            [/^รายวิชาเลือก(\s+2\(\(x\)-y-z\))/, "xxx-xxx รายวิชาเลือก (หมวดวิชาศึกษาทั่วไป)$1"],
            [/^\s*142-456 การออกแบบการจัดแสดงและการจัด\s+142-451 นานาชาติศึกษา 1 (3\(\(2\)-2-5\))\s*$/,
              " 142-456 การออกแบบการจัดแสดงและการจัดนิทรรศการ (กลุ่มที่ 1)    6(0-18-0)\n 142-451 นานาชาติศึกษา 1 (กลุ่มที่ 2)    $1"],
            [/^\s*นิทรรศการ 6\(0-18-0\)\s+142-452 นานาชาติศึกษา 2 (3\(\(2\)-2-5\))\s*$/,
              " 142-452 นานาชาติศึกษา 2 (กลุ่มที่ 2)    $1\n    รวม 6 หน่วยกิต"],
          ],
        }],
      },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  // Pattani: the campus curriculum office (งานหลักสูตรและส่งเสริมการเรียนรู้) publishes every
  // program's คู่มือการศึกษา per entry year at https://curriculum.pn.psu.ac.th/curriculumn_2022/?page=course-study_guide
  // (documents/study_guide/bachelor/<entry year>/<faculty>/…). Only guides whose plan reads back to
  // the guide's own "หน่วยกิตรวมตลอดหลักสูตร" and that name their curriculum year are imported (the
  // 2569 guide, or the 2568 one for the previous curriculum). Pattani programs not listed here have no usable guide or total yet.
  ...pattaniFaculties(),

  // Trang — Commerce and Management: each program page under https://cm.trang.psu.ac.th/course/bachelor-degree
  // links its current มคอ.2 ("สำหรับนักศึกษารหัส 69 เป็นต้นไป") and the previous one ("…รวมไฟล์.pdf").
  // Curriculum years are the ones those pages state. Not imported:
  //   - ภาษาอังกฤษธุรกิจ 2569 (BE-69-trang.pdf: plan reads 121 of the stated 124) and 2564 (103 of 129);
  //   - บัญชีบัณฑิต 2568 (3-ACC-68.pdf: no year/term plan table is found);
  //   - การจัดการสารสนเทศและเทคโนโลยีดิจิทัล 2564 (2.1-IDTM-2564: 125 of 126).
  {
    id: "trang-fcm",
    faculty: "คณะพาณิชยศาสตร์และการจัดการ",
    campus: "วิทยาเขตตรัง",
    title: "คณะพาณิชยศาสตร์และการจัดการ มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตตรัง",
    source: "https://cm.trang.psu.ac.th/course/bachelor-degree",
    programs: [
      ["accounting", "บัญชีบัณฑิต", "accounting", [[2564, "2025/10/1-ACC-2564-รวมไฟล์.pdf"]]],
      ["business-information-technology", "บริหารธุรกิจ สาขาวิชาเทคโนโลยีสารสนเทศทางธุรกิจ", "business-information-technology",
        [[2568, "2024/10/1.-หลักสูตร-BIT-2568.pdf"]]],
      ["digital-business", "บริหารธุรกิจ สาขาวิชาธุรกิจดิจิทัล", "business-information-technology",
        [[2564, "2025/11/2.2-DBiz-2564-รวมไฟล์-1.pdf"]]],
      // 2564: "การเงิน ประกันภัยและการจัดการความเสี่ยง", the same program before its 2569 revision
      ["insurance-risk", "บริหารธุรกิจ สาขาวิชาการบริหารธุรกิจประกันภัยและการจัดการความเสี่ยง", "ibarm",
        [[2569, "2025/07/IBARM-69-trang.pdf"], [2564, "2025/11/5-FIRM-2564-รวมไฟล์.pdf"]]],
      ["marketing", "บริหารธุรกิจ สาขาวิชาการตลาด", "marketing",
        [[2569, "2025/07/MKT-69-trang.docx.pdf"], [2564, "2025/11/4-MKT-2564-รวมไฟล์-เว็บ.pdf"]]],
      ["public-management", "รัฐประศาสนศาสตร์ สาขาวิชาการจัดการรัฐกิจ", "public-management",
        [[2568, "2025/06/4.-PA-68.pdf"], [2563, "2025/11/8-PA-2563-รวมไฟล์.pdf"]]],
      // 2564: "การจัดการการท่องเที่ยว", the same program before its 2569 revision
      ["tourism-hotel", "บริหารธุรกิจ สาขาวิชาการจัดการการท่องเที่ยวและการโรงแรม", "thm",
        [[2569, "2025/11/หลักสูตร-TRM-2569.pdf"], [2564, "2025/11/3-TRM-2564-รวมไฟล์-เว็บ.pdf"]]],
    ].map(([id, name, page, eds]) => ({
      id, name, division: "คณะพาณิชยศาสตร์และการจัดการ",
      editions: eds.map(([curriculumYear, file]) => ({
        curriculumYear,
        pdf: `https://cm.trang.psu.ac.th/wp-content/uploads/${file}`,
        page: `https://cm.trang.psu.ac.th/course/bachelor-degree/${page}`,
      })),
    })),
  },

  // Trang — Architecture: "หลักสูตรสถาปัตยกรรมศาสตรบัณฑิต หลักสูตรปรับปรุง พ.ศ. 2565" (5 years, 169 หน่วยกิต)
  // linked from the faculty's ปริญญาตรี page. Not imported: plan_arch_61.pdf (2561 — reads 121 of 171).
  {
    id: "trang-arch",
    faculty: "คณะสถาปัตยกรรมศาสตร์",
    campus: "วิทยาเขตตรัง",
    title: "คณะสถาปัตยกรรมศาสตร์ มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตตรัง",
    source: "https://arch.trang.psu.ac.th/หลักสูตร/ปริญญาตรี/",
    programs: [
      {
        // the SIS department of most of the program's 997- codes (the rest: "คณะสถาปัตยกรรมศาสตร์")
        id: "architecture", name: "สถาปัตยกรรม", division: "โครงการจัดตั้งคณะสถาปัตยกรรมศาสตร์",
        editions: [{ curriculumYear: 2565, pdf: "https://arch.trang.psu.ac.th/wp-content/uploads/2023/10/1.-หลักสูตร-ARCH-2565-ใส่เว็บ_คณะ.docx.pdf" }],
      },
    ],
  },

  // Surat Thani — Art and Management Sciences (LAMS): each program's plan is a PDF linked from
  // https://lams.surat.psu.ac.th/. Accounting's years 3–4 print one table per co-op / internship track; it is
  // split with `tracks` (curriculum-tracks.mjs). English and Chinese business communication print their co-op /
  // internship years as separate tables: lineFixes name each one so the parser splits them by track.
  {
    id: "lams",
    faculty: "คณะศิลปศาสตร์และวิทยาการจัดการ",
    campus: "วิทยาเขตสุราษฎร์ธานี",
    title: "คณะศิลปศาสตร์และวิทยาการจัดการ มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตสุราษฎร์ธานี",
    source: "https://lams.surat.psu.ac.th/",
    programs: [
      { id: "business-management", name: "บริหารธุรกิจ สาขาวิชาการจัดการธุรกิจ", division: "คณะศิลปศาสตร์และวิทยาการจัดการ", editions: [{ curriculumYear: 2564, pdf: "https://lams.surat.psu.ac.th/UserFiles/file/lams64-2.pdf" }] },
      { id: "tourism-business-management", name: "บริหารธุรกิจ สาขาวิชาการจัดการธุรกิจการท่องเที่ยว", division: "คณะศิลปศาสตร์และวิทยาการจัดการ", editions: [{ curriculumYear: 2567, pdf: "https://lams.surat.psu.ac.th/UserFiles/file/%E0%B9%80%E0%B8%A5%E0%B9%88%E0%B8%A1%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%AA%E0%B8%B9%E0%B8%95%E0%B8%A3/67/%E0%B8%84%E0%B8%B9%E0%B9%88%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%AA%E0%B8%B9%E0%B8%95%E0%B8%A3%20TBM%2067_compressed.pdf" }] },
      { id: "public-administration", name: "รัฐประศาสนศาสตร์ สาขาวิชาการจัดการรัฐกิจ", division: "คณะศิลปศาสตร์และวิทยาการจัดการ", editions: [{ curriculumYear: 2567, pdf: "https://lams.surat.psu.ac.th/UserFiles/file/%E0%B9%80%E0%B8%A5%E0%B9%88%E0%B8%A1%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%AA%E0%B8%B9%E0%B8%95%E0%B8%A3/67/%E0%B8%84%E0%B8%B9%E0%B9%88%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%AA%E0%B8%B9%E0%B8%95%E0%B8%A3%20PA%2067_compressed.pdf" }] },
      { id: "accounting", name: "บัญชีบัณฑิต", division: "คณะศิลปศาสตร์และวิทยาการจัดการ", editions: [{ curriculumYear: 2566, pdf: "https://lams.surat.psu.ac.th/UserFiles/file/%E0%B9%80%E0%B8%A5%E0%B9%88%E0%B8%A1%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%AA%E0%B8%B9%E0%B8%95%E0%B8%A3/66/%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%AA%E0%B8%B9%E0%B8%95%E0%B8%A3%E0%B8%9A%E0%B8%B1%E0%B8%8D%E0%B8%8A%E0%B8%B5%E0%B8%9A%E0%B8%B1%E0%B8%93%E0%B8%91%E0%B8%B4%E0%B8%95.pdf",
        // years 3–4 print one table per track; the parser reads them as plain terms (see curriculum-tracks.mjs)
        tracks: {
          "สหกิจศึกษา": { "3/2": "3/2", "4/2": "4/2" },
          "ฝึกงาน": { "3/3": "3/2", "4/3": "4/2" },
        } }] },
      { id: "english-business-communication", name: "ภาษาอังกฤษเพื่อการสื่อสารทางธุรกิจ", division: "คณะศิลปศาสตร์และวิทยาการจัดการ", editions: [{ curriculumYear: 2567, pdf: "https://lams.surat.psu.ac.th/UserFiles/file/%E0%B9%80%E0%B8%A5%E0%B9%88%E0%B8%A1%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%AA%E0%B8%B9%E0%B8%95%E0%B8%A3/67/%E0%B8%84%E0%B8%B9%E0%B9%88%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%AA%E0%B8%B9%E0%B8%95%E0%B8%A3%20EBC%2067_compressed.pdf",
        // years 3–4 print one table per track (ฝึกงาน / สหกิจศึกษา); the track headings are split onto their own lines
        lineFixes: [[/^(แผนฝึ กงาน|แผนสหกิจศึกษา)\s{2,}(?=ชั้นปี)/, "$1\n"]] }] },
      { id: "chinese-business-communication", name: "ภาษาจีนเพื่อการสื่อสารทางธุรกิจ", division: "คณะศิลปศาสตร์และวิทยาการจัดการ", editions: [{ curriculumYear: 2568, pdf: "https://lams.surat.psu.ac.th/UserFiles/file/%E0%B9%80%E0%B8%A5%E0%B9%88%E0%B8%A1%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%AA%E0%B8%B9%E0%B8%95%E0%B8%A3/2568/%E0%B9%80%E0%B8%A5%E0%B9%88%E0%B8%A1%20%20CBC%20%2068.pdf",
        // the China year (ปี ที่ 3) is printed under each track; one heading form lets both tracks take it
        lineFixes: [[/(?:ชั้นปี|ปี) ที่ 3 \(ณ สาธารณรัฐประชาชนจีน\s*\)/, "ชั้นปี ที่ 3"]] }] },
    ],
  },

  // Surat Thani — Natural Innovation for Agriculture, Fisheries and Food (IAF): not imported. Its plans are
  // PDFs on edumanual.psu.ac.th (https://edumanual.psu.ac.th/sni/sni_iaf/, file_pdf/2567_SNI_iaf_2777.pdf),
  // which returned 502 Bad Gateway in every attempt. iaf.surat.psu.ac.th links no plan files directly.

  // Surat Thani — Science and Industrial Technology: each major's page https://scit.surat.psu.ac.th/p_major?id=N
  // links its part of the faculty's คู่มือการศึกษาประจำปีการศึกษา 2569, whose program list gives the
  // curricula (2569 revisions, การจัดการงานวิศวกรรม 2565, การจัดการนวัตกรรมการค้าสมัยใหม่ 2568).
  // Not imported: เคมีเพื่ออุตสาหกรรม (id=4: plan reads 126 of the stated 132); เทคโนโลยีการจัดการ
  // สิ่งแวดล้อม (id=8) and อาชีวอนามัยและความปลอดภัย (id=9): their co-op plans read 131 / 142 against
  // 134 / 139 — the year-3 summer practical of the other plan is printed as shared.
  // คณะศิลปศาสตร์และวิทยาการจัดการ and คณะนวัตกรรมการเกษตร ประมง และอาหาร: not attempted yet.
  {
    id: "surat-scit",
    faculty: "คณะวิทยาศาสตร์และเทคโนโลยีอุตสาหกรรม",
    campus: "วิทยาเขตสุราษฎร์ธานี",
    title: "คณะวิทยาศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตสุราษฎร์ธานี",
    source: "https://scit.surat.psu.ac.th/p_majorall?id=1",
    programs: [
      ["information-technology", "เทคโนโลยีสารสนเทศ", 1, 2569, "MAJOR_FILE_MN_6a320b892a652.pdf"],
      ["rubber-industry-management", "การจัดการอุตสาหกรรมยาง", 7, 2569, "MAJOR_FILE_MN_6a320bcfcedc2.pdf"],
      ["wood-product-technology", "เทคโนโลยีและการพัฒนาผลิตภัณฑ์ไม้", 15, 2569, "MAJOR_FILE_MN_6a320b338dea5.pdf"],
      ["engineering-management", "วิศวกรรมศาสตร์ สาขาวิชาการจัดการงานวิศวกรรม", 10, 2565, "MAJOR_FILE_MN_6a320c1fe7d50.pdf"],
      ["modern-trade-innovation", "เทคโนโลยีบัณฑิต สาขาวิชาการจัดการนวัตกรรมการค้าสมัยใหม่", 13, 2568, "MAJOR_FILE_MN_6a320b53b9ece.pdf"],
    ].map(([id, name, n, curriculumYear, file]) => ({
      id, name, division: "คณะวิทยาศาสตร์และเทคโนโลยีอุตสาหกรรม",
      editions: [{ curriculumYear, pdf: `https://scit.surat.psu.ac.th/source/images/upload/${file}`, page: `https://scit.surat.psu.ac.th/p_major?id=${n}` }],
    })),
  },
];

function pattaniFaculties() {
  const guide = (path) => `https://curriculum.pn.psu.ac.th/curriculumn_2022/documents/study_guide/bachelor/${path}`;
  const page = "https://curriculum.pn.psu.ac.th/curriculumn_2022/?page=course-study_guide";
  const faculty = (id, name, programs) => ({
    id,
    faculty: name,
    campus: "วิทยาเขตปัตตานี",
    title: `${name} มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตปัตตานี`,
    source: page,
    programs: programs.map(([pid, pname, division, eds, extra = {}]) => ({
      id: pid, name: pname, division,
      editions: eds.map(([curriculumYear, path]) => ({ curriculumYear, pdf: guide(path), page, ...extra })),
    })),
  });
  return [
    faculty("pn-scitech", "คณะวิทยาศาสตร์และเทคโนโลยี", [
      ["food-science-nutrition", "วิทยาศาสตร์การอาหารและโภชนาการ", "ภาควิชาวิทยาศาสตร์การอาหารและโภชนาการ",
        [[2567, "2569/Science/69_FoodSci&Nutrtion.pdf"]]],
      ["physics", "ฟิสิกส์", "ภาควิชาวิทยาศาสตร์", [[2565, "2569/Science/69_Physics.pdf"]], {
        // a stray "แผนสหกิจศึกษา" line right under "ปี ที่ 4 แผนฝึกประสบการณ์"
        lineFixes: [[/^แผนสหกิจศึกษา\s*$/, ""]],
        renamePlans: { "ฝึ กประสบการณ์": "ฝึกประสบการณ์" },
      }],
    ]),
    faculty("pn-huso", "คณะมนุษยศาสตร์และสังคมศาสตร์", [
      ["geography", "ภูมิศาสตร์", "ภาควิชาภูมิศาสตร์", [[2569, "2569/Human&Social/69_Geography.pdf"]]],
      ["information-science", "สารสนเทศศาสตร์", "ภาควิชาบรรณารักษศาสตร์และสารนิเทศศาสตร์", [[2569, "2569/Human&Social/69_Info.pdf"]]],
      ["entrepreneurial-economics", "เศรษฐศาสตร์การประกอบการ", "คณะมนุษยศาสตร์และสังคมศาสตร์", [[2569, "2569/Human&Social/69_EntrepreneurialEco.pdf"]]],
    ]),
    faculty("pn-cis", "คณะวิทยาการอิสลาม", [
      ["islamic-business-innovation", "บริหารธุรกิจ สาขาวิชานวัตกรรมธุรกิจอิสลาม", "วิทยาลัยอิสลามศึกษา",
        [[2569, "2569/Islamic/69_IslamicBusinessInno.pdf"]]],
      ["teaching-islamic-studies", "การสอนอิสลามศึกษา", "คณะวิทยาการอิสลาม", [[2567, "2569/Islamic/69_TeachingIslamicStudies.pdf"]]],
    ]),
  ];
}
