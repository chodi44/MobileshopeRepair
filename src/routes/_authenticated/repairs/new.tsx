import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Camera, User as UserIcon, X, Search, Phone, Check, UserPlus } from "lucide-react";
import { addCustomerPhoto, getCustomerPhotoUrl } from "@/lib/customer-photo";
import { SUPPORTED_LANGUAGES, isLanguageCode } from "@/lib/i18n";
import { WebcamCapture } from "@/components/ui/webcam-capture";

export const Route = createFileRoute("/_authenticated/repairs/new")({
  head: () => ({ meta: [{ title: "New repair — MP Repair" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    customer: typeof s.customer === "string" ? s.customer : undefined,
  }),
  component: NewRepair,
});

const BRANDS = [
  "Apple", "Samsung", "Xiaomi", "Redmi", "Realme", "OnePlus", "Oppo", "Vivo",
  "Google Pixel", "Motorola", "Nokia", "Huawei", "Honor", "Asus", "Sony", "Other",
];

const E164 = /^\+[1-9]\d{6,14}$/;

/** Normalise phone: if 10 digits, prepend +91; if already E164, use as-is */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  const withPlus = raw.trim().startsWith("+") ? raw.trim() : `+${raw.trim()}`;
  return withPlus;
}

const repairSchema = z.object({
  device_brand: z.string().trim().min(1, "Brand required").max(60),
  device_model: z.string().trim().min(1, "Model required").max(80),
  device_color: z.string().trim().max(40).optional(),
  imei: z.string().trim().max(30).optional(),
  reported_issue: z.string().trim().min(3, "Describe the issue").max(1000),
  quoted_cost: z.string().trim().optional(),
  estimated_ready_at: z.string().trim().optional(),
  received_at: z.string().trim().optional(),
});

const newCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  phone: z.string().transform(normalisePhone).pipe(z.string().regex(E164, "Enter 10-digit number (e.g. 8184844888) or full international format (+918184844888)")),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional(),
  preferred_language: z.string().refine(isLanguageCode, "Invalid language"),
});

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function nowLocal() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  photo_url: string | null;
};

