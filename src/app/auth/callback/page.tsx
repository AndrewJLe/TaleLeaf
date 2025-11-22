"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseClient } from "../../../lib/supabase-client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [status, setStatus] = useState("Finishing sign-in...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function finish() {
      if (!supabaseClient) {
        setError("Supabase not configured");
        return;
      }
      try {
        // Supabase JS v2 handles the hash fragment automatically on page load if persistSession=true.
        // We just poll for a session briefly.
        for (let i = 0; i < 20; i++) {
          const {
            data: { session },
          } = await supabaseClient.auth.getSession();
          if (session) {
            if (!cancelled) {
              setStatus("Signed in. Redirecting...");
              setTimeout(() => router.replace("/profile"), 600);
            }
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        setError("Could not establish session. Link may have expired.");
      } catch (e: any) {
        setError(e.message || "Unexpected error");
      }
    }
    finish();
    return () => {
      cancelled = true;
    };
  }, [router, search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-emerald-25 to-amber-50/30 p-6">
      <div className="max-w-sm w-full bg-white/80 backdrop-blur-sm border border-emerald-200 rounded-xl p-6 text-center space-y-4">
        <div className="flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-2xl">
            🍃
          </div>
        </div>
        <h1 className="text-xl font-semibold text-emerald-900">
          Authenticating
        </h1>
        {!error ? (
          <div className="flex flex-col items-center gap-3 text-sm text-emerald-700">
            <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p>{status}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button
              onClick={() => router.replace("/profile")}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
            >
              Back to Profile
            </button>
          </div>
        )}
        <p className="text-[10px] text-emerald-500">
          You can close this tab if it doesn't redirect shortly.
        </p>
      </div>
    </div>
  );
}
