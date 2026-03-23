import { kv } from "@/lib/kv";
import type {
  CustomCourse,
  CustomCourseData,
  CourseOverride,
  QuizOverride,
  Quiz,
} from "@/types";

function getDefaultData(): CustomCourseData {
  return {
    courses: [],
    courseOverrides: [],
    quizOverrides: [],
  };
}

export async function loadCustomCourseData(): Promise<CustomCourseData> {
  try {
    const data = await kv.get<CustomCourseData>("custom-courses");
    if (data) {
      // Ensure all fields exist
      if (!data.courses) data.courses = [];
      if (!data.courseOverrides) data.courseOverrides = [];
      if (!data.quizOverrides) data.quizOverrides = [];
      return data;
    }
  } catch {
    // corrupted, empty, or kv failed
  }
  const defaultData = getDefaultData();
  await saveCustomCourseData(defaultData);
  return defaultData;
}

export async function saveCustomCourseData(data: CustomCourseData): Promise<void> {
  await kv.set("custom-courses", data);
}

// ============ Custom Course CRUD ============

export async function getAllCustomCourses(): Promise<CustomCourse[]> {
  const data = await loadCustomCourseData();
  return data.courses;
}

export async function getCustomCourse(courseId: string): Promise<CustomCourse | undefined> {
  const data = await loadCustomCourseData();
  return data.courses.find((c) => c.id === courseId);
}

export async function createCustomCourse(
  course: Omit<CustomCourse, "id" | "createdAt" | "updatedAt">
): Promise<CustomCourse> {
  const data = await loadCustomCourseData();
  const now = new Date().toISOString();

  const newCourse: CustomCourse = {
    ...course,
    id: `custom-course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };

  data.courses.push(newCourse);
  await saveCustomCourseData(data);
  return newCourse;
}

export async function updateCustomCourse(
  courseId: string,
  updates: Partial<Omit<CustomCourse, "id" | "createdAt">>
): Promise<CustomCourse | null> {
  const data = await loadCustomCourseData();
  const index = data.courses.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  data.courses[index] = {
    ...data.courses[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveCustomCourseData(data);
  return data.courses[index];
}

export async function deleteCustomCourse(courseId: string): Promise<boolean> {
  const data = await loadCustomCourseData();
  const index = data.courses.findIndex((c) => c.id === courseId);
  if (index === -1) return false;

  data.courses.splice(index, 1);
  await saveCustomCourseData(data);
  return true;
}

// Add quiz to custom course
export async function addQuizToCustomCourse(courseId: string, quiz: Quiz): Promise<CustomCourse | null> {
  const data = await loadCustomCourseData();
  const index = data.courses.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const quizWithId: Quiz = {
    ...quiz,
    id: quiz.id || `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  data.courses[index].quizzes.push(quizWithId);
  data.courses[index].updatedAt = new Date().toISOString();
  await saveCustomCourseData(data);
  return data.courses[index];
}

// Update quiz in custom course
export async function updateQuizInCustomCourse(
  courseId: string,
  quizId: string,
  updates: Partial<Quiz>
): Promise<Quiz | null> {
  const data = await loadCustomCourseData();
  const courseIndex = data.courses.findIndex((c) => c.id === courseId);
  if (courseIndex === -1) return null;

  const quizIndex = data.courses[courseIndex].quizzes.findIndex((q) => q.id === quizId);
  if (quizIndex === -1) return null;

  data.courses[courseIndex].quizzes[quizIndex] = {
    ...data.courses[courseIndex].quizzes[quizIndex],
    ...updates,
  };
  data.courses[courseIndex].updatedAt = new Date().toISOString();
  await saveCustomCourseData(data);
  return data.courses[courseIndex].quizzes[quizIndex];
}

// Delete quiz from custom course
export async function deleteQuizFromCustomCourse(courseId: string, quizId: string): Promise<boolean> {
  const data = await loadCustomCourseData();
  const courseIndex = data.courses.findIndex((c) => c.id === courseId);
  if (courseIndex === -1) return false;

  const quizIndex = data.courses[courseIndex].quizzes.findIndex((q) => q.id === quizId);
  if (quizIndex === -1) return false;

  data.courses[courseIndex].quizzes.splice(quizIndex, 1);
  data.courses[courseIndex].updatedAt = new Date().toISOString();
  await saveCustomCourseData(data);
  return true;
}

// ============ Course Override (edit static course metadata) ============

export async function getCourseOverride(courseId: string): Promise<CourseOverride | undefined> {
  const data = await loadCustomCourseData();
  return data.courseOverrides.find((o) => o.courseId === courseId);
}

export async function setCourseOverride(courseId: string, override: Omit<CourseOverride, "courseId">): Promise<CourseOverride> {
  const data = await loadCustomCourseData();
  const index = data.courseOverrides.findIndex((o) => o.courseId === courseId);

  const fullOverride: CourseOverride = { courseId, ...override };

  if (index === -1) {
    data.courseOverrides.push(fullOverride);
  } else {
    data.courseOverrides[index] = fullOverride;
  }

  await saveCustomCourseData(data);
  return fullOverride;
}

export async function removeCourseOverride(courseId: string): Promise<boolean> {
  const data = await loadCustomCourseData();
  const index = data.courseOverrides.findIndex((o) => o.courseId === courseId);
  if (index === -1) return false;

  data.courseOverrides.splice(index, 1);
  await saveCustomCourseData(data);
  return true;
}

// ============ Quiz Override (edit static quiz content) ============

export async function getQuizOverride(courseId: string, quizId: string): Promise<QuizOverride | undefined> {
  const data = await loadCustomCourseData();
  return data.quizOverrides.find((o) => o.courseId === courseId && o.quizId === quizId);
}

export async function setQuizOverride(
  courseId: string,
  quizId: string,
  override: Partial<Omit<QuizOverride, "courseId" | "quizId">>
): Promise<QuizOverride> {
  const data = await loadCustomCourseData();
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

  await saveCustomCourseData(data);
  return data.quizOverrides[index === -1 ? data.quizOverrides.length - 1 : index];
}

export async function removeQuizOverride(courseId: string, quizId: string): Promise<boolean> {
  const data = await loadCustomCourseData();
  const index = data.quizOverrides.findIndex(
    (o) => o.courseId === courseId && o.quizId === quizId
  );
  if (index === -1) return false;

  data.quizOverrides.splice(index, 1);
  await saveCustomCourseData(data);
  return true;
}

// Get all quiz overrides for a course
export async function getQuizOverridesForCourse(courseId: string): Promise<QuizOverride[]> {
  const data = await loadCustomCourseData();
  return data.quizOverrides.filter((o) => o.courseId === courseId);
}

