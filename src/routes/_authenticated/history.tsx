import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, User as UserIcon, Phone, Mail, Smartphone, Hash, Calendar } from "lucide-react";
import { STATUS_LABEL, statusBadgeClass, type RepairStatus } from "@/lib/repair-status";
import { parseTicketCode } from "@/lib/ticket";
import { toast } from "sonner";

type Job = {
  id: string;
  ticket_code: string;
  device_brand: string;
  device_model: string;
  device_color: string | null;
  imei: string | null;
  reported_issue: string;
  status: RepairStatus;
  created_at: string;
  received_at: string | null;
  estimated_ready_at: string | null;
  quoted_cost: number | null;
  customer_id: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  } | null;
};


type CustomerGroup = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  jobs: Job[];
};

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — FixCell" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("repair_jobs")
      .select(
        "id, ticket_code, device_brand, device_model, device_color, imei, reported_issue, status, created_at, received_at, estimated_ready_at, quoted_cost, customer_id, deleted_at, deleted_reason, customer:customers(id, name, phone, email)",
      )
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setJobs((data ?? []) as unknown as Job[]);
        setLoading(false);
      });
  }, []);

  const groups = useMemo<CustomerGroup[]>(() => {
    const term = q.trim().toLowerCase();
    const matched = jobs.filter((j) => {
      if (!term) return true;
      return (
        j.ticket_code.toLowerCase().includes(term) ||
        j.device_brand.toLowerCase().includes(term) ||
        j.device_model.toLowerCase().includes(term) ||
        (j.imei ?? "").toLowerCase().includes(term) ||
        (j.customer?.name ?? "").toLowerCase().includes(term) ||
        (j.customer?.phone ?? "").includes(term) ||
        (j.customer?.email ?? "").toLowerCase().includes(term)
      );
    });
    const map = new Map<string, CustomerGroup>();
    for (const j of matched) {
      if (!j.customer) continue;
      const c = j.customer;
      if (!map.has(c.id)) {
        map.set(c.id, { id: c.id, name: c.name, phone: c.phone, email: c.email, jobs: [] });
      }
      map.get(c.id)!.jobs.push(j);
    }
    return Array.from(map.values()).sort((a, b) => {
      const at = a.jobs[0]?.created_at ?? "";
      const bt = b.jobs[0]?.created_at ?? "";
      return bt.localeCompare(at);
    });
  }, [jobs, q]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Customer history</h2>
        <p className="text-sm text-muted-foreground">
          Search by name, phone, email, IMEI, brand, model, or ticket code.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          className="pl-9"
          placeholder="e.g. John, +919…, 3568…, iPhone 13, FX-XXXX"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">
            {q ? "No matches for your search." : "No repair history yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <CustomerCard key={g.id} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerCard({ group }: { group: CustomerGroup }) {
  const total = group.jobs.length;
  const active = group.jobs.filter(
    (j) => j.status !== "delivered" && j.status !== "cancelled",
  ).length;
  const initials = group.name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="bg-card border rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="p-4 md:p-5 border-b bg-muted/30 flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
          {initials || <UserIcon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/customers/$id"
              params={{ id: group.id }}
              className="font-semibold hover:underline"
            >
              {group.name}
            </Link>
            <span className="text-xs text-muted-foreground">
              {total} repair{total === 1 ? "" : "s"} · {active} active
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {group.phone}
            </span>
            {group.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {group.email}
              </span>
            )}
          </div>
        </div>
      </div>

      <ol className="divide-y">
        {group.jobs.map((j) => {
          const removed = !!j.deleted_at;
          return (
            <li key={j.id}>
              <Link
                to="/repairs/$id"
                params={{ id: j.id }}
                className={
                  "block p-4 md:p-5 transition-colors " +
                  (removed ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/40")
                }
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-2xl font-bold leading-none">
                    #{parseTicketCode(j.ticket_code).daily}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {parseTicketCode(j.ticket_code).full}
                  </span>
                  <span className={statusBadgeClass(j.status)}>{STATUS_LABEL[j.status]}</span>
                  {removed && (
                    <span className="text-xs font-medium bg-destructive/15 text-destructive rounded px-2 py-0.5">
                      Deleted
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateTime(j.received_at ?? j.created_at)}
                  </span>
                </div>
                <div className="mt-2 text-sm inline-flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">
                    {j.device_brand} {j.device_model}
                  </span>
                  {j.device_color && (
                    <span className="text-muted-foreground">· {j.device_color}</span>
                  )}
                </div>
                {j.imei && (
                  <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    IMEI {j.imei}
                  </div>
                )}
                <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {j.reported_issue}
                </div>
                {removed && (
                  <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                    <span className="font-semibold text-destructive">Reason:</span>{" "}
                    <span className="text-foreground">{j.deleted_reason || "(not provided)"}</span>
                    <span className="block text-muted-foreground mt-0.5">
                      Removed on {formatDateTime(j.deleted_at!)}
                    </span>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {j.estimated_ready_at && (
                    <span>ETA: {formatDate(j.estimated_ready_at)}</span>
                  )}
                  {j.quoted_cost != null && <span>Quote: {j.quoted_cost}</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}
