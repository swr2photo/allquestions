"use client";

// Google Identity Services button → POST /api/auth/user (same flow as /ai).

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface GsiApi {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
    };
  };
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiPromise: Promise<GsiApi | null> | null = null;

function loadGsi(): Promise<GsiApi | null> {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve) => {
    const w = window as unknown as { google?: GsiApi };
    if (w.google?.accounts?.id) return resolve(w.google);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve(w.google ?? null));
    s.addEventListener("error", () => {
      gsiPromise = null;
      resolve(null);
    });
    if (!existing) {
      s.src = GSI_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return gsiPromise;
}

export function GoogleSignIn({ onSignedIn, width = 280 }: { onSignedIn: () => void; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGsi().then((g) => {
      if (cancelled || !g || !ref.current) {
        if (!g && !cancelled) setError("โหลดปุ่มเข้าสู่ระบบ Google ไม่สำเร็จ");
        return;
      }
      g.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/auth/user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            onSignedIn();
          } catch (e) {
            setError(e instanceof Error && e.message ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
          } finally {
            setBusy(false);
          }
        },
      });
      g.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        locale: "th",
        width,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, onSignedIn, width]);

  if (!clientId) {
    return <p className="text-xs text-gray-500">ยังไม่ได้ตั้งค่า Google Sign-In (NEXT_PUBLIC_GOOGLE_CLIENT_ID)</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} className="min-h-[44px]" />
      {busy && (
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังเข้าสู่ระบบ…
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
