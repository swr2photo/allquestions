/* eslint-disable @typescript-eslint/no-require-imports */
// Build script: generates src/data/courses.ts from extracted questions
const fs = require('fs');
const path = require('path');

const extracted = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src/data/extracted-questions.json'), 'utf8')
);

// Course mapping: folder name -> course metadata
const courseMap = {
  'พลเมืองที่ดี': {
    id: 'good-citizen',
    title: 'พลเมืองที่ดี',
    description: 'เรียนรู้เกี่ยวกับสิทธิ เสรีภาพ ความเสมอภาค และหน้าที่พลเมืองในระบอบประชาธิปไตย',
    icon: '⚖️',
    color: 'from-blue-500 to-indigo-600',
  },
  'SAVE EARTH  SAVE US': {
    id: 'save-earth',
    title: 'รักษ์โลก รักษ์เรา SAVE EARTH, SAVE US.',
    description: 'เรียนรู้เกี่ยวกับสิ่งแวดล้อม เมืองสีเขียว และการรับมือภัยพิบัติ',
    icon: '🌍',
    color: 'from-emerald-500 to-teal-600',
  },
  'ธรรมชาติบำบัด': {
    id: 'natural-therapy',
    title: 'ธรรมชาติบำบัด',
    description: 'เรียนรู้เกี่ยวกับการบำบัดด้วยธรรมชาติ สมุนไพร อโรมาเธอราพี และศาสตร์แพทย์ทางเลือก',
    icon: '🌿',
    color: 'from-green-500 to-lime-600',
  },
  'Digital Technology Literacy': {
    id: 'digital-technology',
    title: 'Digital Technology Literacy',
    description: 'เรียนรู้เกี่ยวกับฮาร์ดแวร์ ซอฟต์แวร์ อินเทอร์เน็ต และการวิเคราะห์ข้อมูล',
    icon: '💻',
    color: 'from-purple-500 to-violet-600',
  },
  'EVERYDAY ENGLISH': {
    id: 'everyday-english',
    title: 'EVERYDAY ENGLISH',
    description: 'ฝึกทักษะภาษาอังกฤษในชีวิตประจำวัน ทั้ง Grammar, Vocabulary และ Expressions',
    icon: '📚',
    color: 'from-orange-500 to-amber-600',
  },
};

// Quiz title mapping: filename -> quiz metadata
const quizTitleMap = {
  // พลเมืองที่ดี
  'question01.html': { id: 'unit-1', title: 'ข้อสอบย่อย หน่วยที่ 1' },
  'ข้อสอบหน่วยที่ 2.html': { id: 'unit-2', title: 'ข้อสอบหน่วยที่ 2 (40 ข้อ 20 คะแนน)' },
  'ข้อสอบหน่วยที่ 3.html': { id: 'unit-3', title: 'ข้อสอบหน่วยที่ 3 (40 ข้อ 15 คะแนน)' },
  'ข้อสอบหน่วยที่ 4.html': { id: 'unit-4', title: 'ข้อสอบหน่วยที่ 4 (40 ข้อ 20 คะแนน)' },
  'ข้อสอบหน่วยที่5.html': { id: 'unit-5', title: 'ข้อสอบหน่วยที่ 5 (20 ข้อ 10 คะแนน)' },
  // SAVE EARTH
  'Week 6 Green City.html': { id: 'week-6', title: 'แนวคิดการจัดการเมือง การมุ่งสู่ Green City' },
  'Week 7 ปัญหาหมอกควันภาคใต้.html': { id: 'week-7', title: 'ปัญหาหมอกควันภาคใต้' },
  'Week 8 Green Thinking.html': { id: 'week-8', title: 'Green Thinking' },
  'Week 9 เรียนรู้การเกิดและวิธีการรับมือกับภัยพิบัติต่างๆ.html': { id: 'week-9', title: 'เรียนรู้การเกิดและวิธีการรับมือกับภัยพิบัติต่างๆ' },
  'ผลิตภัณฑ์พอลิเมอร์ในชีวิตประจำวัน.html': { id: 'polymer', title: 'ผลิตภัณฑ์พอลิเมอร์ในชีวิตประจำวัน' },
  // ธรรมชาติบำบัด
  'Aromatherapy.html': { id: 'aromatherapy', title: 'Aromatherapy' },
  'Spa and Hydrotherapy.html': { id: 'spa-hydrotherapy', title: 'Spa and Hydrotherapy' },
  'กัวซา.html': { id: 'guasha', title: 'การกัวซาบำบัดโรค' },
  'การนวดตนเองและการนวดตนเองด้วยอุปกรณ์.html': { id: 'self-massage', title: 'การนวดตนเองและการนวดตนเองด้วยอุปกรณ์' },
  'ข้อสอบกลางภาคธรรมชาติบำบัด.html': { id: 'midterm', title: 'ข้อสอบกลางภาคธรรมชาติบำบัด' },
  'ข้อสอบปลายภาคธรรมชาติบำบัด.html': { id: 'final', title: 'ข้อสอบปลายภาคธรรมชาติบำบัด' },
  'ดังสิ.html': { id: 'dungsi', title: 'ฤาษีดัดตน (ดังสิ)' },
  'ผักพื้นบ้าน.html': { id: 'local-vegetables', title: 'ผักพื้นบ้าน (EP.1 and EP.2)' },
  'ฤาษีดัดตน.html': { id: 'rusidudton', title: 'ฤาษีดัดตน' },
  'สมาธิบำบัด.html': { id: 'meditation', title: 'สมาธิบำบัด' },
  'สีบำบัด.html': { id: 'color-therapy', title: 'สีบำบัด' },
  'หัวข้อการประคบสมุนไพร.html': { id: 'herbal-compress', title: 'การประคบสมุนไพร' },
  'หัวข้อการแพทย์อินเดีย.html': { id: 'indian-medicine', title: 'การแพทย์อินเดีย' },
  'หัวข้อความหมายและแนวคิดธรรมชาติบำบัด(ครั้งที่1-2).html': { id: 'naturopathy-concept', title: 'ความหมายและแนวคิดธรรมชาติบำบัด (ครั้งที่ 1-2)' },
  'หัวข้อสมุนไพรในงานสาธารณสุขมูลฐาน Ep2 (ครั้งที่ 3).html': { id: 'herbal-ep2', title: 'สมุนไพรในงานสาธารณสุขมูลฐาน Ep.2 (ครั้งที่ 3)' },
  'หัวข้อสมุนไพรในงานสาธารณสุขมูลฐาน Ep3 (ครั้งที่ 4).html': { id: 'herbal-ep3', title: 'สมุนไพรในงานสาธารณสุขมูลฐาน Ep.3 (ครั้งที่ 4)' },
  'หัวข้อสมุนไพรในงานสาธารณสุขมูลฐาน Ep4 (ครั้งที่ 5).html': { id: 'herbal-ep4', title: 'สมุนไพรในงานสาธารณสุขมูลฐาน Ep.4 (ครั้งที่ 5)' },
  'อาหารสุขภาพ.html': { id: 'healthy-food', title: 'อาหารสุขภาพ' },
  // Digital Technology
  'Data Analysis.html': { id: 'data-analysis', title: 'Data Analysis' },
  'HardwareQuiz.html': { id: 'hardware', title: 'Hardware Quiz' },
  'QuizInternet.html': { id: 'internet', title: 'Quiz Internet' },
  'SoftwareQuiz.html': { id: 'software', title: 'Software Quiz' },
  // EVERYDAY ENGLISH
  '(Unit 1) Part 1_Grammar.html': { id: 'u1-grammar', title: '(Unit 1) Part 1: Grammar' },
  '(Unit 1) Part 2_ Vocabulary.html': { id: 'u1-vocab', title: '(Unit 1) Part 2: Vocabulary' },
  '(Unit 1) Part 3_Expressions.html': { id: 'u1-expressions', title: '(Unit 1) Part 3: Expressions' },
  '(Unit 1) Part 4_Writing.html': { id: 'u1-writing', title: '(Unit 1) Part 4: Writing' },
  '(Unit 1) Part 5_Listening.html': { id: 'u1-listening', title: '(Unit 1) Part 5: Listening' },
};

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
}

