import { supabase } from "@/integrations/supabase/client";

export const CUSTOMER_PHOTO_BUCKET = "customer-photos"; // kept for legacy compat

export type CustomerPhotoKind = "profile" | "intake" | "delivery" | "other";

/**
 * Uploads a photo to Cloudinary via our secure server-side API route.
 * Returns the full Cloudinary HTTPS URL (not a path).
 */
export async function uploadCustomerPhoto(customerId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("customerId", customerId);

  const res = await fetch("/api/upload-photo", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error ?? "Photo upload failed");
  }

  const { url } = await res.json();
  return url; // full Cloudinary URL e.g. https://res.cloudinary.com/xjl56xwy/...
}

/**
 * Returns the photo URL.
 * For Cloudinary URLs (https://), returns as-is.
 * For legacy Supabase paths, creates a signed URL.
 */
export async function getCustomerPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;

  // New format: full Cloudinary URL
  if (path.startsWith("https://")) return path;

  // Legacy: Supabase Storage path — create signed URL
  const { data, error } = await supabase.storage
    .from(CUSTOMER_PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Uploads a photo to Cloudinary and records it in the customer_photos gallery.
 * If the customer has no profile photo yet, promotes this as the profile photo.
 */
export async function addCustomerPhoto(params: {
  customerId: string;
  file: File;
  kind: CustomerPhotoKind;
  jobId?: string | null;
  note?: string | null;
  setAsProfileIfMissing?: boolean;
}): Promise<{ path: string; setAsProfile: boolean }> {
  const url = await uploadCustomerPhoto(params.customerId, params.file);
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from("customer_photos").insert({
    customer_id: params.customerId,
    job_id: params.jobId ?? null,
    kind: params.kind,
    photo_path: url,
    note: params.note ?? null,
    taken_by: userData.user?.id ?? null,
  });
  if (error) throw error;

  let setAsProfile = false;
  if (params.setAsProfileIfMissing) {
    const { data: cust } = await supabase
      .from("customers")
      .select("photo_url")
      .eq("id", params.customerId)
      .maybeSingle();
    if (cust && !cust.photo_url) {
      const { error: upErr } = await supabase
        .from("customers")
        .update({ photo_url: url })
        .eq("id", params.customerId);
      if (!upErr) setAsProfile = true;
    }
  }
  return { path: url, setAsProfile };
}
