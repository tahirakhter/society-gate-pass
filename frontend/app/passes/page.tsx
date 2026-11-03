"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { HousesSummary } from "@/components/houses-summary";
import { ManualPassDialog } from "@/components/manual-pass-dialog";
import { PassDetailsDialog } from "@/components/pass-details-dialog";
import { ProtectedRoute } from "@/components/protected-route";
import { StatusBadge } from "@/components/status-badge";
import { UpcomingVisitorCard } from "@/components/upcoming-visitor-card";
import { useVisitPasses } from "@/hooks/use-visit-passes";
import { VisitorPass, VisitorPassInput } from "@/lib/visit-pass-mapper";

const PASSES_PER_PAGE = 10;

export default function PassesPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [creatingManualPass, setCreatingManualPass] = useState(false);
  const [manualError, setManualError] = useState("");
  const [deactivatingPassId, setDeactivatingPassId] = useState("");
  const [passActionError, setPassActionError] = useState("");
  const [selectedPass, setSelectedPass] = useState<VisitorPass | null>(null);
  const { passes, houses, loading, error, defaultHouseId, addManualPass, deactivatePass } =
    useVisitPasses();
  const pageCount = Math.max(1, Math.ceil(passes.length / PASSES_PER_PAGE));
  const visiblePasses = useMemo(
    () =>
      passes.slice((currentPage - 1) * PASSES_PER_PAGE, currentPage * PASSES_PER_PAGE),
    [currentPage, passes],
  );

  async function handleCreatePass(pass: VisitorPassInput) {
    setCreatingManualPass(true);
    setManualError("");

    try {
      await addManualPass(pass);
      setCurrentPage(1);
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
    <ProtectedRoute>
      <AppShell>
        <main className="space-y-4 pb-3">
          <header className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-foreground">
                Visitor passes
              </h1>
              <p className="mt-1.5 text-sm font-normal text-muted">
                <HousesSummary houses={houses} loading={loading} prefix={`${passes.length} passes •`} />
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

          <section className="grid gap-2 md:hidden">
            {loading ? (
              <p className="rounded-card bg-white p-3 text-sm font-semibold text-muted shadow-soft">
                Loading visitor passes...
              </p>
            ) : visiblePasses.length === 0 ? (
              <p className="rounded-card bg-white p-3 text-sm font-semibold text-muted shadow-soft">
                No visitor passes yet.
              </p>
            ) : (
              visiblePasses.map((visitor) => (
                <UpcomingVisitorCard
                  key={visitor.id}
                  visitor={visitor}
                  onViewPass={setSelectedPass}
                  onDeactivatePass={handleDeactivatePass}
                  deactivating={deactivatingPassId === visitor.id}
                />
              ))
            )}
          </section>

          <section className="hidden overflow-hidden rounded-card border border-border bg-white shadow-soft md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="border-b border-border bg-slate-soft text-xs font-medium uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Visitor</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3">House</th>
                    <th className="px-4 py-3">Car</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-4 font-semibold text-muted" colSpan={6}>
                        Loading visitor passes...
                      </td>
                    </tr>
                  ) : visiblePasses.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 font-semibold text-muted" colSpan={6}>
                        No visitor passes yet.
                      </td>
                    </tr>
                  ) : (
                    visiblePasses.map((visitor) => {
                      const canDeactivate = visitor.status === "active";
                      const canViewPass = visitor.status === "active";

                      return (
                        <tr key={visitor.id} className="transition hover:bg-slate-soft/60">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{visitor.name}</p>
                            <p className="mt-0.5 text-xs font-normal text-muted">{visitor.cnic}</p>
                          </td>
                          <td className="px-4 py-3 font-normal text-foreground">
                            {visitor.time}
                          </td>
                          <td className="px-4 py-3 font-normal text-foreground">
                            {visitor.house}
                          </td>
                          <td className="px-4 py-3 font-normal text-foreground">
                            {visitor.carNumber}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={visitor.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedPass(visitor)}
                                disabled={!canViewPass}
                                className="h-9 rounded-md bg-blue px-4 text-xs font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeactivatePass(visitor)}
                                disabled={!canDeactivate || deactivatingPassId === visitor.id}
                                className="h-9 rounded-md border border-danger/20 px-4 text-xs font-bold text-danger transition hover:border-danger/40 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {deactivatingPassId === visitor.id ? "Deactivating" : "Deactivate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex items-center justify-between gap-3 rounded-card bg-white p-2 shadow-soft">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="h-11 rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-blue hover:text-blue disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <p className="text-sm font-bold text-muted">
              Page {currentPage} of {pageCount}
            </p>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
              disabled={currentPage === pageCount}
              className="h-11 rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-blue hover:text-blue disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </main>

        <ManualPassDialog
          open={manualDialogOpen}
          onClose={() => setManualDialogOpen(false)}
          houses={houses}
          defaultHouseId={defaultHouseId}
          creating={creatingManualPass}
          error={manualError}
          onCreatePass={handleCreatePass}
        />
        <PassDetailsDialog pass={selectedPass} onClose={() => setSelectedPass(null)} />
      </AppShell>
    </ProtectedRoute>
  );
}
