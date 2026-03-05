"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-24 text-center max-w-lg">
      <div className="mb-8">
        <AlertTriangle className="h-20 w-20 mx-auto text-amber-400 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          เกิดข้อผิดพลาด
        </h1>
        <p className="text-gray-500">
          ขออภัย เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง
        </p>
      </div>
      <div className="flex gap-3 justify-center">
        <Button onClick={reset} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          ลองใหม่
        </Button>
        <Link href="/">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            กลับหน้าแรก
          </Button>
        </Link>
      </div>
    </div>
  );
}
