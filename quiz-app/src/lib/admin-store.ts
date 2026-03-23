import crypto from "crypto";
import { kv } from "@/lib/kv";
import type { AdminData, CourseSettings, QuizSettings } from "@/types";
import { courses } from "@/data/courses";

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

// Get allowed admin emails from environment variable
function getAdminEmailsFromEnv(): string[] {
  const envEmails = process.env.ADMIN_EMAILS || "doralaikon.th@gmail.com";
  return envEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Check if an email is allowed as admin
export function isAllowedAdminEmail(email: string): boolean {
  const allowed = getAdminEmailsFromEnv();
  return allowed.includes(email.toLowerCase().trim());
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
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!res.ok) return null;

    const payload = await res.json();
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    // Verify audience matches our client ID
    if (clientId && payload.aud !== clientId) return null;

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

// Stateless JWT-like Session Store
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
const SECRET_KEY = process.env.SESSION_SECRET || "default-quiz-app-secret-key-please-change-it";

interface SessionInfo {
  email: string;
  name: string;
  picture: string;
}

interface StoredSession extends SessionInfo {
  expiresAt: number;
}

function signSession(data: StoredSession): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

// Generate a signed session token
export function createSessionToken(info: SessionInfo): string {
  const sessionData: StoredSession = {
    ...info,
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  };
  return signSession(sessionData);
}

export function isValidSession(token: string | null | undefined): boolean {
  return getSessionInfo(token) !== null;
}

export function getSessionInfo(token: string | null | undefined): SessionInfo | null {
  if (!token) return null;
  
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  
  const expectedSignature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(payload)
    .digest("base64url");
    
  if (signature !== expectedSignature) return null;
  
  try {
    const data: StoredSession = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (Date.now() > data.expiresAt) return null;
    return {
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch {
    return null;
  }
}

