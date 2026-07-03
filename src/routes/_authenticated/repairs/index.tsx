import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { REPAIR_STATUSES, STATUS_LABEL, statusBadgeClass, type RepairStatus } from "@/lib/repair-status";
import { parseTicketCode } from "@/lib/ticket";
import { toast } from "sonner";

type Job = {
  id: string;
  ticket_code: string;
  device_brand: string;
  device_model: string;
  reported_issue: string;
  status: RepairStatus;
  created_at: string;
  customer: { name: string; phone: string } | null;
};

export const Route = createFileRoute("/_authenticated/repairs/")({
  head: () => ({ meta: [{ title: "Repairs — MP Repair" }] }),
  component: RepairsList,
});

function RepairsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<RepairStatus | "all">("all");

  useEffect(() => {
    supabase
      .from("repair_jobs")
      .select("id, ticket_code, device_brand, device_model, reported_issue, status, created_at, customer:customers(name, phone)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setJobs((data ?? []) as unknown as Job[]);
        setLoading(false);
      });
  }, []);


  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (filter !== "all" && j.status !== filter) return false;
      if (!term) return true;
      return (
        j.ticket_code.toLowerCase().includes(term) ||
        j.device_brand.toLowerCase().includes(term) ||
        j.device_model.toLowerCase().includes(term) ||
        j.customer?.name.toLowerCase().includes(term) ||
        j.customer?.phone.includes(term)
      );
    });
  }, [jobs, q, filter]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by ticket, device, customer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button asChild>
          <Link to="/repairs/new">
            <Plus className="h-4 w-4 mr-2" />
            New repair
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        {REPAIR_STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={STATUS_LABEL[s]}
          />
        ))}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground mb-3">No repair jobs yet.</p>
            <Button asChild size="sm">
              <Link to="/repairs/new">Create the first one</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((j) => (
              <Link
                key={j.id}
                to="/repairs/$id"
                params={{ id: j.id }}
                className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-2xl font-bold leading-none">
                      #{parseTicketCode(j.ticket_code).daily}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {parseTicketCode(j.ticket_code).full}
                    </span>
                    <span className={statusBadgeClass(j.status)}>{STATUS_LABEL[j.status]}</span>
                  </div>
                  <div className="text-sm mt-1 truncate">
                    {j.device_brand} {j.device_model} — <span className="text-muted-foreground">{j.reported_issue}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {j.customer?.name ?? "—"} · {j.customer?.phone ?? ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {new Date(j.created_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "text-xs px-3 py-1.5 rounded-md border transition-colors " +
        (active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground hover:bg-muted")
      }
    >
      {label}
    </button>
  );
}
