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
];
