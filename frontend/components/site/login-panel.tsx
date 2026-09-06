"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const roles = [
  { id: "central", title: "Ministry" },
  { id: "state", title: "State / District" },
  { id: "mp", title: "Member of Parliament" },
] as const;

export function LoginPanel() {
  const router = useRouter();
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<(typeof roles)[number]["id"]>("central");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Is the backend running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex w-full items-center justify-center bg-console-bg px-5 py-8 sm:px-10 lg:w-[42%] lg:px-12 lg:py-14">
      <div className="w-full max-w-md rounded-[22px] border border-console-border bg-console-surface p-7 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="mb-6 flex rounded-full border border-console-border-soft bg-black/25 p-[3px]">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRole(role.id)}
              aria-pressed={selectedRole === role.id}
              className={`flex-1 rounded-full px-2 py-2 text-xs transition-colors ${
                selectedRole === role.id
                  ? "border border-console-border bg-console-surface-strong text-console-ink"
                  : "border border-transparent text-console-ink-faint hover:text-console-ink-muted"
              }`}
            >
              {role.title}
            </button>
          ))}
        </div>

        <h2 className="font-display text-xl font-semibold text-console-ink">Sign in</h2>
        <p className="mt-1 mb-6 text-sm text-console-ink-faint">Enter your official credentials to open your monitoring console.</p>

        <form className="space-y-3.5" onSubmit={handleSubmit}>
          <label className="block text-xs text-console-ink-muted">
            Official email
            <div className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-console-border bg-black/20 px-3 py-2.5 transition-colors focus-within:border-console-accent/60">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0 opacity-55">
                <path d="M1.5 3.5h12v8h-12v-8Z" stroke="#EDEFF5" strokeWidth="1.1" />
                <path d="M1.5 3.5 7.5 8l6-4.5" stroke="#EDEFF5" strokeWidth="1.1" />
              </svg>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-sm text-console-ink outline-none placeholder:text-console-ink-faint"
                placeholder="you@mplads.gov.in"
                required
                type="email"
                autoComplete="email"
              />
            </div>
          </label>

          <label className="block text-xs text-console-ink-muted">
            Password
            <div className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-console-border bg-black/20 px-3 py-2.5 transition-colors focus-within:border-console-accent/60">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0 opacity-55">
                <rect x="3" y="6.5" width="9" height="6" rx="1" stroke="#EDEFF5" strokeWidth="1.1" />
                <path d="M5 6.5V4.5a2.5 2.5 0 0 1 5 0v2" stroke="#EDEFF5" strokeWidth="1.1" />
              </svg>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-sm text-console-ink outline-none placeholder:text-console-ink-faint"
                placeholder="••••••••••"
                required
                type="password"
                autoComplete="current-password"
              />
            </div>
          </label>

          {error && (
            <p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-center text-xs text-red-300">{error}</p>
          )}

          <button
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-console-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8B7FF5] disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="rounded-md border border-console-border-soft bg-black/20 px-3 py-2 text-center text-[11px] text-console-ink-faint">
            Demo accounts: admin@mplads.gov.in / analyst@mplads.gov.in / officer@mplads.gov.in /
            viewer@mplads.gov.in — password <code className="font-console-mono text-console-ink-muted">MpladsDemo123!</code>
          </p>
        </form>

        <div className="mt-5 flex gap-2.5 border-t border-console-border-soft pt-4 text-[11px] leading-5 text-console-ink-faint">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0 opacity-60">
            <path d="M7 1.5 12 3.3v3.4c0 3.1-2.1 5.6-5 6.3-2.9-.7-5-3.2-5-6.3V3.3L7 1.5Z" stroke="#EDEFF5" strokeWidth="1.1" />
            <path d="M4.8 7.1l1.5 1.5 3-3.2" stroke="#EDEFF5" strokeWidth="1.1" />
          </svg>
          <span>Every sign-in and query against this console is logged for audit.</span>
        </div>

        <Link
          href="/public"
          className="mt-3 block text-center text-xs text-console-ink-muted underline decoration-console-border underline-offset-4 hover:text-console-ink"
        >
          Looking for the public version? View the transparency portal.
        </Link>
      </div>
    </section>
  );
}
