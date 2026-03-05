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
function applyCourseOverrides(course: Course): Course {
  try {
    const data = loadCustomCourseData();

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

export function getCourseWithCustom(courseId: string): Course | undefined {
  // Check custom courses first
  const customCourse = getCustomCourse(courseId);
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
    const merged = applyCourseOverrides(course);
    const customQuizzes = getCustomQuizzesAsQuiz(courseId);
    if (customQuizzes.length === 0) return merged;

    return {
      ...merged,
      quizzes: [...merged.quizzes, ...customQuizzes],
    };
  } catch {
    return course;
  }
}

export function getQuizWithCustom(courseId: string, quizId: string) {
  const course = getCourseWithCustom(courseId);
  return course?.quizzes.find((q) => q.id === quizId);
}

export function getAllCoursesWithCustom(): Course[] {
  try {
    // Static courses with overrides and custom quizzes
    const mergedStatic = staticCourses.map((course) => {
      const merged = applyCourseOverrides(course);
      const customQuizzes = getCustomQuizzesAsQuiz(course.id);
      if (customQuizzes.length === 0) return merged;
      return {
        ...merged,
        quizzes: [...merged.quizzes, ...customQuizzes],
      };
    });

    // Custom courses
    const customCourses = getAllCustomCourses().map((cc) => ({
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

export function getTotalQuestionsWithCustom(): number {
  const all = getAllCoursesWithCustom();
  return all.reduce(
    (total, course) =>
      total +
      course.quizzes.reduce((qTotal, quiz) => qTotal + quiz.questions.length, 0),
    0
  );
}

export function getTotalQuizzesWithCustom(): number {
  const all = getAllCoursesWithCustom();
  return all.reduce((total, course) => total + course.quizzes.length, 0);
}

export function getTotalPdfQuizzesWithCustom(): number {
  const all = getAllCoursesWithCustom();
  return all.reduce(
    (total, course) =>
      total + course.quizzes.filter((q) => q.type === "pdf").length,
    0
  );
}
