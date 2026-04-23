"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogleResponse = useCallback(
    async (response: { credential: string }) => {
      setError("");
      setLoading(true);

      try {
        const res = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });

        const data = await res.json();

        if (data.success) {
          router.push("/admin/dashboard");
        } else {
          setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
        }
      } catch {
        setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID_HERE") {
      setError("ยังไม่ได้ตั้งค่า Google Client ID ใน .env.local");
      return;
    }

    // Load Google GSI script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
        });

        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
        });

        setGsiReady(true);
      }
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existing = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      );
      if (existing) existing.remove();
    };
  }, [handleGoogleResponse]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-xl border-gray-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-green-600 text-white shadow-lg">
            <Shield className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">แผงควบคุมผู้ดูแลระบบ</CardTitle>
          <CardDescription>เข้าสู่ระบบด้วยบัญชี Google</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Sign-In Button */}
          <div className="flex justify-center">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500 py-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>กำลังเข้าสู่ระบบ...</span>
              </div>
            ) : (
              <div
                ref={googleBtnRef}
                className={gsiReady ? "" : "h-10"}
              />
            )}
          </div>

          {!gsiReady && !error && !loading && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังโหลด Google Sign-In...
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <p className="text-xs text-center text-gray-400 mt-4">
            เฉพาะบัญชี Google ที่ได้รับอนุญาตเท่านั้น
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
