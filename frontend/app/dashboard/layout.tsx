import { AssistantFab } from "@/components/dashboard/assistant-fab";
import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MobileNavProvider } from "@/lib/mobile-nav-context";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-dashboard-surface font-sans text-dashboard-ink">
        <DashboardSidebar />
        <div className="min-h-screen lg:pl-72">
          <DashboardHeader />
          {children}
        </div>
        <AssistantFab />
      </div>
    </MobileNavProvider>
  );
}
