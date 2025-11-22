import { useEffect, useState } from "react";
import { featureFlags, setFeatureFlag } from "../constants/featureFlags";

export function FeatureFlagDebug() {
  const isClient =
    typeof window !== "undefined" && process.env.NODE_ENV !== "production";

  const [minimized, setMinimized] = useState<boolean>(() => {
    if (!isClient) return false;
    try {
      return localStorage.getItem("ff.ui.minimized") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!isClient) return;
    try {
      if (minimized) localStorage.setItem("ff.ui.minimized", "1");
      else localStorage.removeItem("ff.ui.minimized");
    } catch {
      // ignore
    }
  }, [isClient, minimized]);

  if (!isClient) return null;

  const flags = featureFlags as { debugAIChat: boolean };

  if (minimized) {
    return (
      <div
        className="fixed bottom-4 right-4 bg-gray-900 text-white p-2 rounded-md text-xs font-mono shadow-lg z-50 cursor-pointer"
        onClick={() => setMinimized(false)}
      >
        <div className="flex items-center gap-2">
          <div className="font-bold">🚩 Flags</div>
          <div className="text-xs text-gray-300">
            {flags.debugAIChat ? "AI Debug ON" : "AI Debug OFF"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-3 rounded-lg text-xs font-mono shadow-lg z-50">
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold">🚩 Feature Flags</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMinimized(true)}
            className="text-gray-300 hover:text-white"
          >
            ─
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-1">
        <span
          className={flags.debugAIChat ? "text-green-400" : "text-gray-400"}
        >
          debugAIChat
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs">{flags.debugAIChat ? "ON" : "OFF"}</span>
          <button
            onClick={() => setFeatureFlag("debugAIChat", !flags.debugAIChat)}
            className="text-blue-400 hover:text-blue-300 ml-1 px-1"
          >
            ⚡
          </button>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-600 text-gray-400 text-xs">
        URL example: <code className="text-xs">?ff=debugAIChat</code>
      </div>
    </div>
  );
}
