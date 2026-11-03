"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { authApi, AuthUser } from "@/lib/api";

type PageMessage = {
  tone: "success" | "error";
  text: string;
};

export default function AdminUsersPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <AdminUsersContent />
      </AppShell>
    </ProtectedRoute>
  );
}

function AdminUsersContent() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState("");
  const [message, setMessage] = useState<PageMessage | null>(null);

  async function refreshUsers() {
    setLoading(true);
    setMessage(null);

    try {
      setUsers(await authApi.getUsers());
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to load users",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "ADMIN") {
      void refreshUsers();
    } else {
      setLoading(false);
    }
  }, [user?.role]);

  async function handleToggleUser(account: AuthUser) {
    setBusyUserId(account.id);
    setMessage(null);

    try {
      const updatedUser = account.isActive
        ? await authApi.deactivateUser(account.id)
        : await authApi.activateUser(account.id);
      setUsers((current) =>
        current.map((item) => (item.id === updatedUser.id ? updatedUser : item)),
      );
      setMessage({
        tone: "success",
        text: updatedUser.isActive ? "User activated." : "User deactivated.",
      });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to update user",
      });
    } finally {
      setBusyUserId("");
    }
  }

  async function handleDeleteUser(account: AuthUser) {
    setBusyUserId(account.id);
    setMessage(null);

    try {
      await authApi.deleteUser(account.id);
      setUsers((current) => current.filter((item) => item.id !== account.id));
      setMessage({ tone: "success", text: "User removed." });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to remove user",
      });
    } finally {
      setBusyUserId("");
    }
  }

  if (user?.role !== "ADMIN") {
    return (
      <main className="pb-5 pt-2">
        <section className="rounded-card bg-white p-4 shadow-soft">
          <h1 className="text-xl font-bold text-foreground">Admin access required</h1>
          <p className="mt-2 text-sm font-semibold text-muted">
            Only admins can manage users.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-4 pb-5">
      <header className="flex items-end justify-between gap-4 pt-2">
        <div>
          <p className="text-sm font-bold text-blue">Admin</p>
          <h1 className="mt-1 text-3xl font-bold text-foreground">Users</h1>
          <p className="mt-2 text-sm font-semibold text-muted">
            View, deactivate, activate, or remove user accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshUsers()}
          className="rounded-md border border-blue/20 bg-white px-4 py-2 text-sm font-bold text-blue shadow-soft"
        >
          Refresh
        </button>
      </header>

      {message ? (
        <p
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            message.tone === "success"
              ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
              : "border-danger/20 bg-[#FEF2F2] text-danger"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-card border border-border bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-soft text-xs font-bold uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 font-semibold text-muted" colSpan={5}>
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 font-semibold text-muted" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((account) => (
                  <tr key={account.id} className="hover:bg-slate-soft/60">
                    <td className="px-4 py-3 font-bold text-foreground">{account.fullName}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{account.email}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{account.role}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          account.isActive
                            ? "bg-[#DCFCE7] text-[#166534]"
                            : "bg-[#FEE2E2] text-[#991B1B]"
                        }`}
                      >
                        {account.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleUser(account)}
                          disabled={busyUserId === account.id}
                          className="h-9 rounded-md border border-blue/20 px-4 text-xs font-bold text-blue disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {account.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteUser(account)}
                          disabled={busyUserId === account.id}
                          className="h-9 rounded-md border border-danger/20 px-4 text-xs font-bold text-danger disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
