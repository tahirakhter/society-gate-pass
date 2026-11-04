"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AIVisitorPassCard } from "@/components/ai-visitor-pass-card";
import { PassDetailsDialog } from "@/components/pass-details-dialog";
import { StatusBadge } from "@/components/status-badge";
import {
  authApi,
  AuthUser,
  HouseRecord,
  UserRole,
  VisitTokenRecord,
  VisitTokenValidationResult,
} from "@/lib/api";
import { mapVisitTokenToVisitorPass, VisitorPass } from "@/lib/visit-pass-mapper";

const ADMIN_PASSES_PER_PAGE = 10;

type AdminMessage = {
  tone: "success" | "error";
  text: string;
};

export function AdminDashboard() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [houses, setHouses] = useState<HouseRecord[]>([]);
  const [passes, setPasses] = useState<VisitTokenRecord[]>([]);
  const [passPage, setPassPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<AdminMessage | null>(null);
  const [selectedPass, setSelectedPass] = useState<VisitorPass | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingHouse, setCreatingHouse] = useState(false);
  const [deactivatingPassId, setDeactivatingPassId] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<VisitTokenValidationResult | null>(null);
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "OWNER" as UserRole,
  });
  const [houseForm, setHouseForm] = useState({
    houseNumber: "",
    block: "",
    ownerId: "",
  });
  const [tokenCode, setTokenCode] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage(null);

    try {
      const [nextUsers, nextHouses, nextPasses] = await Promise.all([
        authApi.getUsers(),
        authApi.getAllHouses(),
        authApi.getAllVisitTokens(),
      ]);
      setUsers(nextUsers);
      setHouses(nextHouses);
      setPasses(nextPasses);
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to load admin data",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingUser(true);
    setMessage(null);

    try {
      await authApi.createUser(userForm);
      setUserForm({ fullName: "", email: "", password: "", role: "OWNER" });
      setMessage({ tone: "success", text: "User created successfully." });
      await refresh();
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to create user",
      });
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleCreateHouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingHouse(true);
    setMessage(null);

    try {
      await authApi.createHouse({
        houseNumber: houseForm.houseNumber,
        block: houseForm.block || undefined,
        ownerId: houseForm.ownerId,
      });
      setHouseForm({ houseNumber: "", block: "", ownerId: "" });
      setMessage({ tone: "success", text: "House assigned successfully." });
      await refresh();
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to create house",
      });
    } finally {
      setCreatingHouse(false);
    }
  }

  async function handleDeactivatePass(passId: string) {
    setDeactivatingPassId(passId);
    setMessage(null);

    try {
      const updatedPass = await authApi.adminDeactivateVisitToken(passId);
      setPasses((current) =>
        current.map((pass) => (pass.id === updatedPass.id ? updatedPass : pass)),
      );
      setMessage({ tone: "success", text: "Pass deactivated." });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to deactivate pass",
      });
    } finally {
      setDeactivatingPassId("");
    }
  }

  async function handleValidatePass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidating(true);
    setValidationResult(null);
    setMessage(null);

    try {
      const result = await authApi.validateVisitToken({ tokenCode });
      setValidationResult(result);
      setTokenCode("");
      await refresh();
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to validate pass",
      });
    } finally {
      setValidating(false);
    }
  }

  const owners = users.filter((user) => user.role === "OWNER");
  const passPageCount = Math.max(1, Math.ceil(passes.length / ADMIN_PASSES_PER_PAGE));
  const visiblePasses = useMemo(
    () => passes.slice((passPage - 1) * ADMIN_PASSES_PER_PAGE, passPage * ADMIN_PASSES_PER_PAGE),
    [passPage, passes],
  );
  const firstVisiblePass = passes.length ? (passPage - 1) * ADMIN_PASSES_PER_PAGE + 1 : 0;
  const lastVisiblePass = Math.min(passPage * ADMIN_PASSES_PER_PAGE, passes.length);

  useEffect(() => {
    setPassPage((current) => Math.min(current, passPageCount));
  }, [passPageCount]);

  return (
    <main className="space-y-5 pb-5">
      <header className="pt-2">
        <p className="text-sm font-bold text-blue">Admin</p>
        <h1 className="mt-1 text-3xl font-bold tracking-normal text-foreground">
          Society control
        </h1>
        <p className="mt-2 text-sm font-medium text-muted">
          Create users, assign homes, review all passes, deactivate, and validate entries.
        </p>
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

      <section className="grid gap-4 lg:grid-cols-3">
        <AdminMetric label="Users" value={String(users.length)} />
        <AdminMetric label="Homes" value={String(houses.length)} />
        <AdminMetric label="Passes" value={String(passes.length)} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold tracking-normal text-foreground">AI Assistant</h2>
          <p className="mt-1 text-sm text-muted">Search visitor data and review entry logs.</p>
        </div>
        <AIVisitorPassCard mode="admin" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={handleCreateUser} className="rounded-card bg-white p-4 shadow-soft">
          <h2 className="text-xl font-bold text-foreground">Create user</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={userForm.fullName}
              onChange={(event) =>
                setUserForm((current) => ({ ...current, fullName: event.target.value }))
              }
              placeholder="Full name"
              required
              className="h-[48px] rounded-lg border border-border bg-slate-soft px-4 text-sm font-medium outline-none focus:border-blue"
            />
            <input
              value={userForm.email}
              onChange={(event) =>
                setUserForm((current) => ({ ...current, email: event.target.value }))
              }
              type="email"
              placeholder="Email"
              required
              className="h-[48px] rounded-lg border border-border bg-slate-soft px-4 text-sm font-medium outline-none focus:border-blue"
            />
            <input
              value={userForm.password}
              onChange={(event) =>
                setUserForm((current) => ({ ...current, password: event.target.value }))
              }
              type="password"
              minLength={8}
              placeholder="Password"
              required
              className="h-[48px] rounded-lg border border-border bg-slate-soft px-4 text-sm font-medium outline-none focus:border-blue"
            />
            <select
              value={userForm.role}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  role: event.target.value as UserRole,
                }))
              }
              className="h-[48px] rounded-lg border border-border bg-slate-soft px-4 text-sm font-medium outline-none focus:border-blue"
            >
              <option value="OWNER">Owner</option>
              <option value="SECURITY">Security</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creatingUser}
            className="mt-4 h-[48px] w-full rounded-md bg-blue text-sm font-bold text-white shadow-blue disabled:opacity-50"
          >
            {creatingUser ? "Creating..." : "Create user"}
          </button>
        </form>

        <form onSubmit={handleCreateHouse} className="rounded-card bg-white p-4 shadow-soft">
          <h2 className="text-xl font-bold text-foreground">Create home</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={houseForm.houseNumber}
              onChange={(event) =>
                setHouseForm((current) => ({ ...current, houseNumber: event.target.value }))
              }
              placeholder="House number"
              required
              className="h-[48px] rounded-lg border border-border bg-slate-soft px-4 text-sm font-medium outline-none focus:border-blue"
            />
            <input
              value={houseForm.block}
              onChange={(event) =>
                setHouseForm((current) => ({ ...current, block: event.target.value }))
              }
              placeholder="Block optional"
              className="h-[48px] rounded-lg border border-border bg-slate-soft px-4 text-sm font-medium outline-none focus:border-blue"
            />
            <select
              value={houseForm.ownerId}
              onChange={(event) =>
                setHouseForm((current) => ({ ...current, ownerId: event.target.value }))
              }
              required
              className="h-[48px] rounded-lg border border-border bg-slate-soft px-4 text-sm font-medium outline-none focus:border-blue sm:col-span-2"
            >
              <option value="">Select owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.fullName} • {owner.email}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creatingHouse || owners.length === 0}
            className="mt-4 h-[48px] w-full rounded-md bg-blue text-sm font-bold text-white shadow-blue disabled:opacity-50"
          >
            {creatingHouse ? "Assigning..." : "Create home"}
          </button>
        </form>
      </section>

      <form onSubmit={handleValidatePass} className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="text-xl font-bold text-foreground">Validate pass</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={tokenCode}
            onChange={(event) => setTokenCode(event.target.value)}
            placeholder="QR token payload"
            required
            className="h-[48px] min-w-0 flex-1 rounded-lg border border-border bg-slate-soft px-4 text-sm font-medium outline-none focus:border-blue"
          />
          <button
            type="submit"
            disabled={validating}
            className="h-[48px] rounded-md bg-blue px-6 text-sm font-bold text-white shadow-blue disabled:opacity-50"
          >
            {validating ? "Validating..." : "Validate"}
          </button>
        </div>
        {validationResult ? (
          <p
            className={`mt-4 rounded-lg px-4 py-3 text-sm font-semibold ${
              validationResult.approved
                ? "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
                : "border border-danger/20 bg-[#FEF2F2] text-danger"
            }`}
          >
            {validationResult.approved
              ? `Entry approved for ${validationResult.token?.visitor.fullName || "visitor"}.`
              : validationResult.failureReason || "Entry denied."}
          </p>
        ) : null}
      </form>

      <section className="overflow-hidden rounded-card border border-border bg-white shadow-soft">
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <h2 className="text-xl font-bold text-foreground">All visitor passes</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-blue/20 px-4 py-2 text-sm font-bold text-blue"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-soft text-xs font-bold uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Visitor</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Home</th>
                <th className="px-4 py-3">Car</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 font-semibold text-muted" colSpan={7}>
                    Loading passes...
                  </td>
                </tr>
              ) : visiblePasses.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 font-semibold text-muted" colSpan={7}>
                    No passes yet.
                  </td>
                </tr>
              ) : (
                visiblePasses.map((pass) => (
                  <tr key={pass.id} className="hover:bg-slate-soft/60">
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">{pass.visitor.fullName}</p>
                      <p className="text-xs font-semibold text-muted">{pass.visitor.cnic}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {pass.house.owner?.fullName || "Unknown"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {pass.house.houseNumber}
                      {pass.house.block ? ` • Block ${pass.house.block}` : ""}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{pass.carNumber}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {formatDate(pass.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={mapStatus(pass.status)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPass(mapVisitTokenToVisitorPass(pass))}
                          disabled={pass.status !== "ACTIVE"}
                          className="h-9 rounded-md bg-blue px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivatePass(pass.id)}
                          disabled={pass.status !== "ACTIVE" || deactivatingPassId === pass.id}
                          className="h-9 rounded-md border border-danger/20 px-4 text-xs font-bold text-danger disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deactivatingPassId === pass.id ? "Deactivating" : "Deactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-sm font-semibold text-muted">
            {passes.length ? `${firstVisiblePass}-${lastVisiblePass} of ${passes.length}` : "0 passes"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPassPage((page) => Math.max(1, page - 1))}
              disabled={passPage === 1}
              className="h-9 rounded-md border border-border px-4 text-xs font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <p className="text-sm font-bold text-muted">
              Page {passPage} of {passPageCount}
            </p>
            <button
              type="button"
              onClick={() => setPassPage((page) => Math.min(passPageCount, page + 1))}
              disabled={passPage === passPageCount}
              className="h-9 rounded-md border border-border px-4 text-xs font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <PassDetailsDialog pass={selectedPass} onClose={() => setSelectedPass(null)} />
    </main>
  );
}

function AdminMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-card bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
    </article>
  );
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

function mapStatus(status: VisitTokenRecord["status"]) {
  const statusMap = {
    ACTIVE: "active",
    USED: "used",
    REVOKED: "revoked",
    EXPIRED: "expired",
  } as const;

  return statusMap[status];
}
