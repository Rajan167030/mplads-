"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, createUser, listUsers, updateUser, type ManagedUser } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const ROLES = ["ADMIN", "OFFICER", "ANALYST", "VIEWER"];

export default function UsersPage() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("VIEWER");
  const isAdmin = user?.role === "ADMIN";

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setUsers(await listUsers(token));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the backend API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      await createUser(token, { email: email.trim(), full_name: fullName.trim(), password, role });
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("VIEWER");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create user.");
    }
  }

  async function handleRoleChange(id: string, newRole: string) {
    if (!token) return;
    try {
      await updateUser(token, id, { role: newRole });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update user.");
    }
  }

  async function handleToggleActive(u: ManagedUser) {
    if (!token) return;
    try {
      await updateUser(token, u.id, { is_active: !u.is_active });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update user.");
    }
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">User Management</h1>
        <p className="mt-1 text-sm text-dashboard-muted">
          Create accounts and manage role-based access (ADMIN / OFFICER / ANALYST / VIEWER). ADMIN only.
        </p>

        {!user && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Link href="/" className="font-semibold underline">
              Sign in
            </Link>{" "}
            as an ADMIN to manage users.
          </div>
        )}
        {user && !isAdmin && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Your role ({user.role}) can&apos;t manage users — ADMIN only.
          </div>
        )}

        {isAdmin && (
          <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
            <label className="text-xs font-semibold">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-64 rounded border border-dashboard-line px-2 py-1.5 text-sm"
                required
              />
            </label>
            <label className="text-xs font-semibold">
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-48 rounded border border-dashboard-line px-2 py-1.5 text-sm"
                required
              />
            </label>
            <label className="text-xs font-semibold">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-40 rounded border border-dashboard-line px-2 py-1.5 text-sm"
                required
                minLength={8}
              />
            </label>
            <label className="text-xs font-semibold">
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 block rounded border border-dashboard-line px-2 py-1.5 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded bg-dashboard-navy px-4 py-2 text-sm font-semibold text-white hover:bg-dashboard-deep">
              Create user
            </button>
          </form>
        )}

        {error && <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && users.length === 0 && !error && <p className="mt-6 text-sm text-dashboard-muted">No users yet.</p>}

        {users.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-dashboard-line text-left text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-dashboard-line/60 last:border-0">
                    <td className="px-4 py-3 font-semibold">{u.full_name}</td>
                    <td className="px-4 py-3 text-dashboard-muted">{u.email}</td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="rounded border border-dashboard-line px-2 py-1 text-[11px] font-bold"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded border border-dashboard-line px-2 py-0.5 text-[10px] font-bold">{u.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={u.id === user?.id}
                          className={`rounded border px-2 py-0.5 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                            u.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                          }`}
                          title={u.id === user?.id ? "You can't deactivate your own account" : "Toggle active status"}
                        >
                          {u.is_active ? "ACTIVE" : "INACTIVE"}
                        </button>
                      ) : (
                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-bold ${
                            u.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          {u.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-dashboard-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
