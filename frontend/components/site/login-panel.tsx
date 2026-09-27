"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Users,
  Building2,
  Landmark,
  AlertTriangle,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface RoleOption {
  id: string;
  role: string;
  title: string;
  subtitle: string;
  email: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
}

const AUTHORITY_ROLES: RoleOption[] = [
  {
    id: "ministry",
    role: "MINISTRY",
    title: "Ministry / Central Authority",
    subtitle: "National monitoring & policy",
    email: "ministry_demo@mplads.gov.in",
    icon: ShieldCheck,
  },
  {
    id: "state",
    role: "STATE_NODAL",
    title: "State Nodal Authority",
    subtitle: "Regional & state-wide monitoring",
    email: "state_demo@mplads.gov.in",
    icon: Landmark,
  },
  {
    id: "district",
    role: "DISTRICT_AUTHORITY",
    title: "District Authority (DM/DC)",
    subtitle: "District approval & implementation",
    email: "district_demo@mplads.gov.in",
    icon: Building2,
  },
  {
    id: "mp",
    role: "MP",
    title: "Member of Parliament",
    subtitle: "Constituency development works",
    email: "mp_demo@mplads.gov.in",
    icon: User,
  },
];

const DEFAULT_DEMO_PASSWORD = "Demo@123";

export function LoginPanel() {
  const router = useRouter();
  const { login } = useAuth();

  const [selectedRole, setSelectedRole] = useState<string>("ministry");
  const [email, setEmail] = useState<string>("ministry_demo@mplads.gov.in");
  const [password, setPassword] = useState<string>(DEFAULT_DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Rate-limiting countdown
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  function handleSelectRole(role: RoleOption) {
    setSelectedRole(role.id);
    setEmail(role.email);
    setPassword(DEFAULT_DEMO_PASSWORD);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          setError("Rate limit exceeded: Too many attempts. Temporary 60s security lockout activated.");
        } else {
          setError(err.message || "Invalid credentials. Please verify your official email and password.");
        }
      } else {
        setError("Unable to authenticate. Please verify your connection or credentials.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex w-full flex-col justify-between bg-[#f8f9ff] p-5 sm:p-8 lg:w-[55%] lg:p-10 xl:p-14">
      <div className="mx-auto my-auto w-full max-w-xl">
        {/* Main Login Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          {/* Authority Level Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                Select Authority Level
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Click to switch role demo</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {AUTHORITY_ROLES.map((r) => {
                const Icon = r.icon;
                const isActive = selectedRole === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={`group relative flex flex-col items-start overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${
                      isActive
                        ? "border-[#0a2540] bg-[#eaf1ff]"
                        : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100/70"
                    }`}
                  >
                    {/* Active Left Indicator Bar */}
                    <div
                      className={`absolute left-0 top-0 h-full w-1 bg-[#0a2540] transition-opacity ${
                        isActive ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <Icon
                      size={18}
                      className={`mb-1.5 ${isActive ? "text-[#0a2540]" : "text-slate-500"}`}
                      strokeWidth={2.2}
                    />
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      {r.title}
                    </span>
                    <span className="mt-0.5 text-[10px] text-slate-500 leading-tight">
                      {r.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Header inside Card */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Welcome Back
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Sign in to access your authorized monitoring dashboard.
            </p>
          </div>

          {/* Login Form */}
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-800">
                Official Email / User ID
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={lockoutSeconds > 0}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition focus:border-[#0a2540] focus:ring-2 focus:ring-[#0a2540]/10 focus:outline-none"
                  placeholder="Enter your official ID"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert("For security compliance in this demo deployment, use the role switcher cards above or credentials Demo@123.")}
                  className="text-[11px] font-medium text-[#0a2540] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={lockoutSeconds > 0}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-xs text-slate-900 placeholder:text-slate-400 transition focus:border-[#0a2540] focus:ring-2 focus:ring-[#0a2540]/10 focus:outline-none"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded border-slate-300 text-[#0a2540] focus:ring-[#0a2540]"
              />
              <label htmlFor="remember" className="select-none text-xs text-slate-600 cursor-pointer">
                Remember password
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Security Lockout Countdown */}
            {lockoutSeconds > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <span className="font-semibold">Security Lockout Active</span>
                <span className="rounded border border-amber-300 bg-white px-2 py-0.5 font-mono font-bold">
                  {lockoutSeconds}s
                </span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || lockoutSeconds > 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a2540] py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#000f22] active:scale-[0.99] disabled:opacity-50"
            >
              <span>{submitting ? "Signing In..." : "Sign In Securely"}</span>
              <ArrowRight size={15} />
            </button>

            {/* Micro Badge */}
            <div className="text-center font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Authorized Users Only • Role-Based Access
            </div>
          </form>

          {/* Secure Role-Based Access Info Card */}
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-900">
                Secure Role-Based Access
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Access to projects, financial information, and monitoring tools is restricted according to your assigned role and permissions.
              </p>
            </div>
          </div>

          {/* Public Transparency Portal Card */}
          <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0a2540]">
                <User size={14} />
                PUBLIC ACCESS
              </div>
              <div className="text-[11px] text-slate-600">
                Explore MPLADS projects, expenditure, and implementation status in your area.
              </div>
              <div className="font-mono text-[10px] text-slate-400">
                No login required for public project information.
              </div>
            </div>

            <Link
              href="/public"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 hover:text-[#0a2540]"
            >
              <span>View Public Portal</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
