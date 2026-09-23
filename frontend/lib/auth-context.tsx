"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { ApiError, getMe, login as apiLogin, type CurrentUser } from "@/lib/api";
import { demoTokenFor, demoUserFromToken, findDemoAccount, isDemoToken, isNetworkError } from "@/lib/demo-data";

const TOKEN_STORAGE_KEY = "mplads_token";
// Mirrors the token into a (non-httpOnly) cookie alongside localStorage, so
// server components — which render on the Next.js server and can't reach
// localStorage — can read it via next/headers cookies() and scope their
// dashboard data fetches to the signed-in official's jurisdiction.
const TOKEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8; // matches backend access_token_expire_minutes

function setTokenCookie(token: string) {
  try {
    document.cookie = `${TOKEN_STORAGE_KEY}=${token}; path=/; max-age=${TOKEN_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  } catch {
    // per-viewer convenience only — dashboard pages fall back to unscoped/public data without it
  }
}

function clearTokenCookie() {
  try {
    document.cookie = `${TOKEN_STORAGE_KEY}=; path=/; max-age=0`;
  } catch {
    // ignore
  }
}

interface AuthContextValue {
  user: CurrentUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      } catch {
        // localStorage unavailable (private browsing, etc.) — proceed unauthenticated
      }

      if (stored && isDemoToken(stored)) {
        // Demo session created while the backend was unreachable — reconstruct
        // it locally rather than calling a backend that may still be down.
        const demoUser = demoUserFromToken(stored);
        if (demoUser && !cancelled) {
          setTokenCookie(stored);
          setToken(stored);
          setUser(demoUser);
        }
      } else if (stored) {
        try {
          const me = await getMe(stored);
          if (!cancelled) {
            setTokenCookie(stored);
            setToken(stored);
            setUser(me);
          }
        } catch {
          try {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
          } catch {
            // ignore
          }
          clearTokenCookie();
        }
      }

      if (!cancelled) setLoading(false);
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    let accessToken: string;
    let me: CurrentUser;
    try {
      const tokenResponse = await apiLogin(email, password);
      accessToken = tokenResponse.access_token;
      me = await getMe(accessToken);
    } catch (err) {
      // If the backend is unreachable or the user is not yet in the DB, fall back to a demo
      // account so official role preview always works reliably.
      const demoAccount = findDemoAccount(email, password);
      if (!demoAccount) throw err;
      accessToken = demoTokenFor(demoAccount.user);
      me = demoAccount.user;
    }

    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    } catch {
      // per-viewer convenience only — session still works for this page load without it
    }
    setTokenCookie(accessToken);
    setToken(accessToken);
    setUser(me);
  }

  function logout() {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    clearTokenCookie();
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, token, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
