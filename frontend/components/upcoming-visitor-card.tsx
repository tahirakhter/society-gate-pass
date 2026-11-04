import { StatusBadge } from "@/components/status-badge";
import { VisitorPass } from "@/lib/visit-pass-mapper";

export function UpcomingVisitorCard({
  visitor,
  onViewPass,
  onDeactivatePass,
  deactivating,
}: {
  visitor: VisitorPass;
  onViewPass: (visitor: VisitorPass) => void;
  onDeactivatePass?: (visitor: VisitorPass) => void;
  deactivating?: boolean;
}) {
  const canDeactivate = visitor.status === "active" && Boolean(onDeactivatePass);
  const canViewPass = visitor.status === "active";

  return (
    <article className="rounded-card border border-border bg-white p-3 shadow-soft transition-colors hover:border-[#d1d5db]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-normal text-foreground">
            {visitor.name}
          </h2>
          <p className="mt-1 text-xs font-normal text-muted">Expires {visitor.time}</p>
        </div>
        <StatusBadge status={visitor.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-border bg-slate-soft px-3 py-2">
          <p className="text-xs font-normal text-muted">House</p>
          <p className="mt-0.5 truncate font-medium text-foreground">{visitor.house}</p>
        </div>
        <div className="rounded-lg border border-border bg-slate-soft px-3 py-2">
          <p className="text-xs font-normal text-muted">Vehicle</p>
          <p className="mt-0.5 truncate font-medium text-foreground">{visitor.carNumber}</p>
        </div>
      </div>

      <div className={`mt-3 grid gap-2 ${onDeactivatePass ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          onClick={() => onViewPass(visitor)}
          disabled={!canViewPass}
          className="h-10 rounded-lg bg-blue text-sm font-medium text-white transition hover:bg-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
        >
          View pass
        </button>
        {onDeactivatePass ? (
          <button
            type="button"
            onClick={() => onDeactivatePass(visitor)}
            disabled={!canDeactivate || deactivating}
            className="h-10 rounded-lg border border-border bg-white text-sm font-medium text-danger transition hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deactivating ? "Deactivating..." : "Deactivate"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
