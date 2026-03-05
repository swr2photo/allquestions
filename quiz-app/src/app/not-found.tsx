import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-24 text-center max-w-lg">
      <div className="mb-8">
        <SearchX className="h-20 w-20 mx-auto text-gray-300 mb-6" />
        <h1 className="text-4xl font-bold text-gray-900 mb-3">404</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          ไม่พบหน้าที่ค้นหา
        </h2>
        <p className="text-gray-500">
          หน้าที่คุณกำลังค้นหาอาจถูกลบ เปลี่ยนชื่อ หรือไม่มีอยู่ในระบบ
        </p>
      </div>
      <Link href="/">
        <Button size="lg" className="gap-2">
          <Home className="h-4 w-4" />
          กลับหน้าแรก
        </Button>
      </Link>
    </div>
  );
}
