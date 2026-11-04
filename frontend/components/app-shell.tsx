"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { TopNavigation } from "@/components/top-navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <TopNavigation collapsed={collapsed} mobileOpen={mobileOpen} onCollapse={() => setCollapsed((value) => !value)} onMobileClose={() => setMobileOpen(false)} />
      <div className="min-w-0 flex-1">
        <AppHeader onMenuOpen={() => setMobileOpen(true)} />
        <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-5 lg:px-6 lg:py-5">{children}</div>
      </div>
    </div>
  );
}
