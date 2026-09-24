import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MobileNavProvider } from "@/lib/mobile-nav-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <DashboardShell>{children}</DashboardShell>
    </MobileNavProvider>
  );
}
