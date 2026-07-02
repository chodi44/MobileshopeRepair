import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trash2, Phone, Mail, MapPin, Globe, Lock, Plus, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/i18n";
import { getCustomerPhotoUrl } from "@/lib/customer-photo";
import { STATUS_LABEL, statusBadgeClass, type RepairStatus } from "@/lib/repair-status";
import { parseTicketCode } from "@/lib/ticket";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  head: () => ({ meta: [{ title: "Customer — FixCell" }] }),
  component: CustomerProfilePage,
});

type Row = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  preferred_language: LanguageCode | null;
  photo_url: string | null;
  created_at: string;
};

type Job = {
  id: string;
  ticket_code: string;
  device_brand: string;
  device_model: string;
  status: RepairStatus;
  created_at: string;
};

type PhotoRow = {
  id: string;
  kind: "profile" | "intake" | "delivery" | "other";
  photo_path: string;
  note: string | null;
  created_at: string;
  job_id: string | null;
  url: string | null;
};

function CustomerProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<Row | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data, error }, { data: js }, { data: ps }] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, phone, email, address, notes, preferred_language, photo_url, created_at")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("repair_jobs")
          .select("id, ticket_code, device_brand, device_model, status, created_at")
          .eq("customer_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("customer_photos")
          .select("id, kind, photo_path, note, created_at, job_id")
          .eq("customer_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (error) toast.error(error.message);
      const r = (data as Row) ?? null;
      setRow(r);
      setJobs((js as Job[]) ?? []);
      if (r?.photo_url) setPhotoUrl(await getCustomerPhotoUrl(r.photo_url));
      const rows = (ps ?? []) as Array<Omit<PhotoRow, "url">>;
      const withUrls: PhotoRow[] = await Promise.all(
        rows.map(async (p) => ({ ...p, url: await getCustomerPhotoUrl(p.photo_path) })),
      );
      setGallery(withUrls);
      setLoading(false);
    })();
  }, [id]);

  async function onDelete() {
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Customer deleted");
    navigate({ to: "/customers" });
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="p-10 text-center text-sm text-muted-foreground">Loading…</Card>
      </div>
    );
  }
  if (!row) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/customers">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
        <Card className="p-10 text-center text-sm text-muted-foreground">Customer not found.</Card>
      </div>
    );
  }

  const langLabel =
    SUPPORTED_LANGUAGES.find((l) => l.code === row.preferred_language)?.label ?? "English";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/customers">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Link>
      </Button>

      <Card className="p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={row.name} className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-semibold tracking-tight">{row.name}</h2>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded px-2 py-0.5">
                <Lock className="h-3 w-3" /> Locked
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Added {new Date(row.created_at).toLocaleString()}
            </p>
            <div className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={row.phone} />
              {row.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={row.email} />}
              <InfoRow icon={<Globe className="h-4 w-4" />} label="Language" value={langLabel} />
              {row.address && (
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={row.address} />
              )}
            </div>
            {row.notes && (
              <div className="mt-3 text-sm">
                <div className="text-xs font-medium text-muted-foreground mb-1">Notes</div>
                <p className="whitespace-pre-wrap">{row.notes}</p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 pt-4 border-t flex flex-wrap gap-2">
          <Button
            onClick={() =>
              navigate({ to: "/repairs/new", search: { customer: row.id } as never })
            }
          >
            <Plus className="h-4 w-4 mr-1" /> New repair for this customer
          </Button>
          <Button variant="outline" onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Customer details are locked once saved. To fix a mistake, delete and create a new profile.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Repair history ({jobs.length})</h3>
        </div>
        {jobs.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No repairs yet.</div>
        ) : (
          <ul className="divide-y">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link
                  to="/repairs/$id"
                  params={{ id: j.id }}
                  className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
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
                    <div className="text-sm text-muted-foreground truncate mt-0.5">
                      {j.device_brand} {j.device_model}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {new Date(j.created_at).toLocaleDateString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Photo gallery ({gallery.length})</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every visit is captured here — intake and delivery snapshots stay with the profile.
          </p>
        </div>
        {gallery.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No visit photos yet.</div>
        ) : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {gallery.map((p) => (
              <a
                key={p.id}
                href={p.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg overflow-hidden border bg-muted"
              >
                <div className="aspect-square">
                  {p.url ? (
                    <img src={p.url} alt={p.kind} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      <UserIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="p-2 text-xs">
                  <div className="font-medium capitalize">{p.kind}</div>
                  <div className="text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                  {p.note && <div className="text-muted-foreground truncate mt-0.5">{p.note}</div>}
                </div>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate">{value}</div>
      </div>
    </div>
  );
}
