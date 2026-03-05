import fs from "fs";
import path from "path";
import type {
  CustomCourse,
  CustomCourseData,
  CourseOverride,
  QuizOverride,
  Quiz,
  Question,
} from "@/types";

const DATA_FILE = path.join(process.cwd(), "data", "custom-courses.json");

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDefaultData(): CustomCourseData {
  return {
    courses: [],
    courseOverrides: [],
    quizOverrides: [],
  };
}

export function loadCustomCourseData(): CustomCourseData {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data: CustomCourseData = JSON.parse(raw);
      // Ensure all fields exist
      if (!data.courses) data.courses = [];
      if (!data.courseOverrides) data.courseOverrides = [];
      if (!data.quizOverrides) data.quizOverrides = [];
      return data;
    }
  } catch {
    // corrupted, recreate
  }
  const defaultData = getDefaultData();
  saveCustomCourseData(defaultData);
  return defaultData;
}

export function saveCustomCourseData(data: CustomCourseData): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ============ Custom Course CRUD ============

export function getAllCustomCourses(): CustomCourse[] {
  return loadCustomCourseData().courses;
}

export function getCustomCourse(courseId: string): CustomCourse | undefined {
  return loadCustomCourseData().courses.find((c) => c.id === courseId);
}

export function createCustomCourse(
  course: Omit<CustomCourse, "id" | "createdAt" | "updatedAt">
): CustomCourse {
  const data = loadCustomCourseData();
  const now = new Date().toISOString();

  const newCourse: CustomCourse = {
    ...course,
    id: `custom-course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };

  data.courses.push(newCourse);
  saveCustomCourseData(data);
  return newCourse;
}

export function updateCustomCourse(
  courseId: string,
  updates: Partial<Omit<CustomCourse, "id" | "createdAt">>
): CustomCourse | null {
  const data = loadCustomCourseData();
  const index = data.courses.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  data.courses[index] = {
    ...data.courses[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveCustomCourseData(data);
  return data.courses[index];
}

export function deleteCustomCourse(courseId: string): boolean {
  const data = loadCustomCourseData();
  const index = data.courses.findIndex((c) => c.id === courseId);
  if (index === -1) return false;

  data.courses.splice(index, 1);
  saveCustomCourseData(data);
  return true;
}

// Add quiz to custom course
export function addQuizToCustomCourse(courseId: string, quiz: Quiz): CustomCourse | null {
  const data = loadCustomCourseData();
  const index = data.courses.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const quizWithId: Quiz = {
    ...quiz,
    id: quiz.id || `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  data.courses[index].quizzes.push(quizWithId);
  data.courses[index].updatedAt = new Date().toISOString();
  saveCustomCourseData(data);
  return data.courses[index];
}

// Update quiz in custom course
export function updateQuizInCustomCourse(
  courseId: string,
  quizId: string,
  updates: Partial<Quiz>
): Quiz | null {
  const data = loadCustomCourseData();
  const courseIndex = data.courses.findIndex((c) => c.id === courseId);
  if (courseIndex === -1) return null;

  const quizIndex = data.courses[courseIndex].quizzes.findIndex((q) => q.id === quizId);
  if (quizIndex === -1) return null;

  data.courses[courseIndex].quizzes[quizIndex] = {
    ...data.courses[courseIndex].quizzes[quizIndex],
    ...updates,
  };
  data.courses[courseIndex].updatedAt = new Date().toISOString();
  saveCustomCourseData(data);
  return data.courses[courseIndex].quizzes[quizIndex];
}

// Delete quiz from custom course
export function deleteQuizFromCustomCourse(courseId: string, quizId: string): boolean {
  const data = loadCustomCourseData();
  const courseIndex = data.courses.findIndex((c) => c.id === courseId);
  if (courseIndex === -1) return false;

  const quizIndex = data.courses[courseIndex].quizzes.findIndex((q) => q.id === quizId);
  if (quizIndex === -1) return false;

  data.courses[courseIndex].quizzes.splice(quizIndex, 1);
  data.courses[courseIndex].updatedAt = new Date().toISOString();
  saveCustomCourseData(data);
  return true;
}

// ============ Course Override (edit static course metadata) ============

export function getCourseOverride(courseId: string): CourseOverride | undefined {
  const data = loadCustomCourseData();
  return data.courseOverrides.find((o) => o.courseId === courseId);
}

export function setCourseOverride(courseId: string, override: Omit<CourseOverride, "courseId">): CourseOverride {
  const data = loadCustomCourseData();
  const index = data.courseOverrides.findIndex((o) => o.courseId === courseId);

  const fullOverride: CourseOverride = { courseId, ...override };

  if (index === -1) {
    data.courseOverrides.push(fullOverride);
  } else {
    data.courseOverrides[index] = fullOverride;
  }

  saveCustomCourseData(data);
  return fullOverride;
}

export function removeCourseOverride(courseId: string): boolean {
  const data = loadCustomCourseData();
  const index = data.courseOverrides.findIndex((o) => o.courseId === courseId);
  if (index === -1) return false;

  data.courseOverrides.splice(index, 1);
  saveCustomCourseData(data);
  return true;
}

// ============ Quiz Override (edit static quiz content) ============

export function getQuizOverride(courseId: string, quizId: string): QuizOverride | undefined {
  const data = loadCustomCourseData();
  return data.quizOverrides.find((o) => o.courseId === courseId && o.quizId === quizId);
}

export function setQuizOverride(
  courseId: string,
  quizId: string,
  override: Partial<Omit<QuizOverride, "courseId" | "quizId">>
): QuizOverride {
  const data = loadCustomCourseData();
  const index = data.quizOverrides.findIndex(
    (o) => o.courseId === courseId && o.quizId === quizId
  );

  const fullOverride: QuizOverride = {
    courseId,
    quizId,
    ...override,
  };

  if (index === -1) {
    data.quizOverrides.push(fullOverride);
  } else {
    // Merge existing with new
    data.quizOverrides[index] = {
      ...data.quizOverrides[index],
      ...fullOverride,
    };
  }

  saveCustomCourseData(data);
  return data.quizOverrides[index === -1 ? data.quizOverrides.length - 1 : index];
}

export function removeQuizOverride(courseId: string, quizId: string): boolean {
  const data = loadCustomCourseData();
  const index = data.quizOverrides.findIndex(
    (o) => o.courseId === courseId && o.quizId === quizId
  );
  if (index === -1) return false;

  data.quizOverrides.splice(index, 1);
  saveCustomCourseData(data);
  return true;
}

// Get all quiz overrides for a course
export function getQuizOverridesForCourse(courseId: string): QuizOverride[] {
  const data = loadCustomCourseData();
  return data.quizOverrides.filter((o) => o.courseId === courseId);
}
