"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const roles = [
  { id: "central", icon: "▥", title: "Ministry / Central Authority", detail: "National monitoring" },
  { id: "state", icon: "⌂", title: "State / District Authority", detail: "Regional monitoring" },
  { id: "mp", icon: "▣", title: "Member of Parliament", detail: "Constituency monitoring" },
] as const;

export function LoginPanel() {
  const router = useRouter();
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<(typeof roles)[number]["id"]>("central");
  const [showPassword, setShowPassword] = useState(false);
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
    <section className="flex w-full items-center justify-center bg-surface px-5 py-8 sm:px-10 lg:w-[56%] lg:px-14 lg:py-0">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-panel p-4 shadow-[0_18px_50px_rgba(17,43,71,0.08)] sm:p-5 lg:p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink">Select Authority Level</div>
        <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {roles.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={`relative h-17 rounded-lg border-2 p-1.5 text-left transition-colors ${
                  isSelected ? "border-navy bg-[#edf4ff]" : "border-line bg-[#f1f5fb] hover:border-navy/50"
                }`}
                aria-pressed={isSelected}
              >
                <span className="block text-base leading-none text-navy" aria-hidden="true">
                  {role.icon}
                </span>
                <span className="mt-0.5 block text-[11px] font-bold leading-tight text-ink">{role.title}</span>
                <span className="mt-0.5 block text-[9px] text-muted-foreground">{role.detail}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <h2 className="font-display text-2xl font-semibold text-ink">Welcome Back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to access your authorized monitoring dashboard.</p>
        </div>

        <form className="mt-3 space-y-1.5" onSubmit={handleSubmit}>
          <label className="block text-xs font-semibold text-ink">
            Official Email / User ID
            <span className="relative mt-1.5 block">
              <span
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
                aria-hidden="true"
              >
                ◎
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-line bg-white py-1.5 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/10"
                placeholder="Enter your official email"
                required
                type="email"
                autoComplete="email"
              />
            </span>
          </label>

          <label className="block text-xs font-semibold text-ink">
            <span className="flex items-center justify-between">Password</span>
            <span className="relative mt-1.5 block">
              <span
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
                aria-hidden="true"
              >
                ▣
              </span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-line bg-white py-1.5 pl-9 pr-10 text-sm text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/10"
                placeholder="Enter your password"
                required
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 text-sm text-muted-foreground hover:text-ink"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "◉" : "◌"}
              </button>
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="size-4 accent-navy" /> Remember password
          </label>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-center text-[11px] font-medium text-red-700">{error}</p>
          )}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy py-2 text-sm font-semibold text-white shadow-md transition hover:bg-navy-deep disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign In Securely"} {!submitting && <span aria-hidden="true">→</span>}
          </button>
          <div className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Authorized users only • Role-based access
          </div>
          <p className="rounded-md bg-[#f1f5fb] px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">
            Demo accounts: admin@mplads.gov.in / analyst@mplads.gov.in / officer@mplads.gov.in /
            viewer@mplads.gov.in — password <code className="font-mono">MpladsDemo123!</code>
          </p>
        </form>

        <div className="mt-2 flex gap-3 rounded-lg border border-line bg-[#f1f5fb] p-1.5">
          <span className="text-lg text-lime-dark" aria-hidden="true">
            ✓
          </span>
          <div>
            <div className="text-xs font-bold text-ink">Secure Role-Based Access</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Access to projects, financial information, and monitoring tools is restricted according to your
              assigned role and permissions.
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 border-t border-line pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold text-ink">♙ PUBLIC ACCESS</div>
            <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
              Explore MPLADS projects, expenditure, and implementation status in your area.
            </p>
            <span className="text-[10px] text-muted-foreground">No login required for public project information.</span>
          </div>
          <button
            type="button"
            disabled
            title="Public transparency portal is planned for a later phase"
            className="shrink-0 cursor-not-allowed rounded-lg border border-line bg-[#e8f0fc] px-3 py-2.5 text-xs font-semibold text-ink opacity-60"
          >
            View Public Transparency Portal →
          </button>
        </div>
      </div>
    </section>
  );
}
