"use client";

import { Bot } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function AssistantFab() {
  const router = useRouter();
  const pathname = usePathname();

  // Pointless to float a button to the assistant on the assistant page itself.
  if (pathname.startsWith("/dashboard/assistant")) return null;

  return (
    <button
      onClick={() => router.push("/dashboard/assistant")}
      title="AI Assistant"
      aria-label="Open AI Assistant"
      className="group fixed bottom-6 right-6 z-40 grid size-14 place-items-center rounded-full border border-dashboard-lime/40 bg-dashboard-navy text-dashboard-lime shadow-[0_8px_28px_rgba(9,37,65,0.35),0_0_0_6px_rgba(141,252,117,0.08)] transition hover:scale-105 hover:shadow-[0_10px_32px_rgba(9,37,65,0.4),0_0_0_8px_rgba(141,252,117,0.14)]"
    >
      <Bot size={24} strokeWidth={2} />
      <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-md bg-dashboard-deep px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
        AI Assistant
      </span>
    </button>
  );
}
