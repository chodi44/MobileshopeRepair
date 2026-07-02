import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Copy, Trash2, Eye, EyeOff, Lock, Camera, User as UserIcon, X } from "lucide-react";
import {
  REPAIR_STATUSES,
  STATUS_LABEL,
  statusBadgeClass,
  type RepairStatus,
} from "@/lib/repair-status";
import { addCustomerPhoto, getCustomerPhotoUrl } from "@/lib/customer-photo";
import { parseTicketCode } from "@/lib/ticket";

export const Route = createFileRoute("/_authenticated/repairs/$id")({
  head: () => ({ meta: [{ title: "Repair — FixCell" }] }),
  component: RepairDetail,
});

type Job = {
  id: string;
  ticket_code: string;
  customer_id: string;
  device_brand: string;
  device_model: string;
  device_color: string | null;
  imei: string | null;
  reported_issue: string;
  status: RepairStatus;
  quoted_cost: number | null;
  estimated_ready_at: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  customer: { name: string; phone: string; email: string | null } | null;
};


type Note = {
  id: string;
  body: string;
  is_public: boolean;
  author_id: string;
  created_at: string;
};

function RepairDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [postingNote, setPostingNote] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photos, setPhotos] = useState<Array<{ id: string; kind: string; photo_path: string; note: string | null; created_at: string; url: string | null }>>([]);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [deliveryPreview, setDeliveryPreview] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliverySaving, setDeliverySaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: jobData, error: je }, { data: noteData }, { data: photoData }] = await Promise.all([
      supabase
        .from("repair_jobs")
        .select(
          "id, ticket_code, customer_id, device_brand, device_model, device_color, imei, reported_issue, status, quoted_cost, estimated_ready_at, created_at, deleted_at, deleted_reason, customer:customers(name, phone, email)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("repair_notes")
        .select("id, body, is_public, author_id, created_at")
        .eq("job_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_photos")
        .select("id, kind, photo_path, note, created_at")
        .eq("job_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (je) toast.error(je.message);
    setJob((jobData as unknown as Job) ?? null);
    setNotes((noteData ?? []) as Note[]);
    const rows = (photoData ?? []) as Array<{ id: string; kind: string; photo_path: string; note: string | null; created_at: string }>;
    const withUrls = await Promise.all(
      rows.map(async (p) => ({ ...p, url: await getCustomerPhotoUrl(p.photo_path) })),
    );
    setPhotos(withUrls);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(next: RepairStatus) {
    if (!job || next === job.status) return;
    // Marking as delivered requires capturing a delivery photo of the person picking up.
    if (next === "delivered") {
      setDeliveryOpen(true);
      return;
    }
    setSavingStatus(true);
    const { error } = await supabase.from("repair_jobs").update({ status: next }).eq("id", job.id);
    setSavingStatus(false);
    if (error) return toast.error(error.message);
    setJob({ ...job, status: next });
    toast.success("Status updated");
  }

  function onDeliveryPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Photo must be under 10MB");
      return;
    }
    if (deliveryPreview) URL.revokeObjectURL(deliveryPreview);
    setDeliveryFile(f);
    setDeliveryPreview(URL.createObjectURL(f));
  }

  function closeDelivery() {
    if (deliveryPreview) URL.revokeObjectURL(deliveryPreview);
    setDeliveryFile(null);
    setDeliveryPreview(null);
    setDeliveryNote("");
    setDeliveryOpen(false);
  }

  async function confirmDelivery() {
    if (!job) return;
    if (!deliveryFile) {
      toast.error("Take a photo of the person picking up the device");
      return;
    }
    setDeliverySaving(true);
    try {
      await addCustomerPhoto({
        customerId: job.customer_id,
        file: deliveryFile,
        kind: "delivery",
        jobId: job.id,
        note: deliveryNote.trim() || `Delivery of #${job.ticket_code}`,
      });
      const { error } = await supabase.from("repair_jobs").update({ status: "delivered" }).eq("id", job.id);
      if (error) throw error;
      toast.success("Marked as delivered");
      closeDelivery();
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete delivery";
      toast.error(msg);
    } finally {
      setDeliverySaving(false);
    }
  }


  async function addNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "").trim();
    const is_public = fd.get("is_public") === "on";
    if (!body) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setPostingNote(true);
    const { data, error } = await supabase
      .from("repair_notes")
      .insert({ job_id: id, body, is_public, author_id: userData.user.id })
      .select("id, body, is_public, author_id, created_at")
      .single();
    setPostingNote(false);
    if (error) return toast.error(error.message);
    setNotes((prev) => [data as Note, ...prev]);
    (e.currentTarget as HTMLFormElement).reset();
    toast.success(is_public ? "Public update posted" : "Internal note saved");
  }

  async function toggleNoteVisibility(n: Note) {
    const { error } = await supabase
      .from("repair_notes")
      .update({ is_public: !n.is_public })
      .eq("id", n.id);
    if (error) return toast.error(error.message);
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_public: !n.is_public } : x)));
  }

  async function deleteNote(noteId: string) {
    const { error } = await supabase.from("repair_notes").delete().eq("id", noteId);
    if (error) return toast.error(error.message);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  async function deleteJob() {
    if (!job) return;
    const reason = window.prompt(
      `Reason for removing repair ${job.ticket_code}?\n\nThis will not erase the record — it will stay in History with your reason.`,
    );
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("A reason is required.");
      return;
    }
    setDeleting(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("repair_jobs")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_reason: trimmed,
        deleted_by: userData.user?.id ?? null,
      })
      .eq("id", job.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Repair removed. It stays in history with your reason.");
    navigate({ to: "/repairs" });
  }


  function copyTrackingLink() {
    if (!job) return;
    const url = `${window.location.origin}/track/${job.ticket_code}`;
    navigator.clipboard.writeText(url);
    toast.success("Tracking link copied");
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!job) return <div className="text-sm">Repair not found.</div>;

  const isDeleted = !!job.deleted_at;
  const isLocked = job.status === "delivered" || isDeleted;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/repairs">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to repairs
        </Link>
      </Button>

      <div className="bg-card border rounded-xl p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-mono text-4xl font-bold leading-none">
                #{parseTicketCode(job.ticket_code).daily}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {parseTicketCode(job.ticket_code).full}
              </span>
              <span className={statusBadgeClass(job.status)}>{STATUS_LABEL[job.status]}</span>
              {isDeleted ? (
                <span className="text-xs font-medium bg-destructive/15 text-destructive rounded px-2 py-0.5">
                  Deleted
                </span>
              ) : job.status === "delivered" ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-muted rounded px-2 py-0.5">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              ) : null}
            </div>
            <h2 className="text-xl font-semibold mt-1">
              {job.device_brand} {job.device_model}
            </h2>
            <p className="text-sm text-muted-foreground">
              For {job.customer?.name} · {job.customer?.phone}
              {job.customer?.email ? ` · ${job.customer.email}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyTrackingLink}>
              <Copy className="h-4 w-4 mr-1" /> Tracking link
            </Button>
            {!isDeleted && (
              <Button variant="ghost" size="sm" onClick={deleteJob} disabled={deleting}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {isDeleted && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <div className="font-semibold text-destructive">This repair was removed.</div>
            <div className="mt-1">
              <span className="font-medium">Reason:</span> {job.deleted_reason || "(not provided)"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Removed on {new Date(job.deleted_at!).toLocaleString()}. The record stays in history and cannot be edited.
            </div>
          </div>
        )}

        {!isDeleted && job.status === "delivered" && (
          <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm">
            This repair was marked <strong>Delivered</strong> and moved to history. It is now read-only.
          </div>
        )}


        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-sm">
          <Field label="Color" value={job.device_color ?? "—"} />
          <Field label="IMEI" value={job.imei ?? "—"} />
          <Field
            label="Quoted"
            value={job.quoted_cost != null ? `$${job.quoted_cost.toFixed(2)}` : "—"}
          />
          <Field
            label="Ready by"
            value={job.estimated_ready_at ? new Date(job.estimated_ready_at).toLocaleDateString() : "—"}
          />
        </div>

        <div className="mt-6">
          <Label className="text-xs text-muted-foreground">Reported issue</Label>
          <p className="text-sm mt-1 whitespace-pre-wrap">{job.reported_issue}</p>
        </div>

        {!isLocked && (
          <div className="mt-6 pt-4 border-t">
            <Label htmlFor="status">Update status</Label>
            <select
              id="status"
              value={job.status}
              disabled={savingStatus}
              onChange={(e) => updateStatus(e.target.value as RepairStatus)}
              className="mt-2 w-full sm:w-64 h-9 rounded-md border bg-background px-3 text-sm"
            >
              {REPAIR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              Marking <strong>Delivered</strong> will lock this repair — you won't be able to edit it or its notes afterwards.
            </p>
          </div>
        )}
      </div>


      {/* Notes */}
      <div className="bg-card border rounded-xl p-6 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold mb-1">Notes & updates</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Mark a note as <strong>public</strong> to make it visible to the customer on their tracking page.
        </p>

        {!isLocked && (
          <form onSubmit={addNote} className="space-y-3 mb-6">
            <Textarea
              name="body"
              required
              rows={3}
              maxLength={2000}
              placeholder="e.g. Screen replaced, testing camera…"
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_public" className="h-4 w-4 accent-[hsl(var(--primary))]" />
                Share this update with the customer
              </label>
              <Button type="submit" size="sm" disabled={postingNote}>
                {postingNote ? "Posting…" : "Post note"}
              </Button>
            </div>
          </form>
        )}

        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        n.is_public
                          ? "inline-flex items-center gap-1 text-xs font-medium text-success"
                          : "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {n.is_public ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {n.is_public ? "Public" : "Internal"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  {!isLocked && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleNoteVisibility(n)}>
                        {n.is_public ? "Make internal" : "Make public"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteNote(n.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Visit photos for this repair */}
      <div className="bg-card border rounded-xl p-6 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold mb-1">Visit photos</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Intake and delivery snapshots for this repair. These are saved to the customer's gallery.
        </p>
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p) => (
              <a
                key={p.id}
                href={p.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-lg overflow-hidden border bg-muted"
              >
                <div className="aspect-square bg-muted">
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
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Delivery capture modal */}
      {deliveryOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeDelivery}>
          <div
            className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">Confirm delivery</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Take a clear photo of the person picking up the device. It will be saved to this customer's profile.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeDelivery}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center overflow-hidden border shrink-0">
                {deliveryPreview ? (
                  <img src={deliveryPreview} alt="Delivery" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-9 w-9 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => document.getElementById("delivery-photo-camera")?.click()}
                >
                  <Camera className="h-4 w-4 mr-1" /> Take photo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => document.getElementById("delivery-photo-file")?.click()}
                >
                  Choose file
                </Button>
                <input
                  id="delivery-photo-camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onDeliveryPhotoChange}
                />
                <input
                  id="delivery-photo-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onDeliveryPhotoChange}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="delivery-note" className="text-xs">Note (optional)</Label>
              <Input
                id="delivery-note"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="e.g. Picked up by brother, ID verified"
                maxLength={200}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={closeDelivery} disabled={deliverySaving}>
                Cancel
              </Button>
              <Button onClick={confirmDelivery} disabled={deliverySaving || !deliveryFile}>
                {deliverySaving ? "Saving…" : "Confirm delivery"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Once confirmed, this repair is locked — you won't be able to edit it or its notes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium truncate">{value}</div>
    </div>
  );
}
