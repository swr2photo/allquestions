// Types for quiz system
export interface Choice {
  text: string;
  isCorrect: boolean;
  imageUrl?: string; // optional image for the choice
}

export interface Question {
  id: number;
  text: string;
  imageUrl?: string; // optional image for the question
  choices: Choice[];
}

export interface PdfInfo {
  driveFileId: string;
  driveUrl: string;
}

export interface Quiz {
  id: string;
  title: string;
  type: "quiz" | "pdf";
  description?: string;
  deadline?: string;
  questions: Question[];
  pdfInfo?: PdfInfo;
  isCustom?: boolean; // flag for admin-created quizzes
}

export interface Course {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  quizzes: Quiz[];
}

// Admin types
export interface CourseSettings {
  isActive: boolean;
  scheduleStart: string | null; // ISO date string
  scheduleEnd: string | null;   // ISO date string
  order: number;
}

export interface AdminData {
  courseSettings: Record<string, CourseSettings>;
  adminPasswordHash?: string; // legacy, no longer used
  adminEmails?: string[]; // Google emails allowed as admin
}

// Custom quiz types (admin-created)
export interface CustomQuiz {
  id: string;
  courseId: string;
  title: string;
  type: "quiz" | "pdf";
  description?: string;
  questions: Question[];
  pdfInfo?: PdfInfo;
  createdAt: string;
  updatedAt: string;
}

export interface CustomQuizData {
  quizzes: CustomQuiz[];
}

// Custom course types (admin-created courses)
export interface CustomCourse {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  quizzes: Quiz[];
  createdAt: string;
  updatedAt: string;
}

// Override for static course metadata
export interface CourseOverride {
  courseId: string;
  title?: string;
  description?: string;
  icon?: string;
  color?: string;
}

// Override for static quiz content
export interface QuizOverride {
  courseId: string;
  quizId: string;
  title?: string;
  description?: string;
  questions?: Question[];
}

// Data file structure
export interface CustomCourseData {
  courses: CustomCourse[];
  courseOverrides: CourseOverride[];
  quizOverrides: QuizOverride[];
}

// Sheet row from Google Sheets
export interface SheetRow {
  course: string;
  quizTitle: string;
  link: string;
  description: string;
  deadline: string;
  status: string;
}
