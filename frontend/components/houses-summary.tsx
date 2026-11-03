"use client";

import { useState } from "react";
import { HouseRecord } from "@/lib/api";
import { formatHouseLabel, formatHousesSummary } from "@/lib/house-labels";

export function HousesSummary({
  houses,
  loading,
  prefix,
}: {
  houses: HouseRecord[];
  loading: boolean;
  prefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const summary = loading ? "Loading homes..." : formatHousesSummary(houses);
  const interactive = houses.length > 1;

  return (
    <span className="relative inline-flex">
      {prefix ? <span>{prefix}&nbsp;</span> : null}
      <button
        type="button"
        onClick={() => interactive && setOpen((current) => !current)}
        disabled={!interactive}
        className={`text-left text-sm font-medium text-muted ${
          interactive ? "underline decoration-border underline-offset-4 hover:text-blue" : ""
        } disabled:cursor-default`}
      >
        {summary}
      </button>

      {open ? (
        <div className="absolute left-0 top-7 z-20 w-72 rounded-card border border-border bg-white p-2 shadow-soft">
          <div className="max-h-64 overflow-auto">
            {houses.map((house) => (
              <div key={house.id} className="rounded-lg px-3 py-2 hover:bg-slate-soft">
                <p className="text-sm font-bold text-foreground">{formatHouseLabel(house)}</p>
                <p className="mt-0.5 text-xs font-semibold text-muted">Assigned home</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </span>
  );
}
