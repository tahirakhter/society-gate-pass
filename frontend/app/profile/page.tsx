"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { authApi, HouseRecord } from "@/lib/api";
import { formatHouseLabel } from "@/lib/house-labels";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [houses, setHouses] = useState<HouseRecord[]>([]);
  const [loadingHouses, setLoadingHouses] = useState(false);
  const [housesError, setHousesError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadHouses() {
      if (!user) {
        setHouses([]);
        return;
      }

      if (user.role !== "OWNER") {
        setHouses([]);
        setLoadingHouses(false);
        setHousesError("");
        return;
      }

      setLoadingHouses(true);
      setHousesError("");

      try {
        const ownedHouses = await authApi.getMyHouses();
        if (active) {
          setHouses(ownedHouses);
        }
      } catch (err) {
        if (active) {
          setHousesError(err instanceof Error ? err.message : "Unable to load houses");
        }
      } finally {
        if (active) {
          setLoadingHouses(false);
        }
      }
    }

    void loadHouses();

    return () => {
      active = false;
    };
  }, [user]);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");

    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : "Unable to log out");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <AppShell>
      <main className="space-y-5 pb-5">
        <header className="flex items-start justify-between gap-4 pt-2">
          <div>
            <p className="text-sm font-bold text-blue">Account</p>
            <h1 className="mt-1 text-3xl font-bold tracking-normal text-foreground">Profile</h1>
            <p className="mt-2 text-sm font-medium text-muted">
              Your account access and session controls.
            </p>
          </div>
        </header>

        {loading ? (
          <section className="rounded-card bg-white p-4 shadow-soft">
            <p className="text-sm font-semibold text-muted">Checking your session...</p>
          </section>
        ) : user ? (
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <section className="space-y-4">
              <article className="rounded-card bg-white p-4 shadow-soft">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue text-xl font-black text-white shadow-blue">
                    {getInitials(user.fullName)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold text-foreground">{user.fullName}</h2>
                    <p className="truncate text-sm font-semibold text-muted">{user.email}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <ProfileMetric label="Role" value={user.role} />
                  {user.role === "OWNER" ? (
                    <ProfileMetric label="Homes" value={String(houses.length)} />
                  ) : (
                    <ProfileMetric label="Session" value="Active" />
                  )}
                </div>

                {logoutError ? (
                  <p className="mt-4 rounded-lg border border-danger/20 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-danger">
                    {logoutError}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="mt-4 h-[52px] w-full rounded-md bg-blue text-sm font-bold text-white shadow-blue transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loggingOut ? "Logging out..." : "Log out"}
                </button>
              </article>

              <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <ProfileField label="Full name" value={user.fullName} />
                <ProfileField label="Email" value={user.email} />
                <ProfileField label="Session" value="Active" />
              </section>
            </section>

            {user.role === "OWNER" ? (
              <section className="space-y-3">
              <div>
                <h2 className="text-xl font-bold tracking-normal text-foreground">
                  Assigned houses
                </h2>
                <p className="mt-1 text-sm text-muted">
                  All homes linked with your owner account.
                </p>
              </div>

              {housesError ? (
                <p className="rounded-lg border border-danger/20 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-danger">
                  {housesError}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {loadingHouses ? (
                  <p className="rounded-card bg-white p-4 text-sm font-semibold text-muted shadow-soft">
                    Loading houses...
                  </p>
                ) : houses.length === 0 ? (
                  <p className="rounded-card bg-white p-4 text-sm font-semibold text-muted shadow-soft">
                    No houses are assigned yet.
                  </p>
                ) : (
                  houses.map((house) => <HouseCard key={house.id} house={house} />)
                )}
              </div>
            </section>
            ) : null}
          </div>
        ) : (
          <section className="rounded-card bg-white p-4 shadow-soft">
            <h2 className="text-xl font-bold text-foreground">You are signed out</h2>
            <p className="mt-2 text-sm font-medium text-muted">
              Sign in to view your houses and manage visitor passes.
            </p>
            <Link
              href="/login?redirect=%2Fprofile"
              className="mt-5 flex h-[52px] w-full items-center justify-center rounded-md bg-blue text-sm font-bold text-white shadow-blue transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] sm:w-48"
            >
              Log in
            </Link>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-soft px-3 py-2">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-1 text-base font-bold text-foreground">{value}</p>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-card bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-2 break-words text-base font-bold text-foreground">{value}</p>
    </article>
  );
}

function HouseCard({ house }: { house: HouseRecord }) {
  return (
    <article className="rounded-card bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-muted">House</p>
          <h3 className="mt-1 text-xl font-bold text-foreground">{formatHouseLabel(house)}</h3>
        </div>
        <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold text-[#166534]">
          Assigned
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <ProfileMetric label="Number" value={house.houseNumber} />
        <ProfileMetric label="Block" value={house.block || "None"} />
      </div>
    </article>
  );
}
