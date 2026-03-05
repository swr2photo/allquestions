import fs from "fs";
import path from "path";
import type { CustomQuiz, CustomQuizData, Quiz } from "@/types";

const CUSTOM_QUIZ_FILE = path.join(process.cwd(), "data", "custom-quizzes.json");

function ensureDataDir() {
  const dir = path.dirname(CUSTOM_QUIZ_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDefaultData(): CustomQuizData {
  return { quizzes: [] };
}

export function loadCustomQuizzes(): CustomQuizData {
  ensureDataDir();
  try {
    if (fs.existsSync(CUSTOM_QUIZ_FILE)) {
      const raw = fs.readFileSync(CUSTOM_QUIZ_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // If file is corrupted, recreate
  }
  const defaultData = getDefaultData();
  saveCustomQuizzes(defaultData);
  return defaultData;
}

export function saveCustomQuizzes(data: CustomQuizData): void {
  ensureDataDir();
  fs.writeFileSync(CUSTOM_QUIZ_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Get all custom quizzes for a specific course
export function getCustomQuizzesForCourse(courseId: string): CustomQuiz[] {
  const data = loadCustomQuizzes();
  return data.quizzes.filter((q) => q.courseId === courseId);
}

// Get a specific custom quiz
export function getCustomQuiz(quizId: string): CustomQuiz | undefined {
  const data = loadCustomQuizzes();
  return data.quizzes.find((q) => q.id === quizId);
}

// Create a new custom quiz
export function createCustomQuiz(
  quiz: Omit<CustomQuiz, "id" | "createdAt" | "updatedAt">
): CustomQuiz {
  const data = loadCustomQuizzes();
  const now = new Date().toISOString();

  const newQuiz: CustomQuiz = {
    ...quiz,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };

  data.quizzes.push(newQuiz);
  saveCustomQuizzes(data);
  return newQuiz;
}

// Update an existing custom quiz
export function updateCustomQuiz(
  quizId: string,
  updates: Partial<Omit<CustomQuiz, "id" | "createdAt">>
): CustomQuiz | null {
  const data = loadCustomQuizzes();
  const index = data.quizzes.findIndex((q) => q.id === quizId);
  if (index === -1) return null;

  data.quizzes[index] = {
    ...data.quizzes[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveCustomQuizzes(data);
  return data.quizzes[index];
}

// Delete a custom quiz
export function deleteCustomQuiz(quizId: string): boolean {
  const data = loadCustomQuizzes();
  const index = data.quizzes.findIndex((q) => q.id === quizId);
  if (index === -1) return false;

  data.quizzes.splice(index, 1);
  saveCustomQuizzes(data);
  return true;
}

// Convert CustomQuiz to Quiz format for rendering
export function customQuizToQuiz(cq: CustomQuiz): Quiz {
  return {
    id: cq.id,
    title: cq.title,
    type: cq.type,
    description: cq.description,
    questions: cq.questions,
    pdfInfo: cq.pdfInfo,
    isCustom: true,
  };
}

// Get all custom quizzes as Quiz[] for a course
export function getCustomQuizzesAsQuiz(courseId: string): Quiz[] {
  return getCustomQuizzesForCourse(courseId).map(customQuizToQuiz);
}
