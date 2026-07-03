import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, Phone, Mail, Eye } from "lucide-react";
import { toast } from "sonner";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({ meta: [{ title: "Customers — MP Repair" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email, address, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!mounted) return;
      if (error) toast.error(error.message);
      setRows((data as Customer[]) ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.phone.toLowerCase().includes(s) ||
        (c.email ?? "").toLowerCase().includes(s),
    );
  }, [q, rows]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Customers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading…" : `${filtered.length} of ${rows.length}`}
          </p>
        </div>
        <Button asChild>
          <Link to="/customers/new">
            <Plus className="h-4 w-4 mr-1" /> Add customer
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone, or email"
          className="pl-9"
        />
      </div>

      {!loading && filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? "No customers yet. Add your first one."
              : "No customers match your search."}
          </p>
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                navigate({ to: "/customers/$id", params: { id: c.id } })
              }
              className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center gap-4"
            >
              <div className="h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-semibold text-sm shrink-0">
                {c.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </span>
                  {c.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3" />
                      {c.email}
                    </span>
                  )}
                </div>
              </div>
              <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
