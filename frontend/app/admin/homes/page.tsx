"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { authApi, HouseRecord } from "@/lib/api";
import { formatHouseLabel } from "@/lib/house-labels";

type PageMessage = {
  tone: "success" | "error";
  text: string;
};

export default function AdminHomesPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <AdminHomesContent />
      </AppShell>
    </ProtectedRoute>
  );
}

function AdminHomesContent() {
  const { user } = useAuth();
  const [houses, setHouses] = useState<HouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyHouseId, setBusyHouseId] = useState("");
  const [message, setMessage] = useState<PageMessage | null>(null);

  async function refreshHouses() {
    setLoading(true);
    setMessage(null);

    try {
      setHouses(await authApi.getAllHouses());
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to load homes",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "ADMIN") {
      void refreshHouses();
    } else {
      setLoading(false);
    }
  }, [user?.role]);

  async function handleDeleteHouse(house: HouseRecord) {
    setBusyHouseId(house.id);
    setMessage(null);

    try {
      await authApi.deleteHouse(house.id);
      setHouses((current) => current.filter((item) => item.id !== house.id));
      setMessage({ tone: "success", text: "Home removed." });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to remove home",
      });
    } finally {
      setBusyHouseId("");
    }
  }

  if (user?.role !== "ADMIN") {
    return (
      <main className="pb-5 pt-2">
        <section className="rounded-card bg-white p-4 shadow-soft">
          <h1 className="text-xl font-bold text-foreground">Admin access required</h1>
          <p className="mt-2 text-sm font-semibold text-muted">
            Only admins can manage homes.
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
          <h1 className="mt-1 text-3xl font-bold text-foreground">Homes</h1>
          <p className="mt-2 text-sm font-semibold text-muted">
            View homes and remove records that are no longer needed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshHouses()}
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
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-soft text-xs font-bold uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Home</th>
                <th className="px-4 py-3">House number</th>
                <th className="px-4 py-3">Block</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 font-semibold text-muted" colSpan={7}>
                    Loading homes...
                  </td>
                </tr>
              ) : houses.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 font-semibold text-muted" colSpan={7}>
                    No homes found.
                  </td>
                </tr>
              ) : (
                houses.map((house) => (
                  <tr key={house.id} className="hover:bg-slate-soft/60">
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">{formatHouseLabel(house)}</p>
                      <p className="mt-0.5 text-xs font-semibold text-blue">Assigned</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {house.houseNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {house.block || "None"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {house.owner?.fullName || "Unknown"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {house.owner?.email || "Unknown"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {formatDate(house.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDeleteHouse(house)}
                        disabled={busyHouseId === house.id}
                        className="h-9 rounded-md border border-danger/20 px-4 text-xs font-bold text-danger disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busyHouseId === house.id ? "Removing..." : "Remove"}
                      </button>
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

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
  }).format(new Date(dateValue));
}
