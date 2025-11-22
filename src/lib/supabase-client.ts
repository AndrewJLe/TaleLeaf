import { createClient } from "@supabase/supabase-js";

// These will be provided via NEXT_PUBLIC_ env vars for client usage.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Safe to create a single instance for client-side calls.
export const supabaseClient =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : (null as any);
