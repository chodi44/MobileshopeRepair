import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Camera, User as UserIcon, X } from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_LANGUAGES, isLanguageCode } from "@/lib/i18n";
import { uploadCustomerPhoto } from "@/lib/customer-photo";
import { WebcamCapture } from "@/components/ui/webcam-capture";

export const Route = createFileRoute("/_authenticated/customers/new")({
  head: () => ({ meta: [{ title: "New customer — MP Repair" }] }),
  component: NewCustomerPage,
});

const E164 = /^\+[1-9]\d{6,14}$/;
const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  phone: z.string().trim().regex(E164, "Phone must be in international format, e.g. +14155551234"),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  preferred_language: z.string().refine(isLanguageCode, "Invalid language"),
});

type Existing = { id: string; name: string; phone: string; email: string | null };

function NewCustomerPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<Existing | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showWebcam, setShowWebcam] = useState(false);

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

  async function checkPhone(phone: string) {
    if (!E164.test(phone)) {
      setExisting(null);
      return;
    }
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone, email")
      .eq("phone", phone)
      .maybeSingle();
    setExisting((data as Existing) ?? null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: fd.get("name"),
      phone: fd.get("phone"),
      email: fd.get("email") || "",
      address: fd.get("address") || "",
      notes: fd.get("notes") || "",
      preferred_language: fd.get("preferred_language") || "en",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase
      .from("customers")
      .insert({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
        preferred_language: parsed.data.preferred_language,
        created_by: u.user?.id,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      setLoading(false);
      toast.error(error?.message ?? "Failed to save customer");
      return;
    }
    if (photoFile) {
      try {
        const path = await uploadCustomerPhoto(inserted.id, photoFile);
        await supabase.from("customers").update({ photo_url: path }).eq("id", inserted.id);
      } catch (err) {
        toast.warning("Customer saved, but photo upload failed");
        console.error(err);
      }
    }
    setLoading(false);
    toast.success("Customer added");
    navigate({ to: "/customers/$id", params: { id: inserted.id } });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/customers">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Link>
      </Button>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">New customer</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter details carefully — once saved they are locked. If the phone number already exists,
          use the existing profile instead.
        </p>
      </div>
      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-28 w-28 rounded-full bg-muted flex items-center justify-center overflow-hidden border shrink-0">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-10 w-10 text-muted-foreground" />
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
                  onClick={() => document.getElementById("photo-file")?.click()}
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
                id="photo-file"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhotoChange}
              />
              <p className="text-xs text-muted-foreground">Use good lighting for a clear ID photo. JPG/PNG, up to 10MB.</p>
            </div>
          </div>
          {showWebcam && (
            <WebcamCapture
              onCapture={onWebcamCapture}
              onClose={() => setShowWebcam(false)}
            />
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone * (e.g. +14155551234)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="+14155551234"
                maxLength={20}
                onBlur={(e) => checkPhone(e.target.value.trim())}
              />
            </div>
          </div>

          {existing && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <div className="font-medium text-warning-foreground">
                A customer with this phone already exists: {existing.name}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    navigate({ to: "/repairs/new", search: { customer: existing.id } as never })
                  }
                >
                  Use existing & create repair
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate({ to: "/customers/$id", params: { id: existing.id } })}
                >
                  Open profile
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="preferred_language">Preferred language for notifications</Label>
            <select
              id="preferred_language"
              name="preferred_language"
              defaultValue="en"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} — {l.nativeLabel}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" maxLength={500} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" maxLength={1000} rows={3} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading || !!existing}>
              {loading ? "Saving…" : "Save customer"}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link to="/customers">Cancel</Link>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
