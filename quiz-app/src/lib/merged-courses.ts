// Server-only module: merges static courses with custom quizzes, custom courses, and overrides
// This file uses fs (via stores) and MUST NOT be imported from client components

import { courses as staticCourses } from "@/data/courses";
import { getCustomQuizzesAsQuiz } from "@/lib/custom-quiz-store";
import {
  getAllCustomCourses,
  getCustomCourse,
  loadCustomCourseData,
} from "@/lib/custom-course-store";
import type { Course, Quiz } from "@/types";

// Apply course overrides and quiz overrides to a static course
async function applyCourseOverrides(course: Course): Promise<Course> {
  try {
    const data = await loadCustomCourseData();

    // Apply course metadata override
    const courseOverride = data.courseOverrides.find((o) => o.courseId === course.id);
    let merged = { ...course };
    if (courseOverride) {
      merged = {
        ...merged,
        title: courseOverride.title ?? merged.title,
        description: courseOverride.description ?? merged.description,
        icon: courseOverride.icon ?? merged.icon,
        color: courseOverride.color ?? merged.color,
      };
    }

    // Apply quiz overrides
    const quizOverrides = data.quizOverrides.filter((o) => o.courseId === course.id);
    if (quizOverrides.length > 0) {
      merged.quizzes = merged.quizzes.map((quiz) => {
        const override = quizOverrides.find((o) => o.quizId === quiz.id);
        if (!override) return quiz;
        return {
          ...quiz,
          title: override.title ?? quiz.title,
          description: override.description ?? quiz.description,
          questions: override.questions ?? quiz.questions,
        };
      });
    }

    return merged;
  } catch {
    return course;
  }
}

export async function getCourseWithCustom(courseId: string): Promise<Course | undefined> {
  // Check custom courses first
  const customCourse = await getCustomCourse(courseId);
  if (customCourse) {
    return {
      id: customCourse.id,
      title: customCourse.title,
      description: customCourse.description,
      icon: customCourse.icon,
      color: customCourse.color,
      quizzes: customCourse.quizzes,
    };
  }

  // Static course
  const course = staticCourses.find((c) => c.id === courseId);
  if (!course) return undefined;

  try {
    const merged = await applyCourseOverrides(course);
    const customQuizzes = await getCustomQuizzesAsQuiz(courseId);
    if (customQuizzes.length === 0) return merged;

    return {
      ...merged,
      quizzes: [...merged.quizzes, ...customQuizzes],
    };
  } catch {
    return course;
  }
}

export async function getQuizWithCustom(courseId: string, quizId: string): Promise<Quiz | undefined> {
  const course = await getCourseWithCustom(courseId);
  return course?.quizzes.find((q) => q.id === quizId);
}

export async function getAllCoursesWithCustom(): Promise<Course[]> {
  try {
    // Static courses with overrides and custom quizzes
    const mergedStatic = await Promise.all(
      staticCourses.map(async (course) => {
        const merged = await applyCourseOverrides(course);
        const customQuizzes = await getCustomQuizzesAsQuiz(course.id);
        if (customQuizzes.length === 0) return merged;
        return {
          ...merged,
          quizzes: [...merged.quizzes, ...customQuizzes],
        };
      })
    );

    // Custom courses
    const allCustom = await getAllCustomCourses();
    const customCourses = allCustom.map((cc) => ({
      id: cc.id,
      title: cc.title,
      description: cc.description,
      icon: cc.icon,
      color: cc.color,
      quizzes: cc.quizzes,
    }));

    return [...mergedStatic, ...customCourses];
  } catch {
    return staticCourses;
  }
}

export async function getTotalQuestionsWithCustom(): Promise<number> {
  const all = await getAllCoursesWithCustom();
  return all.reduce(
    (total, course) =>
      total +
      course.quizzes.reduce((qTotal, quiz) => qTotal + quiz.questions.length, 0),
    0
  );
}

export async function getTotalQuizzesWithCustom(): Promise<number> {
  const all = await getAllCoursesWithCustom();
  return all.reduce((total, course) => total + course.quizzes.length, 0);
}

export async function getTotalPdfQuizzesWithCustom(): Promise<number> {
  const all = await getAllCoursesWithCustom();
  return all.reduce(
    (total, course) =>
      total + course.quizzes.filter((q) => q.type === "pdf").length,
    0
  );
}
