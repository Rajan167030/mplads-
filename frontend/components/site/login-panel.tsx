"use client";

import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Landmark, 
  Lock, 
  Mail, 
  ShieldAlert, 
  ShieldCheck, 
  User, 
  Users, 
  AlertTriangle 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const QUICK_ROLES = [
  { id: "mp", title: "MP Portal", email: "mp_demo@mplads.gov.in", icon: User, roleLabel: "Member of Parliament" },
  { id: "district", title: "District Authority", email: "district_demo@mplads.gov.in", icon: Users, roleLabel: "District Collector / Admin" },
  { id: "state", title: "State Nodal", email: "state_demo@mplads.gov.in", icon: Landmark, roleLabel: "State Planning Dept" },
  { id: "ministry", title: "Ministry (Central)", email: "ministry_demo@mplads.gov.in", icon: ShieldCheck, roleLabel: "MoSPI Central Authority" },
] as const;

const DEFAULT_DEMO_PASSWORD = "Demo@123";

export function LoginPanel() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"standard" | "quick">("standard");
  const [selectedRole, setSelectedRole] = useState<string>("ministry");
  const [email, setEmail] = useState("ministry_demo@mplads.gov.in");
  const [password, setPassword] = useState(DEFAULT_DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Countdown timer for rate-limiting lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  function selectRole(id: string) {
    setSelectedRole(id);
    const role = QUICK_ROLES.find((r) => r.id === id);
    if (role) {
      setEmail(role.email);
      setPassword(DEFAULT_DEMO_PASSWORD);
      setError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lockoutSeconds > 0) return;

    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.push("/dashboard");
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setLockoutSeconds(60);
          setError("Rate limit exceeded: Too many attempts. Temporary 60s lockout activated.");
        } else {
          setError(err.message || "Invalid credentials. Please check your official email and password.");
        }
      } else {
        setError("Unable to authenticate. Please verify your connection or credentials.");
      }
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

      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-dashboard-line bg-white p-6 shadow-2xl shadow-dashboard-navy/[0.10] sm:p-10">
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

        <div className="relative m-auto w-full max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full border border-dashboard-lime/30 bg-dashboard-lime/10 px-3 py-1 text-xs font-semibold text-dashboard-deep">
              <span className="size-1.5 rounded-full bg-dashboard-lime animate-pulse" aria-hidden="true" />
              Official Government Portal
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-400">
              AES-256 Auth
            </span>
          </div>

          <div className="mb-6 flex items-center gap-3.5">
            <span
              className="login-icon-pulse grid size-13 shrink-0 place-items-center rounded-2xl border border-dashboard-lime/30 bg-dashboard-navy text-dashboard-lime shadow-md shadow-dashboard-navy/20"
              aria-hidden="true"
            >
              <ShieldCheck size={26} strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold text-dashboard-ink sm:text-[25px]">Official Sign In</h2>
              <p className="text-xs text-dashboard-muted">Secure MPLADS Intelligence & Oversight Console</p>
            </div>
          </div>

          {/* Mode Tabs: Custom Official Login vs Role Quick Switcher */}
          <div className="mb-5 flex rounded-xl border border-dashboard-line bg-dashboard-surface p-1">
            <button
              type="button"
              onClick={() => setActiveTab("standard")}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                activeTab === "standard"
                  ? "bg-white text-dashboard-navy shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Custom Credentials
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("quick")}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                activeTab === "quick"
                  ? "bg-white text-dashboard-navy shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Role Switcher
            </button>
          </div>

          {/* Quick Role Switcher Grid (Only if on 'quick' tab) */}
          {activeTab === "quick" && (
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-dashboard-line bg-dashboard-surface p-2 sm:grid-cols-4">
              {QUICK_ROLES.map((role) => {
                const Icon = role.icon;
                const active = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => selectRole(role.id)}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-medium transition-all ${
                      active
                        ? "scale-[1.02] bg-dashboard-navy text-white shadow-md shadow-dashboard-navy/25"
                        : "text-dashboard-muted hover:bg-white hover:text-dashboard-ink"
                    }`}
                  >
                    <Icon size={16} strokeWidth={2.2} className={active ? "text-dashboard-lime" : "opacity-70"} />
                    <span className="truncate">{role.title}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Login Form */}
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            <label className="block text-xs font-bold text-dashboard-ink">
              Official Email Address
              <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-dashboard-line bg-dashboard-surface px-3.5 py-2.5 transition-colors focus-within:border-dashboard-navy/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-dashboard-navy/10">
                <Mail size={15} className="text-slate-400 shrink-0" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-xs text-dashboard-ink outline-none placeholder:text-dashboard-muted"
                  placeholder="officer@nic.in / @mplads.gov.in"
                  required
                  type="email"
                  autoComplete="email"
                  disabled={lockoutSeconds > 0}
                />
              </div>
            </label>

            <label className="block text-xs font-bold text-dashboard-ink">
              Security Password
              <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-dashboard-line bg-dashboard-surface px-3.5 py-2.5 transition-colors focus-within:border-dashboard-navy/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-dashboard-navy/10">
                <Lock size={15} className="text-slate-400 shrink-0" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-xs text-dashboard-ink outline-none placeholder:text-dashboard-muted"
                  placeholder="Enter your security password"
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={lockoutSeconds > 0}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-slate-400 hover:text-slate-700 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {/* Error or Rate Limit Alert */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2 animate-in fade-in duration-200">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-600" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Rate-limit lockout countdown banner */}
            {lockoutSeconds > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center justify-between">
                <span className="font-semibold">Security Lockout Active</span>
                <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-amber-300">
                  {lockoutSeconds}s
                </span>
              </div>
            )}

            <button
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-dashboard-navy py-3 text-xs font-bold text-white shadow-lg shadow-dashboard-navy/20 transition-all hover:-translate-y-0.5 hover:bg-dashboard-deep hover:shadow-xl disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
              type="submit"
              disabled={submitting || lockoutSeconds > 0}
            >
              {submitting ? "Authenticating Session…" : lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : "Authenticate & Access Console"}
              {!submitting && lockoutSeconds === 0 && (
                <ArrowRight size={15} strokeWidth={2.4} className="transition-transform group-hover:translate-x-0.5 text-dashboard-lime" />
              )}
            </button>
          </form>
        </div>

        {/* Footer Security Notice */}
        <div className="relative mx-auto mt-4 w-full max-w-md">
          <div className="flex items-center gap-2 border-t border-dashboard-line pt-3 text-[11px] text-dashboard-muted">
            <KeyRound size={13} className="shrink-0 text-dashboard-lime" />
            <span>Protected by multi-tier rate limiting, IP audit logging, &amp; RBAC enforcement.</span>
          </div>

          <Link
            href="/public"
            className="mt-2.5 block text-center text-xs font-semibold text-dashboard-navy hover:underline"
          >
            Public Transparency Portal →
          </Link>
        </div>
      </div>
    </section>
  );
}
