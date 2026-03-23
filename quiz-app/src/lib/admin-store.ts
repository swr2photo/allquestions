import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AdminData, CourseSettings } from "@/types";
import { courses } from "@/data/courses";

const DATA_FILE = path.join(process.cwd(), "data", "admin-data.json");

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

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

export function loadAdminData(): AdminData {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data: AdminData = JSON.parse(raw);

      // Ensure all courses have settings (in case new courses were added)
      let updated = false;
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
        saveAdminData(data);
      }

      return data;
    }
  } catch {
    // If file is corrupted, recreate
  }

  const defaultData = getDefaultData();
  saveAdminData(defaultData);
  return defaultData;
}

export function saveAdminData(data: AdminData): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
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

export function getCourseSettings(courseId: string): CourseSettings | undefined {
  const data = loadAdminData();
  return data.courseSettings[courseId];
}

export function updateCourseSettings(
  courseId: string,
  settings: Partial<CourseSettings>
): CourseSettings {
  const data = loadAdminData();
  const current = data.courseSettings[courseId] || {
    isActive: true,
    scheduleStart: null,
    scheduleEnd: null,
    order: Object.keys(data.courseSettings).length,
  };

  const updated = { ...current, ...settings };
  data.courseSettings[courseId] = updated;
  saveAdminData(data);
  return updated;
}

export function isCourseVisible(courseId: string): boolean {
  const settings = getCourseSettings(courseId);
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

// Generate a session token
export function createSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// File-based session store (persists across server restarts)
const SESSIONS_FILE = path.join(process.cwd(), "data", "sessions.json");
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

interface SessionInfo {
  email: string;
  name: string;
  picture: string;
}

interface StoredSession extends SessionInfo {
  createdAt: number;
}

function loadSessions(): Record<string, StoredSession> {
  ensureDataDir();
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
      const sessions: Record<string, StoredSession> = JSON.parse(raw);

      // Clean up expired sessions
      const now = Date.now();
      let changed = false;
      for (const token of Object.keys(sessions)) {
        if (now - sessions[token].createdAt > SESSION_MAX_AGE_MS) {
          delete sessions[token];
          changed = true;
        }
      }
      if (changed) {
        saveSessions(sessions);
      }

      return sessions;
    }
  } catch {
    // If file is corrupted, start fresh
  }
  return {};
}

function saveSessions(sessions: Record<string, StoredSession>): void {
  ensureDataDir();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
}

export function addSession(token: string, info: SessionInfo): void {
  const sessions = loadSessions();
  sessions[token] = {
    ...info,
    createdAt: Date.now(),
  };
  saveSessions(sessions);
}

export function removeSession(token: string): void {
  const sessions = loadSessions();
  delete sessions[token];
  saveSessions(sessions);
}

export function isValidSession(token: string | null | undefined): boolean {
  if (!token) return false;
  const sessions = loadSessions();
  return token in sessions;
}

export function getSessionInfo(token: string | null | undefined): SessionInfo | null {
  if (!token) return null;
  const sessions = loadSessions();
  const session = sessions[token];
  if (!session) return null;
  return {
    email: session.email,
    name: session.name,
    picture: session.picture,
  };
}
