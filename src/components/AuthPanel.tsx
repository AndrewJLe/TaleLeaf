"use client";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseClient } from "../lib/supabase-client";

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!supabaseClient) return;
    supabaseClient.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) =>
        setSession(data.session),
      );
    const { data: sub } = supabaseClient.auth.onAuthStateChange(
      (_e: any, s: Session | null) => setSession(s),
    );
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const sendMagic = async () => {
    if (!supabaseClient) return;
    setSending(true);
    setStatus(
      mode === "signup" ? "Sending sign up link..." : "Sending sign in link...",
    );
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/auth/callback`;
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: mode === "signup",
        },
      });
      if (error) setStatus(error.message);
      else
        setStatus(
          `Magic link sent. Check your email to ${mode === "signup" ? "complete sign up" : "sign in"}.`,
        );
    } catch (e: any) {
      setStatus(e.message || "Failed to send link");
    } finally {
      setSending(false);
    }
  };

  // Optional: allow user to enter a code if using email OTP type (Supabase can send a one-time code)
  const verifyCode = async () => {
    if (!supabaseClient) return;
    if (!otpCode || otpCode.length < 6) {
      setStatus("Enter the 6-digit code.");
      return;
    }
    setSending(true);
    setStatus("Verifying code...");
    try {
      const { data, error } = await supabaseClient.auth.verifyOtp({
        type: "magiclink",
        email,
        token: otpCode,
      });
      if (error) setStatus(error.message);
      else setStatus("Signed in. Redirecting...");
      if (data?.session) router.replace("/profile");
    } catch (e: any) {
      setStatus(e.message || "Failed to verify code");
    } finally {
      setSending(false);
    }
  };

  const signOut = async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
  };

  const signInWithGoogle = async () => {
    if (!supabaseClient) return;
    setSending(true);
    setStatus("Redirecting to Google...");
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            // prompt: 'select_account', // uncomment to always force account picker
          },
        },
      });
    } catch (e: any) {
      setSending(false);
      setStatus(e.message || "Google sign-in failed");
    }
  };

  if (!supabaseClient) return null;

  return (
    <div className="p-5 border border-emerald-200 rounded-xl bg-white/80 space-y-4 max-w-sm shadow-sm">
      {session ? (
        <div className="space-y-2 text-sm">
          <div className="font-medium text-emerald-800">Signed in</div>
          <div className="text-emerald-600 break-all">{session.user.email}</div>
          <button
            onClick={signOut}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-medium tracking-wide">
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setMode("signin");
                  setStatus("");
                }}
                className={`px-2 py-1 rounded ${mode === "signin" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setMode("signup");
                  setStatus("");
                }}
                className={`px-2 py-1 rounded ${mode === "signup" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
              >
                Sign Up
              </button>
            </div>
            <button
              onClick={() => setShowCodeEntry((s) => !s)}
              className="text-emerald-600 hover:text-emerald-700 underline decoration-dotted"
            >
              {showCodeEntry ? "Use Magic Link" : "Have a Code?"}
            </button>
          </div>
          <button
            onClick={signInWithGoogle}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-emerald-300 rounded-lg bg-white hover:bg-emerald-50 text-sm font-medium text-emerald-800 disabled:opacity-50"
          >
            <span className="text-lg">🟢</span>
            <span>
              {mode === "signup"
                ? "Continue with Google"
                : "Sign in with Google"}
            </span>
          </button>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-emerald-200" />
            <span className="text-[10px] uppercase tracking-wider text-emerald-500">
              or email
            </span>
            <div className="h-px flex-1 bg-emerald-200" />
          </div>
          <div className="space-y-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              className="w-full px-3 py-2 border border-emerald-300 rounded focus:ring-2 focus:ring-emerald-500"
            />
            {!showCodeEntry && (
              <button
                onClick={sendMagic}
                disabled={!email || sending}
                className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-700 flex items-center justify-center gap-2 text-sm font-medium"
              >
                {sending && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>
                  {mode === "signup"
                    ? "Send Sign Up Link"
                    : "Send Sign In Link"}
                </span>
              </button>
            )}
            {showCodeEntry && (
              <div className="space-y-2">
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  inputMode="numeric"
                  className="w-full px-3 py-2 border border-emerald-300 rounded focus:ring-2 focus:ring-emerald-500 tracking-widest text-center"
                />
                <button
                  onClick={verifyCode}
                  disabled={!email || !otpCode || sending}
                  className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-700 flex items-center justify-center gap-2 text-sm font-medium"
                >
                  {sending && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Verify Code</span>
                </button>
              </div>
            )}
            {status && (
              <div className="text-xs text-emerald-700 leading-relaxed min-h-[1.25rem]">
                {status}
              </div>
            )}
            {!showCodeEntry && (
              <div className="text-[10px] text-emerald-500">
                We send a one-time {mode === "signup" ? "sign-up" : "sign-in"}{" "}
                link. It works on this device only.
              </div>
            )}
            {mode === "signin" && (
              <div className="text-[11px] text-emerald-700/80">
                Don&rsquo;t have an account?{" "}
                <button
                  onClick={() => {
                    setMode("signup");
                    setStatus("");
                  }}
                  className="underline decoration-dotted hover:text-emerald-800"
                >
                  Sign up here
                </button>
              </div>
            )}
            {mode === "signup" && (
              <div className="text-[11px] text-emerald-700/80">
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("signin");
                    setStatus("");
                  }}
                  className="underline decoration-dotted hover:text-emerald-800"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
