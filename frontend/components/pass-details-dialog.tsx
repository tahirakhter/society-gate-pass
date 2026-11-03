"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { VisitorPass } from "@/lib/visit-pass-mapper";

type PassDetailsDialogProps = {
  pass: VisitorPass | null;
  onClose: () => void;
};

export function PassDetailsDialog({ pass, onClose }: PassDetailsDialogProps) {
  const [qrCode, setQrCode] = useState({ passId: "", dataUrl: "" });

  useEffect(() => {
    let active = true;

    if (!pass) {
      return;
    }

    QRCode.toDataURL(pass.qrPayload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
    })
      .then((dataUrl) => {
        if (active) {
          setQrCode({ passId: pass.id, dataUrl });
        }
      })
      .catch(() => {
        if (active) {
          setQrCode({ passId: pass.id, dataUrl: "" });
        }
      });

    return () => {
      active = false;
    };
  }, [pass]);

  if (!pass) {
    return null;
  }

  const qrDataUrl = qrCode.passId === pass.id ? qrCode.dataUrl : "";

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#0F172A]/45 px-4 pb-4 backdrop-blur-sm sm:items-center sm:py-8"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pass-details-title"
        className="w-full max-w-md rounded-card bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-blue">Visitor pass</p>
            <h2 id="pass-details-title" className="mt-1 text-2xl font-bold text-foreground">
              {pass.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pass details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-soft text-xl font-semibold text-muted transition hover:text-foreground"
          >
            x
          </button>
        </div>

        <div className="mt-5 flex justify-center rounded-lg bg-slate-soft p-5">
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt={`QR code for ${pass.name}`}
              width={220}
              height={220}
              unoptimized
              className="rounded-lg bg-white p-3"
            />
          ) : (
            <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg bg-white text-sm font-semibold text-muted">
              Preparing QR
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Detail label="Expires" value={pass.time} />
          <Detail label="House" value={pass.house} />
          <Detail label="Car" value={pass.carNumber} />
          <Detail label="CNIC" value={pass.cnic} />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-soft px-4 py-3">
          <span className="text-sm font-semibold text-muted">Status</span>
          <StatusBadge status={pass.status} />
        </div>

        <a
          href={qrDataUrl || "#"}
          download={`visitor-pass-${pass.name.toLowerCase().replace(/\s+/g, "-")}.png`}
          className={`mt-5 flex h-[52px] items-center justify-center rounded-md text-sm font-bold shadow-blue transition ${
            qrDataUrl
              ? "bg-blue text-white hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
              : "pointer-events-none bg-slate-soft text-muted shadow-none"
          }`}
        >
          Download QR code
        </a>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-soft px-4 py-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 break-words font-bold text-foreground">{value}</p>
    </div>
  );
}