function NewRepair() {
  const navigate = useNavigate();
  const { customer: preselectedCustomer } = Route.useSearch();
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  // Photo (attached to customer profile)
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showWebcam, setShowWebcam] = useState(false);
  // When same phone found: prompt user to pick existing or create new
  const [dupDialog, setDupDialog] = useState<{ existing: Customer; newName: string; newPhone: string; newEmail: string; newAddress: string; newLang: string } | null>(null);

  useEffect(() => {
    supabase
      .from("customers")
      .select("id, name, phone, email, photo_url")
      .order("name")
      .then(({ data }) => setAllCustomers((data ?? []) as Customer[]));
  }, []);

  // Preselect from ?customer=
  useEffect(() => {
    if (!preselectedCustomer || !allCustomers.length) return;
    const c = allCustomers.find((x) => x.id === preselectedCustomer);
    if (c) setSelected(c);
  }, [preselectedCustomer, allCustomers]);

  // Load selected customer photo (signed URL)
  useEffect(() => {
    setSelectedPhotoUrl(null);
    if (!selected?.photo_url) return;
    getCustomerPhotoUrl(selected.photo_url).then(setSelectedPhotoUrl);
  }, [selected]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Customer[];
    return allCustomers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, allCustomers]);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Photo must be under 10MB");
      return;
    }
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }
  function onWebcamCapture(file: File) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }
  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  function pickCustomer(c: Customer) {
    setSelected(c);
    setQuery("");
    setShowNewCustomer(false);
  }
  function clearSelection() {
    setSelected(null);
    clearPhoto();
  }

  async function createNewCustomer(fd: FormData): Promise<Customer | null> {
    const raw = {
      name: fd.get("nc_name"),
      phone: fd.get("nc_phone"),
      email: fd.get("nc_email") || "",
      address: fd.get("nc_address") || "",
      preferred_language: fd.get("nc_language") || "en",
    };
    const parsed = newCustomerSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return null;
    }

    // Check if phone already used by another customer
    const { data: dups } = await supabase
      .from("customers")
      .select("id, name, phone, email, photo_url")
      .eq("phone", parsed.data.phone);

    if (dups && dups.length > 0) {
      // Phone exists — spec says duplicates blocked, must reuse existing profile
      const existing = dups[0] as Customer;
      toast.message(`Phone already exists — using ${existing.name}'s profile`, {
        description: "Duplicate phone numbers are not allowed. The existing customer has been selected.",
      });
      return existing;
    }

    return await doInsertCustomer(parsed.data);
  }

  async function doInsertCustomer(data: { name: string; phone: string; email?: string; address?: string; preferred_language: string }): Promise<Customer | null> {
    const { data: u } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase
      .from("customers")
      .insert({
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        preferred_language: data.preferred_language,
        created_by: u.user?.id,
      })
      .select("id, name, phone, email, photo_url")
      .single();
    if (error || !inserted) {
      toast.error(error?.message ?? "Failed to add customer");
      return null;
    }
    return inserted as Customer;
  }


  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const parsed = repairSchema.safeParse({
      device_brand: fd.get("device_brand"),
      device_model: fd.get("device_model"),
      device_color: fd.get("device_color") || "",
      imei: fd.get("imei") || "",
      reported_issue: fd.get("reported_issue"),
      quoted_cost: fd.get("quoted_cost") || "",
      estimated_ready_at: fd.get("estimated_ready_at") || "",
      received_at: fd.get("received_at") || "",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);

    // Resolve customer: existing selected, or inline new
    let customer = selected;
    if (!customer && showNewCustomer) {
      customer = await createNewCustomer(fd);
    }
    if (!customer) {
      setSaving(false);
      toast.error("Search a customer or add a new one");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }


    const cost = parsed.data.quoted_cost ? Number(parsed.data.quoted_cost) : null;
    const { data, error } = await supabase
      .from("repair_jobs")
      .insert({
        customer_id: customer.id,
        device_brand: parsed.data.device_brand,
        device_model: parsed.data.device_model,
        device_color: parsed.data.device_color || null,
        imei: parsed.data.imei || null,
        reported_issue: parsed.data.reported_issue,
        quoted_cost: cost && !Number.isNaN(cost) ? cost : null,
        estimated_ready_at: parsed.data.estimated_ready_at || null,
        received_at: parsed.data.received_at
          ? new Date(parsed.data.received_at).toISOString()
          : new Date().toISOString(),
        created_by: userData.user.id,
      })
      .select("id, ticket_code")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Failed to create repair");
      return;
    }

    // Save the intake photo to the customer's gallery, and if the customer
    // has no permanent profile photo yet, promote this one to profile.
    if (photoFile) {
      try {
        await addCustomerPhoto({
          customerId: customer.id,
          file: photoFile,
          kind: "intake",
          jobId: data.id,
          note: `Intake for #${data.ticket_code}`,
          setAsProfileIfMissing: true,
        });
      } catch (err) {
        console.error(err);
        toast.warning("Repair created, but the visit photo failed to upload");
      }
    }

    setSaving(false);
    toast.success(`Repair created — ${data.ticket_code}`);
    navigate({ to: "/repairs/$id", params: { id: data.id } });
  }


  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/repairs">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Link>
      </Button>
      <div className="bg-card border rounded-xl p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold mb-1">New repair job</h2>
        <p className="text-sm text-muted-foreground mb-6">
          A short ticket code is generated automatically. Share it with the customer for tracking.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* CUSTOMER SECTION */}
          {selected ? (
            <CustomerProfileCard
              customer={selected}
              photoUrl={selectedPhotoUrl}
              livePhotoPreview={photoPreview}
              onClear={preselectedCustomer ? undefined : clearSelection}
            />
          ) : (
            /* ── SEARCH MODE ── */
            <div className="space-y-2">
              <Label htmlFor="customer-search">Customer</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="customer-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, phone or email…"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
              {query && (
                <div className="rounded-md border bg-background overflow-hidden">
                  {matches.length ? (
                    <ul className="divide-y max-h-64 overflow-auto">
                      {matches.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/60"
                            onClick={() => pickCustomer(c)}
                          >
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{c.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{c.phone}</div>
                            </div>
                            <Check className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground">
                      No match found for "{query}".
                    </div>
                  )}
                  <div className="p-2 border-t bg-muted/40">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => { setShowNewCustomer(true); setQuery(""); }}
                    >
                      <UserPlus className="h-4 w-4 mr-1" /> Add new customer
                    </Button>
                  </div>
                </div>
              )}
              {!query && !showNewCustomer && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">No customer typed — or add new:</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewCustomer(true)}>
                    <UserPlus className="h-4 w-4 mr-1" /> Add new customer
                  </Button>
                </div>
              )}

              {showNewCustomer && (
                <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">New customer</div>
                    <button
                      type="button"
                      onClick={() => { setShowNewCustomer(false); setQuery(""); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✕ Cancel
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="nc_name">Name *</Label>
                      <Input id="nc_name" name="nc_name" required maxLength={120} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="nc_phone">Phone *</Label>
                      <Input
                        id="nc_phone"
                        name="nc_phone"
                        type="tel"
                        required
                        defaultValue="+91"
                        placeholder="8184844888"
                        maxLength={20}
                      />
                      <p className="text-[10px] text-muted-foreground">Type 10 digits (e.g. 8184844888) — +91 added automatically</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="nc_email">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input id="nc_email" name="nc_email" type="email" maxLength={255} placeholder="customer@email.com" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="nc_language">Preferred language</Label>
                      <select
                        id="nc_language"
                        name="nc_language"
                        defaultValue="en"
                        className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="nc_address">Address</Label>
                      <Textarea id="nc_address" name="nc_address" maxLength={500} rows={2} />
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Customer details are locked after saving — double-check name &amp; phone.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* DUPLICATE PHONE DIALOG */}
          {dupDialog && (
            <div className="rounded-lg border-2 border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
              <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">📞 This phone number already exists</div>
              <div className="rounded-md border bg-card p-3 text-sm">
                <div className="font-medium">{dupDialog.existing.name}</div>
                <div className="text-muted-foreground text-xs">{dupDialog.existing.phone}</div>
                {dupDialog.existing.email && <div className="text-muted-foreground text-xs">{dupDialog.existing.email}</div>}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400">Is this the same person, or a different customer sharing this number?</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { pickCustomer(dupDialog.existing); setDupDialog(null); setShowNewCustomer(false); }}
                >
                  ✅ Use existing — {dupDialog.existing.name}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  onClick={async () => {
                    const c = await doInsertCustomer({ name: dupDialog.newName, phone: dupDialog.newPhone, email: dupDialog.newEmail, address: dupDialog.newAddress, preferred_language: dupDialog.newLang });
                    setDupDialog(null);
                    if (c) { setSelected(c); setShowNewCustomer(false); }
                  }}
                >
                  ➕ Create new — {dupDialog.newName}
                </Button>
              </div>
              <button type="button" onClick={() => setDupDialog(null)} className="text-xs text-muted-foreground hover:underline">← Go back</button>
            </div>
          )}

          {/* PHOTO — visible when a customer is selected OR a new one is being added */}
          {(selected || showNewCustomer) && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <Label className="text-sm font-medium">Customer photo</Label>
              <p className="text-xs text-muted-foreground mb-3">
                {selected?.photo_url
                  ? "Update the ID photo (optional). Replaces the current one."
                  : "Take or upload a clear ID photo — it will be saved to the customer profile."}
              </p>
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border shrink-0">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : selectedPhotoUrl ? (
                    <img src={selectedPhotoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-9 w-9 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowWebcam(true)}
                    >
                      <Camera className="h-4 w-4 mr-1" /> Take photo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById("repair-photo-file")?.click()}
                    >
                      Choose file
                    </Button>
                    {photoPreview && (
                      <Button type="button" size="sm" variant="ghost" onClick={clearPhoto}>
                        <X className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                  <input
                    id="repair-photo-file"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPhotoChange}
                  />
                  {showWebcam && (
                    <WebcamCapture
                      onCapture={onWebcamCapture}
                      onClose={() => setShowWebcam(false)}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">Good lighting for a clear photo. Up to 10MB.</p>
                </div>
              </div>
            </div>
          )}

          {/* DEVICE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="device_brand">Brand</Label>
              <select
                id="device_brand"
                name="device_brand"
                required
                defaultValue=""
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="" disabled>Select brand</option>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="device_model">Model</Label>
              <Input id="device_model" name="device_model" required maxLength={80} placeholder="iPhone 13" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device_color">Color</Label>
              <Input id="device_color" name="device_color" maxLength={40} placeholder="Midnight" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imei">IMEI / Serial</Label>
              <Input id="imei" name="imei" maxLength={30} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reported_issue">Reported issue</Label>
            <Textarea id="reported_issue" name="reported_issue" required rows={3} maxLength={1000} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quoted_cost">Quoted cost</Label>
              <Input id="quoted_cost" name="quoted_cost" type="number" step="0.01" min="0" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="received_at">Received on</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    const el = document.getElementById("received_at") as HTMLInputElement | null;
                    if (el) el.value = nowLocal();
                  }}
                >
                  Now
                </button>
              </div>
              <Input
                id="received_at"
                name="received_at"
                type="datetime-local"
                defaultValue={nowLocal()}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="estimated_ready_at">Estimated ready date</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    const el = document.getElementById("estimated_ready_at") as HTMLInputElement | null;
                    if (el) el.value = todayISO();
                  }}
                >
                  Today
                </button>
              </div>
              <Input id="estimated_ready_at" name="estimated_ready_at" type="date" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving || (!selected && !showNewCustomer)}>
              {saving ? "Creating…" : "Create repair"}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link to="/repairs">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerProfileCard({
  customer,
  photoUrl,
  livePhotoPreview,
  onClear,
}: {
  customer: Customer;
  photoUrl: string | null;
  livePhotoPreview: string | null;
  onClear?: () => void;
}) {
  const display = livePhotoPreview ?? photoUrl;
  return (
    <div className="rounded-lg border p-4 bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center overflow-hidden border shrink-0">
          {display ? (
            <img src={display} alt={customer.name} className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{customer.name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <Phone className="h-3 w-3" /> {customer.phone}
          </div>
        </div>
        {onClear && (
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            Change
          </Button>
        )}
      </div>
    </div>
  );
}
