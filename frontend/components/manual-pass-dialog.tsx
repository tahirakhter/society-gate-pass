"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { HouseRecord } from "@/lib/api";
import { VisitorPassInput } from "@/lib/visit-pass-mapper";

type ManualPassDialogProps = {
  open: boolean;
  onClose: () => void;
  houses: HouseRecord[];
  defaultHouseId: string;
  creating: boolean;
  error: string;
  onCreatePass: (pass: VisitorPassInput) => Promise<void>;
};

export function ManualPassDialog({
  open,
  onClose,
  houses,
  defaultHouseId,
  creating,
  error,
  onCreatePass,
}: ManualPassDialogProps) {
  const [successMessage, setSuccessMessage] = useState("");

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await onCreatePass({
      name: String(formData.get("name") || ""),
      time: String(formData.get("time") || ""),
      cnic: String(formData.get("cnic") || ""),
      carNumber: String(formData.get("carNumber") || ""),
      houseId: String(formData.get("houseId") || ""),
    });
    form.reset();
    setSuccessMessage("Visitor pass created successfully.");
    window.setTimeout(() => {
      setSuccessMessage("");
      onClose();
    }, 900);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/30"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-pass-title"
        className="h-full w-full max-w-[480px] overflow-y-auto border-l border-border bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-white px-6 py-5">
          <div>
            <h2 id="manual-pass-title" className="text-lg font-semibold text-foreground">
              Create visitor pass
            </h2>
            <p className="mt-1 text-sm text-muted">Enter the visitor and vehicle information.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close manual entry"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-slate-soft hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 px-6 py-6">
          <Field label="Visitor name"><input name="name" placeholder="e.g. Ahmed Khan" required className={fieldClass} /></Field>
          <Field label="CNIC"><input name="cnic" placeholder="12345-1234567-1" required className={fieldClass} /></Field>
          <Field label="Vehicle number"><input name="carNumber" placeholder="e.g. LEA-1234" required className={fieldClass} /></Field>
          <Field label="House">
            <select name="houseId" defaultValue={defaultHouseId} required className={fieldClass}>
              <option value="">Select a house</option>
              {houses.map((house) => <option key={house.id} value={house.id}>{house.houseNumber}{house.block ? ` • Block ${house.block}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Notes" optional><textarea name="time" rows={3} placeholder="Add an optional note for security" className={`${fieldClass} h-auto py-3`} /></Field>
          {error ? (
            <p className="rounded-lg border border-danger/20 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
          {successMessage ? (
            <p className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm font-semibold text-[#166534]">
              {successMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={creating || houses.length === 0 || Boolean(successMessage)}
            className="mt-2 h-10 rounded-lg bg-blue text-sm font-medium text-white transition hover:bg-[#374151] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {successMessage ? "Created" : creating ? "Creating..." : "Create pass"}
          </button>
        </form>
      </section>
    </div>
  );
}

const fieldClass = "h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none placeholder:text-[#9ca3af] focus:border-[#9ca3af]";

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1.5"><span className="text-sm font-medium text-foreground">{label}{optional ? <span className="ml-1 font-normal text-muted">(optional)</span> : null}</span>{children}</label>;
}
