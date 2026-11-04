"use client";

import { Bell, Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/passes": "Visitor passes",
  "/admin/users": "Users",
  "/admin/homes": "Houses",
  "/profile": "Settings",
};

export function AppHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur sm:px-5 lg:px-6">
      <button type="button" onClick={onMenuOpen} aria-label="Open navigation" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted lg:hidden"><Menu className="h-5 w-5" /></button>
      <h1 className="text-base font-semibold text-foreground">{pageTitles[pathname] || "Gate Pass"}</h1>
      <div className="ml-auto hidden h-8 w-full max-w-[260px] items-center gap-2 rounded-md border border-border bg-[#f9fafb] px-3 text-muted md:flex">
        <Search className="h-4 w-4" />
        <span className="text-sm">Search</span>
        <kbd className="ml-auto text-[11px] text-[#9ca3af]">⌘ K</kbd>
      </div>
      <button type="button" aria-label="Notifications" className="relative grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-[#f3f4f6] hover:text-foreground"><Bell className="h-[18px] w-[18px]" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#111827] ring-2 ring-white" /></button>
      <div className="hidden items-center gap-2 border-l border-border pl-4 sm:flex">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#111827] text-xs font-medium text-white">{(user?.fullName || "U")[0]?.toUpperCase()}</span>
        <span className="max-w-32 truncate text-sm font-medium text-foreground">{user?.fullName || "User"}</span>
      </div>
    </header>
  );
}
