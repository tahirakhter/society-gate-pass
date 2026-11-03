export type VisitorStatus = "approved" | "pending" | "active" | "expired" | "revoked" | "used";

const statusStyles: Record<VisitorStatus, string> = {
  approved: "bg-[#DCFCE7] text-[#166534]",
  pending: "bg-[#FEF3C7] text-[#92400E]",
  active: "bg-[#ecfdf3] text-[#027a48]",
  expired: "bg-[#FEE2E2] text-[#991B1B]",
  revoked: "bg-[#FEF9C3] text-[#854D0E]",
  used: "bg-[#E0E7FF] text-[#3730A3]",
};

const statusLabels: Record<VisitorStatus, string> = {
  approved: "Approved",
  pending: "Pending",
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
  used: "Used",
};

export function StatusBadge({ status }: { status: VisitorStatus }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
