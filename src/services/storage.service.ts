import { getSupabaseClient } from "../lib/supabase";
import { AppError } from "../utils/error";

export const BUCKETS = {
  KTP: "ktp",
  AVATAR: "avatar",
  CAMPAIGN_IMAGES: "campaign-images",
  CAMPAIGN_DOCS: "campaign-docs",
  WITHDRAWAL_PROOF: "withdrawal-proof",
} as const;

export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer | ArrayBuffer,
  contentType: string
): Promise<string> {
  const { error } = await getSupabaseClient()
    .storage.from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("[storage] upload error:", error.message);
    throw new AppError(500, "Gagal upload file");
  }

  const privateBuckets: string[] = [
    BUCKETS.KTP,
    BUCKETS.CAMPAIGN_DOCS,
    BUCKETS.WITHDRAWAL_PROOF,
  ];
  const isPrivate = privateBuckets.includes(bucket);

  if (isPrivate) return path;

  const { data } = getSupabaseClient().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .storage.from(bucket)
    .remove([path]);
  if (error) throw new AppError(500, "Gagal menghapus file");
}

export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number
): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .storage.from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw new AppError(500, "Gagal membuat signed URL");
  return data.signedUrl;
}