// Build courses array
const courses = [];

for (const [folderName, meta] of Object.entries(courseMap)) {
  const folderData = extracted[folderName];
  if (!folderData) continue;

  const course = { ...meta, quizzes: [] };

  for (const quiz of folderData.quizzes) {
    const mapping = quizTitleMap[quiz.filename];
    const quizId = mapping?.id || slugify(quiz.filename.replace('.html', ''));
    const quizTitle = mapping?.title || quiz.filename.replace('.html', '');

    if (quiz.type === 'pdf') {
      course.quizzes.push({
        id: quizId,
        title: quizTitle,
        type: 'pdf',
        questions: [],
        pdfInfo: {
          driveFileId: quiz.pdfInfo?.driveFileId || '',
          driveUrl: quiz.pdfInfo?.driveUrl || '',
        },
      });
    } else if (quiz.type === 'quiz') {
      course.quizzes.push({
        id: quizId,
        title: quizTitle,
        type: 'quiz',
        questions: quiz.questions.map((q, idx) => ({
          id: q.id || idx + 1,
          text: q.text,
          choices: q.choices.map(c => ({
            text: c.text,
            isCorrect: !!c.isCorrect,
          })),
        })),
      });
    }
  }

  courses.push(course);
}

// Generate TypeScript
let ts = `import type { Course, Quiz, Question, Choice } from "@/types";

// Auto-generated from HTML quiz files
// Total courses: ${courses.length}
// Total quizzes: ${courses.reduce((s, c) => s + c.quizzes.length, 0)}
// Total questions: ${courses.reduce((s, c) => s + c.quizzes.reduce((s2, q) => s2 + q.questions.length, 0), 0)}

export const courses: Course[] = ${JSON.stringify(courses, null, 2)};

// Helper functions
export function getCourse(courseId: string): Course | undefined {
  return courses.find((c) => c.id === courseId);
}

export function getQuiz(courseId: string, quizId: string): Quiz | undefined {
  const course = getCourse(courseId);
  return course?.quizzes.find((q) => q.id === quizId);
}

export function getTotalQuestions(): number {
  return courses.reduce(
    (total, course) =>
      total +
      course.quizzes.reduce((qTotal, quiz) => qTotal + quiz.questions.length, 0),
    0
  );
}

export function getTotalQuizzes(): number {
  return courses.reduce((total, course) => total + course.quizzes.length, 0);
}

export function getTotalPdfQuizzes(): number {
  return courses.reduce(
    (total, course) =>
      total + course.quizzes.filter((q) => q.type === "pdf").length,
    0
  );
}
`;

fs.writeFileSync(path.join(__dirname, 'src/data/courses.ts'), ts, 'utf8');

// Summary
console.log('Generated courses.ts:');
courses.forEach(c => {
  const quizCount = c.quizzes.length;
  const pdfCount = c.quizzes.filter(q => q.type === 'pdf').length;
  const questionCount = c.quizzes.reduce((s, q) => s + q.questions.length, 0);
  console.log(`  ${c.title}: ${quizCount} quizzes (${pdfCount} PDF), ${questionCount} questions`);
});
const total = courses.reduce((s, c) => s + c.quizzes.reduce((s2, q) => s2 + q.questions.length, 0), 0);
console.log(`Total: ${total} questions`);
