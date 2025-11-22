import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "./supabase-client";
import { isSupabaseEnabled } from "./supabase-enabled";

async function ensureSession(): Promise<Session | null> {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}

export async function uploadCover(
  file: File,
  bookId: string,
): Promise<string | null> {
  if (!isSupabaseEnabled || !supabaseClient) return null;
  const session = await ensureSession();
  if (!session) return null;
  const userId = session.user.id;

  // Basic client-side shrink (max 800px) to save storage/cost
  let blob: Blob = file;
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    if (scale < 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blobOut: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/jpeg", 0.82),
      );
      if (blobOut) blob = blobOut;
    }
  } catch {
    // ignore resize errors, fallback to original file
  }

  const path = `${userId}/${bookId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const { error: upErr } = await supabaseClient.storage
    .from("covers")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (upErr) throw upErr;
  const { data } = supabaseClient.storage.from("covers").getPublicUrl(path);
  return data.publicUrl;
}
