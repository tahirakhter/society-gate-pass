"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  TicketCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import type { UserRole } from "@/lib/api";

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onMobileClose: () => void;
};

type SidebarItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
};

const commonItems: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/passes", label: "Visitor passes", icon: TicketCheck, roles: ["OWNER"] },
  { href: "/admin/homes", label: "Houses", icon: Building2, roles: ["ADMIN"] },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["ADMIN"] },
  { href: "/profile", label: "Settings", icon: Settings },
];

export function TopNavigation({ collapsed, mobileOpen, onCollapse, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = commonItems.filter((item) => !item.roles || (user?.role && item.roles.includes(user.role)));

  return (
    <>
      {mobileOpen ? <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" onClick={onMobileClose} /> : null}
      <aside className={`fixed inset-y-0 left-0 z-50 flex border-r border-border bg-white transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen ${collapsed ? "lg:w-[64px]" : "lg:w-56"} ${mobileOpen ? "w-56 translate-x-0" : "w-56 -translate-x-full lg:translate-x-0"}`}>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 items-center gap-3 border-b border-border px-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#111827] text-white"><ShieldCheck className="h-[18px] w-[18px]" /></span>
            {!collapsed ? <span className="truncate text-sm font-semibold tracking-tight text-foreground">Gate Pass</span> : null}
            <button onClick={onMobileClose} aria-label="Close menu" className="ml-auto grid h-8 w-8 place-items-center text-muted lg:hidden"><X className="h-5 w-5" /></button>
          </div>

          <nav aria-label="Primary navigation" className="flex-1 space-y-0.5 px-2 py-3">
            <p className={`mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-muted ${collapsed ? "lg:hidden" : ""}`}>Workspace</p>
            {items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={onMobileClose} title={collapsed ? item.label : undefined} className={`flex h-9 items-center gap-3 rounded-md border-l-2 px-3 text-sm font-medium transition-colors ${active ? "border-[#111827] bg-[#f3f4f6] text-[#111827]" : "border-transparent text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]"}`}>
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            })}
            <div className="my-3 border-t border-border" />
            <span className="flex h-9 items-center gap-3 px-3 text-sm text-muted" title={collapsed ? "AI assistant" : undefined}>
              <Bot className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              {!collapsed ? <span>AI assistant</span> : null}
            </span>
          </nav>

          <div className="border-t border-border p-3">
            <Link href="/profile" className="flex min-w-0 items-center gap-3 rounded-md p-2 hover:bg-[#f3f4f6]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e5e7eb] text-xs font-semibold text-[#374151]">{getInitials(user?.fullName)}</span>
              {!collapsed ? <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{user?.fullName || "User"}</span><span className="block text-xs capitalize text-muted">{user?.role?.toLowerCase()}</span></span> : null}
            </Link>
          </div>
        </div>
        <button type="button" onClick={onCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="absolute -right-3 top-[76px] hidden h-6 w-6 place-items-center rounded-md border border-border bg-white text-muted shadow-sm hover:text-foreground lg:grid">
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>
    </>
  );
}

function getInitials(name?: string) {
  return (name || "GP").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
