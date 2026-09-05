import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { HeroPanel } from "@/components/site/hero-panel";
import { LoginPanel } from "@/components/site/login-panel";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <SiteHeader />
      <main className="flex flex-1 flex-col lg:min-h-[calc(100vh-110px)] lg:flex-row">
        <HeroPanel />
        <LoginPanel />
      </main>
      <SiteFooter />
    </div>
  );
}
