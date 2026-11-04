"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AIVisitorPassCard } from "@/components/ai-visitor-pass-card";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { HousesSummary } from "@/components/houses-summary";
import { ManualPassDialog } from "@/components/manual-pass-dialog";
import { PassDetailsDialog } from "@/components/pass-details-dialog";
import { ProtectedRoute } from "@/components/protected-route";
import { UpcomingVisitorCard } from "@/components/upcoming-visitor-card";
import { useVisitPasses } from "@/hooks/use-visit-passes";
import { authApi } from "@/lib/api";
import { mapVisitTokenToVisitorPass, VisitorPass, VisitorPassInput } from "@/lib/visit-pass-mapper";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-card border border-border bg-white p-3.5 shadow-soft">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </article>
  );
}

function DashboardContent() {
  const { user } = useAuth();

  if (user?.role === "ADMIN") {
    return (
      <AppShell>
        <AdminDashboard />
      </AppShell>
    );
  }

  if (user?.role === "SECURITY") {
    return <SecurityDashboard />;
  }

  return <OwnerDashboard />;
}

function SecurityDashboard() {
  const [passes, setPasses] = useState<VisitorPass[]>([]);
  const [selectedPass, setSelectedPass] = useState<VisitorPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRecentPasses() {
      setLoading(true);
      setError("");

      try {
        const tokens = await authApi.getRecentVisitTokens();

        if (active) {
          setPasses(tokens.map(mapVisitTokenToVisitorPass));
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load recent passes");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRecentPasses();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <main className="space-y-5 pb-5">
        <header className="pt-2">
          <p className="text-sm font-bold text-blue">Security</p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal text-foreground">
            Recent passes
          </h1>
          <p className="mt-2 text-sm font-medium text-muted">
            Latest visitor passes across the society.
          </p>
        </header>

        {error ? (
          <p className="rounded-lg border border-danger/20 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <p className="rounded-card bg-white p-3 text-sm font-semibold text-muted shadow-soft">
              Loading recent passes...
            </p>
          ) : passes.length === 0 ? (
            <p className="rounded-card bg-white p-3 text-sm font-semibold text-muted shadow-soft">
              No recent passes yet.
            </p>
          ) : (
            passes.map((visitor) => (
              <UpcomingVisitorCard
                key={visitor.id}
                visitor={visitor}
                onViewPass={setSelectedPass}
              />
            ))
          )}
        </section>
      </main>
      <PassDetailsDialog pass={selectedPass} onClose={() => setSelectedPass(null)} />
    </AppShell>
  );
}

function OwnerDashboard() {
  const { user } = useAuth();
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [creatingManualPass, setCreatingManualPass] = useState(false);
  const [manualError, setManualError] = useState("");
  const [deactivatingPassId, setDeactivatingPassId] = useState("");
  const [passActionError, setPassActionError] = useState("");
  const [selectedPass, setSelectedPass] = useState<VisitorPass | null>(null);
  const { passes, houses, loading, error, defaultHouseId, refreshPasses, addManualPass, deactivatePass } =
    useVisitPasses();
  const recentPasses = passes.slice(0, 2);
  const activePasses = passes.filter((pass) => pass.status === "active").length;
  const inactivePasses = passes.filter((pass) => pass.status === "expired" || pass.status === "revoked").length;
  const canUseAiAssistant = user?.role === "OWNER";

  async function handleCreateManualPass(input: VisitorPassInput) {
    setCreatingManualPass(true);
    setManualError("");

    try {
      await addManualPass(input);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Unable to create visitor pass");
      throw err;
    } finally {
      setCreatingManualPass(false);
    }
  }

  async function handleDeactivatePass(pass: VisitorPass) {
    setDeactivatingPassId(pass.id);
    setPassActionError("");

    try {
      await deactivatePass(pass.id);
    } catch (err) {
      setPassActionError(err instanceof Error ? err.message : "Unable to deactivate pass");
    } finally {
      setDeactivatingPassId("");
    }
  }

  return (
    <AppShell>
        <main className="space-y-4 pb-3">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-foreground">
                Overview
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                <HousesSummary houses={houses} loading={loading} />
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setManualError("");
                setManualDialogOpen(true);
              }}
              className="h-10 shrink-0 rounded-lg bg-[#111827] px-4 text-sm font-medium text-white transition hover:bg-[#374151]"
            >
              Create pass
            </button>
          </header>

          <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardStat label="Active passes" value={loading ? "—" : String(activePasses)} hint="Currently valid" />
            <DashboardStat label="Total visitors" value={loading ? "—" : String(passes.length)} hint="All pass records" />
            <DashboardStat label="Assigned houses" value={loading ? "—" : String(houses.length)} hint="Linked to your account" />
            <DashboardStat label="Inactive passes" value={loading ? "—" : String(inactivePasses)} hint="Expired or revoked" />
          </section>

          <div
            className={`grid gap-3 lg:items-start ${
              canUseAiAssistant ? "lg:grid-cols-[1.1fr_0.9fr]" : "lg:grid-cols-1"
            }`}
          >
            {canUseAiAssistant ? (
              <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-foreground">
                  AI Assistant
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Create passes, search your passes, or deactivate active passes.
                </p>
              </div>
              <AIVisitorPassCard
                mode="owner"
                onPassCreated={(pass) => {
                  setSelectedPass(pass);
                  void refreshPasses();
                }}
              />
            </section>
            ) : null}

            <section className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-foreground">Recent passes</h2>
                <p className="mt-1 text-sm text-muted">Latest visitor activity for your homes.</p>
              </div>
              <Link
                href="/passes"
                className="shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:bg-slate-soft"
              >
                View all
              </Link>
            </div>

            {error ? (
              <p className="rounded-lg border border-danger/20 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-danger">
                {error}
              </p>
            ) : null}
            {passActionError ? (
              <p className="rounded-lg border border-danger/20 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-danger">
                {passActionError}
              </p>
            ) : null}

            <div className="grid gap-2">
              {loading ? (
                <p className="rounded-card bg-white p-3 text-sm font-semibold text-muted shadow-soft">
                  Loading visitor passes...
                </p>
              ) : recentPasses.length === 0 ? (
                <p className="rounded-card bg-white p-3 text-sm font-semibold text-muted shadow-soft">
                  No visitor passes yet.
                </p>
              ) : (
                recentPasses.map((visitor) => (
                  <UpcomingVisitorCard
                    key={visitor.id}
                    visitor={visitor}
                    onViewPass={setSelectedPass}
                    onDeactivatePass={handleDeactivatePass}
                    deactivating={deactivatingPassId === visitor.id}
                  />
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setManualError("");
                setManualDialogOpen(true);
              }}
              className="h-[52px] w-full rounded-md border border-blue/20 bg-white px-4 py-3 text-sm font-bold text-blue shadow-soft transition hover:-translate-y-0.5 hover:border-blue/40"
            >
              Manual entry
            </button>
            </section>
          </div>

          {canUseAiAssistant ? (
            <section className="space-y-3">
              <div>
                <h1 className="text-xl font-bold tracking-normal text-foreground">
                  My houses
                </h1>
                <p className="mt-1 text-sm text-muted">
                  Use these house numbers when creating visitor passes.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                  <p className="rounded-card bg-white p-4 text-sm font-semibold text-muted shadow-soft">
                    Loading houses...
                  </p>
                ) : houses.length === 0 ? (
                  <p className="rounded-card bg-white p-4 text-sm font-semibold text-muted shadow-soft">
                    No houses are assigned yet.
                  </p>
                ) : (
                  houses.map((house) => (
                    <article
                      key={house.id}
                      className="rounded-card border border-border bg-white p-4 shadow-soft"
                    >
                      <p className="text-xs font-bold uppercase text-muted">House</p>
                      <h2 className="mt-1 text-2xl font-bold tracking-normal text-foreground">
                        {house.houseNumber}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        {house.block ? `Block ${house.block}` : "No block"}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </main>
        <ManualPassDialog
          open={manualDialogOpen}
          onClose={() => setManualDialogOpen(false)}
          houses={houses}
          defaultHouseId={defaultHouseId}
          creating={creatingManualPass}
          error={manualError}
          onCreatePass={handleCreateManualPass}
        />
        <PassDetailsDialog pass={selectedPass} onClose={() => setSelectedPass(null)} />
    </AppShell>
  );
}
