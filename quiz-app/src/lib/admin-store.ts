import { kv } from "@/lib/kv";
import type { AdminData, CourseSettings, QuizSettings } from "@/types";
import { courses } from "@/data/courses";
import { getAdminEmailsFromEnv } from "@/lib/session-token";

// Session helpers live in session-token.ts (kept light so proxy.ts can import them).
export * from "@/lib/session-token";

function getDefaultData(): AdminData {
  const courseSettings: Record<string, CourseSettings> = {};
  courses.forEach((course, index) => {
    courseSettings[course.id] = {
      isActive: true,
      scheduleStart: null,
      scheduleEnd: null,
      order: index,
    };
  });

  return {
    courseSettings,
    quizSettings: {},
    adminEmails: getAdminEmailsFromEnv(),
  };
}

export async function loadAdminData(): Promise<AdminData> {
  try {
    const data = await kv.get<AdminData>("admin-data");
    if (data) {
      // Ensure all courses have settings (in case new courses were added)
      let updated = false;

      // Ensure quizSettings object exists for backwards compatibility
      if (!data.quizSettings) {
        data.quizSettings = {};
        updated = true;
      }

      courses.forEach((course, index) => {
        if (!data.courseSettings[course.id]) {
          data.courseSettings[course.id] = {
            isActive: true,
            scheduleStart: null,
            scheduleEnd: null,
            order: index,
          };
          updated = true;
        }
      });
      if (updated) {
        await saveAdminData(data);
      }

      return data;
    }
  } catch {
    // If kv fails or corrupted
  }

  const defaultData = getDefaultData();
  await saveAdminData(defaultData);
  return defaultData;
}

export async function saveAdminData(data: AdminData): Promise<void> {
  await kv.set("admin-data", data);
}

// Verify Google ID token via Google's tokeninfo endpoint
export async function verifyGoogleToken(
  idToken: string
): Promise<{ email: string; name: string; picture: string } | null> {
  try {
    if (typeof idToken !== "string" || idToken.length > 8192) return null;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    // Without a client ID we can't check the audience, so a token minted for any other app would pass.
    if (!clientId) return null;

    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;

    const payload = await res.json();

    // Verify audience and issuer
    if (payload.aud !== clientId) return null;
    if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") return null;
    if (typeof payload.email !== "string" || !payload.email) return null;

    // Verify email is verified
    if (payload.email_verified !== "true" && payload.email_verified !== true) return null;

    return {
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture || "",
    };
  } catch {
    return null;
  }
}

export async function getCourseSettings(courseId: string): Promise<CourseSettings | undefined> {
  const data = await loadAdminData();
  return data.courseSettings[courseId];
}

export async function updateCourseSettings(
  courseId: string,
  settings: Partial<CourseSettings>
): Promise<CourseSettings> {
  const data = await loadAdminData();
  const current = data.courseSettings[courseId] || {
    isActive: true,
    scheduleStart: null,
    scheduleEnd: null,
    order: Object.keys(data.courseSettings).length,
  };

  const updated = { ...current, ...settings };
  data.courseSettings[courseId] = updated;
  await saveAdminData(data);
  return updated;
}

export async function isCourseVisible(courseId: string): Promise<boolean> {
  const settings = await getCourseSettings(courseId);
  if (!settings) return true;
  if (!settings.isActive) return false;

  const now = new Date();
  if (settings.scheduleStart) {
    const start = new Date(settings.scheduleStart);
    if (now < start) return false;
  }
  if (settings.scheduleEnd) {
    const end = new Date(settings.scheduleEnd);
    if (now > end) return false;
  }

  return true;
}

export async function getQuizSettings(quizId: string): Promise<QuizSettings | undefined> {
  const data = await loadAdminData();
  return data.quizSettings?.[quizId];
}

export async function updateQuizSettings(
  quizId: string,
  settings: Partial<QuizSettings>
): Promise<QuizSettings> {
  const data = await loadAdminData();
  if (!data.quizSettings) {
    data.quizSettings = {};
  }
  
  const current = data.quizSettings[quizId] || {
    isActive: true,
    scheduleStart: null,
    scheduleEnd: null,
  };

  const updated = { ...current, ...settings };
  data.quizSettings[quizId] = updated;
  await saveAdminData(data);
  return updated;
}

export async function isQuizVisible(quizId: string): Promise<boolean> {
  const settings = await getQuizSettings(quizId);
  if (!settings) return true; // Default to visible if no settings configured
  if (!settings.isActive) return false;

  const now = new Date();
  if (settings.scheduleStart) {
    const start = new Date(settings.scheduleStart);
    if (now < start) return false;
  }
  if (settings.scheduleEnd) {
    const end = new Date(settings.scheduleEnd);
    if (now > end) return false;
  }

  return true;
}
