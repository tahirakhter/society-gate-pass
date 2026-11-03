import { VisitorStatus } from "@/components/status-badge";
import { VisitTokenRecord } from "@/lib/api";

export type VisitorPass = {
  id: string;
  name: string;
  cnic: string;
  time: string;
  house: string;
  houseId: string;
  carNumber: string;
  status: VisitorStatus;
  qrPayload: string;
  createdAt: string;
};

export type VisitorPassInput = {
  name: string;
  cnic: string;
  time?: string;
  houseId: string;
  carNumber: string;
};

export function mapVisitTokenToVisitorPass(token: VisitTokenRecord): VisitorPass {
  return {
    id: token.id,
    name: token.visitor.fullName,
    cnic: token.visitor.cnic,
    time: formatVisitTime(token.expiresAt),
    house: token.house.block
      ? `${token.house.houseNumber} • Block ${token.house.block}`
      : token.house.houseNumber,
    houseId: token.house.id,
    carNumber: token.carNumber,
    status: mapTokenStatus(token.status),
    qrPayload: token.qrPayload,
    createdAt: token.createdAt,
  };
}

export function mapTokenStatus(status: VisitTokenRecord["status"]): VisitorStatus {
  const statusMap: Record<VisitTokenRecord["status"], VisitorStatus> = {
    ACTIVE: "active",
    USED: "used",
    REVOKED: "revoked",
    EXPIRED: "expired",
  };

  return statusMap[status];
}

function formatVisitTime(dateValue: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}
