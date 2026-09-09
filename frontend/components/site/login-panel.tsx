"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const roles = [
  { id: "mp", title: "MP", email: "mp_demo@mplads.gov.in" },
  { id: "district", title: "District Authority", email: "district_demo@mplads.gov.in" },
  { id: "state", title: "State Nodal", email: "state_demo@mplads.gov.in" },
  { id: "ministry", title: "Ministry", email: "ministry_demo@mplads.gov.in" },
] as const;
const DEMO_PASSWORD = "Demo@123";

export function LoginPanel() {
  const router = useRouter();
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<(typeof roles)[number]["id"]>("ministry");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function selectRole(id: (typeof roles)[number]["id"]) {
    setSelectedRole(id);
    const role = roles.find((r) => r.id === id)!;
    setEmail(role.email);
    setPassword(DEMO_PASSWORD);
  }

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
    <section className="flex w-full items-center justify-center bg-dashboard-surface px-5 py-8 sm:px-10 lg:w-[42%] lg:px-12 lg:py-14">
      <div className="w-full max-w-md rounded-lg border border-dashboard-line bg-white p-7 shadow-[0_1px_5px_rgba(20,40,70,0.06)]">
        <div className="mb-6 flex rounded-full border border-dashboard-line bg-dashboard-surface p-[3px]">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => selectRole(role.id)}
              aria-pressed={selectedRole === role.id}
              className={`flex-1 rounded-full px-2 py-2 text-xs transition-colors ${
                selectedRole === role.id
                  ? "border border-dashboard-line bg-white text-dashboard-ink shadow-sm"
                  : "border border-transparent text-dashboard-muted hover:text-dashboard-ink"
              }`}
            >
              {role.title}
            </button>
          ))}
        </div>

        <h2 className="font-display text-xl font-semibold text-dashboard-ink">Sign in</h2>
        <p className="mt-1 mb-6 text-sm text-dashboard-muted">Enter your official credentials to open your monitoring console.</p>

        <form className="space-y-3.5" onSubmit={handleSubmit}>
          <label className="block text-xs text-dashboard-muted">
            Official email
            <div className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-dashboard-line bg-dashboard-surface px-3 py-2.5 transition-colors focus-within:border-dashboard-navy/60">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0 opacity-55">
                <path d="M1.5 3.5h12v8h-12v-8Z" stroke="#092541" strokeWidth="1.1" />
                <path d="M1.5 3.5 7.5 8l6-4.5" stroke="#092541" strokeWidth="1.1" />
              </svg>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-sm text-dashboard-ink outline-none placeholder:text-dashboard-muted"
                placeholder="you@mplads.gov.in"
                required
                type="email"
                autoComplete="email"
              />
            </div>
          </label>

          <label className="block text-xs text-dashboard-muted">
            Password
            <div className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-dashboard-line bg-dashboard-surface px-3 py-2.5 transition-colors focus-within:border-dashboard-navy/60">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0 opacity-55">
                <rect x="3" y="6.5" width="9" height="6" rx="1" stroke="#092541" strokeWidth="1.1" />
                <path d="M5 6.5V4.5a2.5 2.5 0 0 1 5 0v2" stroke="#092541" strokeWidth="1.1" />
              </svg>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-sm text-dashboard-ink outline-none placeholder:text-dashboard-muted"
                placeholder="••••••••••"
                required
                type="password"
                autoComplete="current-password"
              />
            </div>
          </label>

          {error && (
            <p className="rounded-md border border-dashboard-red/20 bg-dashboard-red/5 px-3 py-2 text-center text-xs text-dashboard-red">{error}</p>
          )}

          <button
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-dashboard-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-dashboard-deep disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="rounded-md border border-dashboard-line bg-dashboard-surface px-3 py-2 text-center text-[11px] text-dashboard-muted">
            Pick a role above to autofill its demo account — password <code className="font-console-mono text-dashboard-ink">{DEMO_PASSWORD}</code> for all four
          </p>
        </form>

        <div className="mt-5 flex gap-2.5 border-t border-dashboard-line pt-4 text-[11px] leading-5 text-dashboard-muted">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0 opacity-60">
            <path d="M7 1.5 12 3.3v3.4c0 3.1-2.1 5.6-5 6.3-2.9-.7-5-3.2-5-6.3V3.3L7 1.5Z" stroke="#092541" strokeWidth="1.1" />
            <path d="M4.8 7.1l1.5 1.5 3-3.2" stroke="#092541" strokeWidth="1.1" />
          </svg>
          <span>Every sign-in and query against this console is logged for audit.</span>
        </div>

        <Link
          href="/public"
          className="mt-3 block text-center text-xs text-dashboard-muted underline decoration-dashboard-line underline-offset-4 hover:text-dashboard-ink"
        >
          Looking for the public version? View the transparency portal.
        </Link>
      </div>
    </section>
  );
}
