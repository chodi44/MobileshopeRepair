import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Wrench, Package, Receipt, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FixCell" }] }),
  component: DashboardPage,
});

// Redirect bare /dashboard visits with no matching child — handled at parent.
export const _ = redirect; // no-op to keep import used if tree-shaken

type Stats = { customers: number; active: number; ready: number };

function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ customers: 0, active: 0, ready: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase
        .from("repair_jobs")
        .select("*", { count: "exact", head: true })
        .in("status", ["received", "diagnosing", "awaiting_parts", "repairing"]),
      supabase
        .from("repair_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "ready"),
    ]).then(([c, a, r]) =>
      setStats({ customers: c.count ?? 0, active: a.count ?? 0, ready: r.count ?? 0 }),
    );
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <section className="relative bg-card border rounded-lg corner-brackets overflow-hidden">
        <div className="grid md:grid-cols-[1.4fr_1fr]">
          <div className="p-6 md:p-10 border-b md:border-b-0 md:border-r">
            <div className="eyebrow mb-4">Overview · Live</div>
            <h2 className="display text-4xl md:text-5xl leading-[1.05] text-ink">
              A quiet console for a <em className="text-ember">busy</em> repair bench.
            </h2>
            <p className="mt-4 text-sm text-muted-foreground max-w-lg">
              Register the device, hand the customer their ticket, and post public updates as the
              job moves. Customers track live at <span className="num text-ink">/track</span>.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/repairs/new">
                  New repair <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/customers/new">New customer</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2">
            <MiniStat label="Active" value={stats.active} tone="ember" />
            <MiniStat label="Ready" value={stats.ready} tone="success" />
            <MiniStat label="Customers" value={stats.customers} tone="ink" />
            <MiniStat label="Revenue" value="—" tone="muted" hint="Phase 3" />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="eyebrow">Snapshot</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Customers" value={stats.customers} icon={Users} tone="ink" />
          <StatCard label="Active Repairs" value={stats.active} icon={Wrench} tone="ember" />
          <StatCard label="Ready for Pickup" value={stats.ready} icon={Package} tone="success" />
          <StatCard label="Revenue (mo)" value="—" icon={Receipt} tone="muted" hint="Phase 3" />
        </div>
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone: "ember" | "success" | "ink" | "muted";
  hint?: string;
}) {
  const accent = {
    ember: "text-ember",
    success: "text-success",
    ink: "text-ink",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="border-b border-r last:border-r-0 [&:nth-child(2)]:border-r-0 [&:nth-child(3)]:border-b-0 [&:nth-child(4)]:border-b-0 p-5">
      <div className="eyebrow">{label}</div>
      <div className={`num text-4xl mt-2 font-medium ${accent}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1 num">{hint}</div>}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  tone: "ember" | "success" | "ink" | "muted";
  hint?: string;
}) {
  const badge = {
    ember: "bg-ember/12 text-ember",
    success: "bg-success/15 text-success",
    ink: "bg-ink/8 text-ink",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <Card className="p-5 hover:shadow-[var(--shadow-elevated)] transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`h-9 w-9 rounded-sm flex items-center justify-center ${badge}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="eyebrow">{label}</span>
      </div>
      <div className="num text-3xl mt-4 font-medium text-ink">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1 num">{hint}</div>}
    </Card>
  );
}

