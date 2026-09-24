"use client";

import { useMobileNav } from "@/lib/mobile-nav-context";
import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { AssistantFab } from "@/components/dashboard/assistant-fab";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useMobileNav();

  return (
    <div className="min-h-screen bg-dashboard-surface font-sans text-dashboard-ink">
      <DashboardSidebar />
      <div
        className={`min-h-screen transition-[padding] duration-300 ease-in-out ${
          isCollapsed ? "lg:pl-[72px]" : "lg:pl-[286px]"
        }`}
      >
        <DashboardHeader />
        {children}
      </div>
      <AssistantFab />
    </div>
  );
}
