import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { DialogsProvider } from "@/components/ui/confirm";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist has no Thai glyphs — without this, Thai text falls back to whatever the
// OS ships (Tahoma/Leelawadee/…) and exported timetable images look different
// on every device.
const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Allquiz - ระบบจัดการข้อสอบ",
  description: "ระบบจัดการข้อสอบออนไลน์ สำหรับนักศึกษา",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoThai.variable} antialiased bg-gray-50 min-h-screen`}
      >
        <DialogsProvider>
          <Navbar />
          <main>{children}</main>
        </DialogsProvider>
        <Toaster richColors closeButton position="top-center" />
      </body>
    </html>
  );
}
