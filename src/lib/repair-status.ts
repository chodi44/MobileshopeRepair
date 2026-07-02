export const REPAIR_STATUSES = [
  "received",
  "diagnosing",
  "awaiting_parts",
  "repairing",
  "ready",
  "delivered",
  "cancelled",
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const STATUS_LABEL: Record<RepairStatus, string> = {
  received: "Received",
  diagnosing: "Diagnosing",
  awaiting_parts: "Awaiting parts",
  repairing: "Repairing",
  ready: "Ready for pickup",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<RepairStatus, string> = {
  received: "bg-muted text-foreground",
  diagnosing: "bg-primary/10 text-primary",
  awaiting_parts: "bg-warning/15 text-warning",
  repairing: "bg-primary/10 text-primary",
  ready: "bg-success/15 text-success",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export function statusBadgeClass(s: RepairStatus) {
  return `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_TONE[s]}`;
}
