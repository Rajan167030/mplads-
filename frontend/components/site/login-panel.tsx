"use client";

import { ArrowRight, Landmark, ShieldCheck, User, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const roles = [
  { id: "mp", title: "MP", email: "mp_demo@mplads.gov.in", icon: User },
  { id: "district", title: "District Authority", email: "district_demo@mplads.gov.in", icon: Users },
  { id: "state", title: "State Nodal", email: "state_demo@mplads.gov.in", icon: Landmark },
  { id: "ministry", title: "Ministry", email: "ministry_demo@mplads.gov.in", icon: ShieldCheck },
] as const;
const DEMO_PASSWORD = "Demo@123";

export function LoginPanel() {
  const router = useRouter();
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<(typeof roles)[number]["id"]>("ministry");
  const [email, setEmail] = useState("ministry_demo@mplads.gov.in");
  const [password, setPassword] = useState(DEMO_PASSWORD);
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
      // Landing page must never surface backend/infra status — a network
      // failure and a real rejection get the same neutral copy here.
      setError(err instanceof ApiError ? err.message : "Sign-in failed. Please check your email and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="relative flex w-full items-stretch justify-center overflow-hidden bg-dashboard-surface p-5 sm:p-8 lg:w-1/2 lg:p-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(50% 45% at 50% 0%, rgba(9,37,65,0.05), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-dashboard-line bg-white p-8 shadow-2xl shadow-dashboard-navy/[0.10] sm:p-10">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
          style={{ background: "linear-gradient(90deg, #092541 0%, #8dfc75 100%)" }}
          aria-hidden="true"
        />
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full opacity-[0.09] blur-3xl"
          style={{ background: "radial-gradient(circle, #8dfc75, transparent 70%)" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full opacity-[0.05] blur-3xl"
          style={{ background: "radial-gradient(circle, #092541, transparent 70%)" }}
          aria-hidden="true"
        />

        <div className="relative m-auto w-full max-w-md">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-dashboard-lime/30 bg-dashboard-lime/10 px-3 py-1 text-xs font-medium text-dashboard-deep">
            <span className="size-1.5 rounded-full bg-dashboard-lime" aria-hidden="true" />
            Secure government access
          </span>

          <div className="mb-8 flex items-center gap-3.5">
            <span
              className="login-icon-pulse grid size-14 shrink-0 place-items-center rounded-2xl border border-dashboard-lime/30 bg-dashboard-navy text-dashboard-lime shadow-md shadow-dashboard-navy/20"
              aria-hidden="true"
            >
              <ShieldCheck size={24} strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold text-dashboard-ink sm:text-[26px]">Sign in</h2>
              <p className="text-sm text-dashboard-muted">Official monitoring console access</p>
            </div>
          </div>

          <div className="mb-7 grid grid-cols-2 gap-2 rounded-2xl border border-dashboard-line bg-dashboard-surface p-2 sm:grid-cols-4">
            {roles.map((role) => {
              const Icon = role.icon;
              const active = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-all ${
                    active
                      ? "scale-[1.02] bg-dashboard-navy text-white shadow-md shadow-dashboard-navy/25"
                      : "text-dashboard-muted hover:bg-white hover:text-dashboard-ink"
                  }`}
                >
                  <Icon size={17} strokeWidth={2.2} className={active ? "text-dashboard-lime" : "opacity-70"} />
                  {role.title}
                </button>
              );
            })}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-xs font-medium text-dashboard-muted">
              Official email
              <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-dashboard-line bg-dashboard-surface px-4 py-3 transition-colors focus-within:border-dashboard-navy/60 focus-within:ring-4 focus-within:ring-dashboard-navy/[0.06]">
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

            <label className="block text-xs font-medium text-dashboard-muted">
              Password
              <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-dashboard-line bg-dashboard-surface px-4 py-3 transition-colors focus-within:border-dashboard-navy/60 focus-within:ring-4 focus-within:ring-dashboard-navy/[0.06]">
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
              className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-dashboard-navy py-3.5 text-sm font-semibold text-white shadow-lg shadow-dashboard-navy/25 transition-all hover:-translate-y-0.5 hover:bg-dashboard-deep hover:shadow-xl hover:shadow-dashboard-navy/30 disabled:opacity-60 disabled:hover:translate-y-0"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
              {!submitting && (
                <ArrowRight size={16} strokeWidth={2.4} className="transition-transform group-hover:translate-x-0.5" />
              )}
            </button>

            <p className="rounded-xl border border-dashboard-line bg-dashboard-surface px-4 py-2.5 text-center text-xs text-dashboard-muted">
              Pick a role above to preview its console — password <code className="font-console-mono text-dashboard-ink">{DEMO_PASSWORD}</code> for all four
            </p>
          </form>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="flex gap-2.5 border-t border-dashboard-line pt-4 text-xs leading-5 text-dashboard-muted">
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
      </div>
    </section>
  );
}
