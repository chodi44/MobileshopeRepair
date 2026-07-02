import { supabase } from "@/integrations/supabase/client";

export const CUSTOMER_PHOTO_BUCKET = "customer-photos";

export type CustomerPhotoKind = "profile" | "intake" | "delivery" | "other";

export async function uploadCustomerPhoto(customerId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${customerId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage
    .from(CUSTOMER_PHOTO_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return path;
}

export async function getCustomerPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(CUSTOMER_PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Uploads a photo to storage and records it in the customer_photos gallery.
 * If the customer has no permanent profile photo yet AND kind is 'intake' or 'profile',
 * also sets it as the permanent profile photo (which is then locked).
 */
export async function addCustomerPhoto(params: {
  customerId: string;
  file: File;
  kind: CustomerPhotoKind;
  jobId?: string | null;
  note?: string | null;
  setAsProfileIfMissing?: boolean;
}): Promise<{ path: string; setAsProfile: boolean }> {
  const path = await uploadCustomerPhoto(params.customerId, params.file);
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from("customer_photos").insert({
    customer_id: params.customerId,
    job_id: params.jobId ?? null,
    kind: params.kind,
    photo_path: path,
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
        .update({ photo_url: path })
        .eq("id", params.customerId);
      if (!upErr) setAsProfile = true;
    }
  }
  return { path, setAsProfile };
}
