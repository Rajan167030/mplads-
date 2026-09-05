"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

const MobileNavContext = createContext<{ open: boolean; toggle: () => void; close: () => void } | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close automatically whenever the route changes, so picking a nav item
  // doesn't leave the overlay sidebar open on top of the new page.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <MobileNavContext.Provider value={{ open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used within MobileNavProvider");
  return ctx;
}
