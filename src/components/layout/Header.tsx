"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart3, FolderKanban, FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kpis", label: "KPIs", icon: BarChart3 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/reviews", label: "Reviews", icon: FileText },
  { href: "/import", label: "Import", icon: Upload },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 no-print">
      <div className="max-w-7xl mx-auto flex items-center h-14 px-4 sm:px-6">
        <div className="flex items-center gap-3 mr-8">
          <div className="w-1.5 h-8 rounded-full bg-[#00A082]" />
          <h1 className="text-base font-bold text-[#1A1A1A] hidden sm:block">Performance Management</h1>
        </div>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  active
                    ? "text-[#00A082] bg-[#00A082]/5"
                    : "text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-50"
                )}
              >
                <Icon size={16} />
                <span className="hidden md:inline">{label}</span>
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#00A082] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
