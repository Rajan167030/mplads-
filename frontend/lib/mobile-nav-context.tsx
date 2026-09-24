"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

interface NavContextType {
  open: boolean;
  toggle: () => void;
  close: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (v: boolean) => void;
}

const MobileNavContext = createContext<NavContextType | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  // Load persisted collapse state on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mplads_sidebar_collapsed");
      if (saved === "true") setIsCollapsed(true);
    } catch {}
  }, []);

  // Close mobile drawer on route change
  useEffect(() => setOpen(false), [pathname]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("mplads_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const setCollapsed = (val: boolean) => {
    setIsCollapsed(val);
    try {
      localStorage.setItem("mplads_sidebar_collapsed", String(val));
    } catch {}
  };

  return (
    <MobileNavContext.Provider
      value={{
        open,
        toggle: () => setOpen((v) => !v),
        close: () => setOpen(false),
        isCollapsed,
        toggleCollapse,
        setCollapsed,
      }}
    >
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used within MobileNavProvider");
  return ctx;
}
