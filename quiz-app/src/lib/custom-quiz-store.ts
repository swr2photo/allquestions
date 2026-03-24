import { kv } from "@/lib/kv";
import type { CustomQuiz, CustomQuizData, Quiz } from "@/types";

function getDefaultData(): CustomQuizData {
  return { quizzes: [] };
}

export async function loadCustomQuizzes(): Promise<CustomQuizData> {
  try {
    const data = await kv.get<CustomQuizData>("custom-quizzes");
    if (data) return data;
  } catch {
    // If kv fails or empty
  }
  const defaultData = getDefaultData();
  await saveCustomQuizzes(defaultData);
  return defaultData;
}

export async function saveCustomQuizzes(data: CustomQuizData): Promise<void> {
  await kv.set("custom-quizzes", data);
}

// Get all custom quizzes for a specific course
export async function getCustomQuizzesForCourse(courseId: string): Promise<CustomQuiz[]> {
  const data = await loadCustomQuizzes();
  return data.quizzes.filter((q) => q.courseId === courseId);
}

// Get a specific custom quiz
export async function getCustomQuiz(quizId: string): Promise<CustomQuiz | undefined> {
  const data = await loadCustomQuizzes();
  return data.quizzes.find((q) => q.id === quizId);
}

// Create a new custom quiz
export async function createCustomQuiz(
  quiz: Omit<CustomQuiz, "id" | "createdAt" | "updatedAt">
): Promise<CustomQuiz> {
  const data = await loadCustomQuizzes();
  const now = new Date().toISOString();

  const newQuiz: CustomQuiz = {
    ...quiz,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };

  data.quizzes.push(newQuiz);
  await saveCustomQuizzes(data);
  return newQuiz;
}

// Update an existing custom quiz
export async function updateCustomQuiz(
  quizId: string,
  updates: Partial<Omit<CustomQuiz, "id" | "createdAt">>
): Promise<CustomQuiz | null> {
  const data = await loadCustomQuizzes();
  const index = data.quizzes.findIndex((q) => q.id === quizId);
  if (index === -1) return null;

  data.quizzes[index] = {
    ...data.quizzes[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveCustomQuizzes(data);
  return data.quizzes[index];
}

// Delete a custom quiz
export async function deleteCustomQuiz(quizId: string): Promise<boolean> {
  const data = await loadCustomQuizzes();
  const index = data.quizzes.findIndex((q) => q.id === quizId);
  if (index === -1) return false;

  data.quizzes.splice(index, 1);
  await saveCustomQuizzes(data);
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
export async function getCustomQuizzesAsQuiz(courseId: string): Promise<Quiz[]> {
  const quizzes = await getCustomQuizzesForCourse(courseId);
  return quizzes.map(customQuizToQuiz);
}

