"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  CalendarRange,
  GraduationCap,
  Home,
  Library,
  Menu,
  Search,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";

const links = [
  { href: "/", label: "หน้าแรก", icon: Home },
  { href: "/courses", label: "รายวิชา", icon: BookOpen },
  { href: "/timetable", label: "จัดตารางเรียน", icon: CalendarRange },
  { href: "/gened", label: "วิชาเลือกเสรี", icon: Library },
  { href: "/faculties", label: "คณะ/หลักสูตร", icon: Building2 },
  { href: "/search", label: "ค้นหา", icon: Search },
  { href: "/ai", label: "AI Chat", icon: Sparkles },
  { href: "/admin", label: "ผู้ดูแลระบบ", icon: Shield },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200/70 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-lg print:hidden">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-green-600 text-white shadow-md transition-shadow group-hover:shadow-lg">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="bg-linear-to-r from-emerald-600 to-green-600 bg-clip-text text-lg font-bold text-transparent">
            <AnimatedShinyText className="text-lg font-bold" shimmerWidth={80}>
              Allquiz
            </AnimatedShinyText>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="เมนูหลัก">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                  active ? "bg-emerald-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "ปิดเมนู" : "เปิดเมนู"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="animate-slide-up border-t border-gray-100 bg-white lg:hidden">
          <nav className="container mx-auto grid grid-cols-2 gap-2 p-3 sm:grid-cols-4" aria-label="เมนูหลัก">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition",
                    active ? "bg-emerald-600 text-white shadow-sm" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      active ? "bg-white/20" : "bg-white text-emerald-700 shadow-sm"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
