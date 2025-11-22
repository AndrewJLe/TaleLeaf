import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Creates a server-side Supabase client. If an access token is provided we set it
// as a bearer header so that RLS policies evaluate in the context of that user.
export function createServerSupabase(accessToken?: string): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing SUPABASE_URL");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const global = accessToken
    ? { headers: { Authorization: `Bearer ${accessToken}` } }
    : undefined;
  return createClient(url, anon, {
    auth: { persistSession: false, detectSessionInUrl: false },
    global,
  });
}
