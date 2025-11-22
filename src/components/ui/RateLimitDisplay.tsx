"use client";

import type { RateLimitInfo, TokenBucketStatus } from "@/lib/ai-service";
import { aiService } from "@/lib/ai-service";
import { useEffect, useState } from "react";

interface RateLimitDisplayProps {
  variant?: "compact" | "detailed";
  provider?: string;
  className?: string;
}

export function RateLimitDisplay({
  variant = "compact",
  provider,
  className = "",
}: RateLimitDisplayProps) {
  const [bucketStatus, setBucketStatus] = useState<TokenBucketStatus | null>(
    null,
  );
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(
    null,
  );
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    const updateStatus = () => {
      const status = aiService.getTokenBucketStatus(provider);
      const rateLimitData = aiService.getRateLimitInfo();
      setBucketStatus(status);
      setRateLimitInfo(rateLimitData);
      setLastUpdate(Date.now());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000); // Update every second for live drain

    return () => clearInterval(interval);
  }, [provider]);

  if (!bucketStatus && !rateLimitInfo) {
    return null;
  }

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return Math.round(tokens).toString();
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getStatusColor = (used: number, limit: number): string => {
    const usage = used / limit;
    if (usage >= 0.9) return "text-red-600 bg-red-50 border-red-200";
    if (usage >= 0.7) return "text-orange-600 bg-orange-50 border-orange-200";
    if (usage >= 0.5) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-green-600 bg-green-50 border-green-200";
  };

  const getProgressColor = (used: number, limit: number): string => {
    const usage = used / limit;
    if (usage >= 0.9) return "bg-red-500";
    if (usage >= 0.7) return "bg-orange-500";
    if (usage >= 0.5) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (variant === "compact") {
    const status = bucketStatus || {
      used: rateLimitInfo?.tokensUsed || 0,
      limit: rateLimitInfo?.tokensPerMinute || 100000,
      available: 0,
      drainRate: 0,
      lastUpdate: Date.now(),
      provider: provider || "unknown",
      isSimulated: true,
    };

    const usagePercent = (status.used / status.limit) * 100;
    const isRateLimited =
      rateLimitInfo?.retryAfter && rateLimitInfo.retryAfter > 0;

    return (
      <div
        className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border text-xs font-medium ${isRateLimited
            ? "text-red-600 bg-red-50 border-red-200"
            : getStatusColor(status.used, status.limit)
          } ${className}`}
      >
        {isRateLimited ? (
          <div className="flex items-center gap-1">
            <span className="text-red-600">⛔ Rate Limited</span>
            <span className="text-red-600 font-mono">
              {formatTime(rateLimitInfo.retryAfter || 0)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getProgressColor(status.used, status.limit)}`}
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>
            <span className="tabular-nums">
              {formatTokens(status.used)}/{formatTokens(status.limit)}
            </span>
            {!status.isSimulated && <span className="text-amber-700">📡</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`p-4 bg-white border rounded-lg shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Rate Limit Status
        </h3>
        <span className="text-xs text-gray-500">
          {bucketStatus?.provider || rateLimitInfo?.provider || "Unknown"}
        </span>
      </div>

      {rateLimitInfo &&
        rateLimitInfo.retryAfter &&
        rateLimitInfo.retryAfter > 0 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-600 text-lg">🚫</span>
              <div className="text-sm font-medium text-red-800">
                Rate Limited by OpenAI
              </div>
            </div>
            <div className="text-xs text-red-700 space-y-1">
              <div>
                <strong>Used:</strong> {formatTokens(rateLimitInfo.tokensUsed)}{" "}
                tokens in rolling 60s window
              </div>
              <div>
                <strong>Requested:</strong>{" "}
                {formatTokens(rateLimitInfo.tokensRequested)} tokens
              </div>
              <div>
                <strong>Limit:</strong>{" "}
                {formatTokens(rateLimitInfo.tokensPerMinute)} tokens per minute
              </div>
              <div className="font-medium text-red-800 bg-red-100 px-2 py-1 rounded mt-2">
                ⏳ Must wait: {formatTime(rateLimitInfo.retryAfter)} (
                {rateLimitInfo.retryAfter > 3600
                  ? `${Math.round(rateLimitInfo.retryAfter / 3600)} hours`
                  : ""}
                )
              </div>
            </div>
            <div className="mt-3 text-xs text-red-600 bg-red-100 p-2 rounded">
              💡 <strong>Why so long?</strong> OpenAI uses a rolling 60-second
              window. Your recent usage is so high that even stopping
              completely, it will take{" "}
              {Math.round(rateLimitInfo.retryAfter / 3600)} hours for old
              requests to &quot;expire&quot; from the window.
            </div>
          </div>
        )}

      {bucketStatus &&
        (!rateLimitInfo ||
          !rateLimitInfo.retryAfter ||
          rateLimitInfo.retryAfter <= 0) && (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">
                  {bucketStatus.isSimulated
                    ? "Estimated Usage"
                    : "Actual Usage (from API)"}
                  {!bucketStatus.isSimulated && (
                    <span className="ml-1 text-amber-700">📡</span>
                  )}
                </span>
                <span className="text-sm font-mono">
                  {formatTokens(bucketStatus.used)} /{" "}
                  {formatTokens(bucketStatus.limit)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(bucketStatus.used, bucketStatus.limit)}`}
                  style={{
                    width: `${Math.min(100, (bucketStatus.used / bucketStatus.limit) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Available: {formatTokens(bucketStatus.available)}</span>
                {bucketStatus.isSimulated && (
                  <span>⚠️ Simulated - may be inaccurate</span>
                )}
              </div>
            </div>

            {bucketStatus.available < bucketStatus.limit * 0.1 && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                ⚠️ Approaching rate limit. Next request may be blocked.
              </div>
            )}
          </div>
        )}

      <div className="mt-3 text-xs text-gray-500 border-t pt-2">
        <div>Last updated: {new Date(lastUpdate).toLocaleTimeString()}</div>
        <div className="mt-1 space-y-1">
          <div>
            📊 OpenAI uses a <strong>rolling 60-second window</strong>
          </div>
          <div>
            🕐 Rate limits reset gradually as old requests expire from the
            window
          </div>
          {bucketStatus?.isSimulated && (
            <div className="text-amber-600">
              ⚠️ Display is estimated until you make a request
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
