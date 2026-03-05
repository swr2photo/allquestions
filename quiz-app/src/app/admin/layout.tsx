import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Allquiz",
  description: "ระบบจัดการข้อสอบ - แผงควบคุมผู้ดูแลระบบ",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
