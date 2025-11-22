import { supabaseClient } from "./supabase-client";

const BUCKET = "books";

export async function uploadPDF(
  userId: string,
  bookId: string,
  file: File | Blob,
  filename: string,
) {
  if (!supabaseClient) throw new Error("Supabase not initialized");
  const path = `${userId}/${bookId}/${Date.now()}-${filename}`;
  const { error } = await supabaseClient.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: "application/pdf",
    });
  if (error) throw error;
  return path;
}

export async function getSignedPDFUrl(path: string, expiresInSeconds = 60) {
  if (!supabaseClient) throw new Error("Supabase not initialized");
  const { data, error } = await supabaseClient.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadPDF(path: string): Promise<Blob> {
  if (!supabaseClient) throw new Error("Supabase not initialized");
  const { data, error } = await supabaseClient.storage
    .from(BUCKET)
    .download(path);
  if (error) throw error;
  return data as Blob;
}
