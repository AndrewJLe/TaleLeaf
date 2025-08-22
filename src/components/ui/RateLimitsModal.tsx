'use client';

import type { RateLimitInfo, TokenBucketStatus } from '@/lib/ai-service';
import { AI_PROVIDERS, aiService } from '@/lib/ai-service';
import { useEffect, useState } from 'react';
import { Button } from './Button';

interface RateLimitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RateLimitsModal({ isOpen, onClose }: RateLimitsModalProps) {
  const [bucketStatuses, setBucketStatuses] = useState<Map<string, TokenBucketStatus>>(new Map());
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const updateStatuses = () => {
      const newStatuses = new Map<string, TokenBucketStatus>();

      AI_PROVIDERS.forEach(provider => {
        const status = aiService.getTokenBucketStatus(provider.id);
        if (status) {
          newStatuses.set(provider.id, status);
        }
      });

      setBucketStatuses(newStatuses);
      setRateLimitInfo(aiService.getRateLimitInfo());
    };

    updateStatuses();
    const interval = setInterval(updateStatuses, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return Math.round(tokens).toString();
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    const hours = Math.round(seconds / 3600);
    return `${hours}h`;
  };

  const getUsageColor = (used: number, limit: number): string => {
    const usage = used / limit;
    if (usage >= 0.9) return 'bg-red-500';
    if (usage >= 0.7) return 'bg-orange-500';
    if (usage >= 0.5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">API Rate Limits</h2>
            <Button onClick={onClose} variant="secondary" size="sm">✕</Button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Real-time rate limit monitoring for all AI providers
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Explanation Section */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-900 mb-2">How OpenAI Rate Limits Work</h3>
            <div className="text-xs text-amber-800 space-y-1">
              <div>• <strong>Rolling Window:</strong> OpenAI tracks your usage over a sliding 60-second window</div>
              <div>• <strong>TPM (Tokens Per Minute):</strong> Maximum tokens you can use in any 60-second period</div>
              <div>• <strong>Long Cooldowns:</strong> Heavy usage can result in multi-hour wait times</div>
            </div>
          </div>

          {/* Current Rate Limit Alert */}
          {rateLimitInfo && rateLimitInfo.retryAfter && rateLimitInfo.retryAfter > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red-600 text-xl">🚫</span>
                <h3 className="text-lg font-bold text-red-800">Currently Rate Limited</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-red-700"><strong>Provider:</strong> {rateLimitInfo.provider}</div>
                  <div className="text-red-700"><strong>Used:</strong> {formatTokens(rateLimitInfo.tokensUsed)} tokens</div>
                  <div className="text-red-700"><strong>Requested:</strong> {formatTokens(rateLimitInfo.tokensRequested)} tokens</div>
                </div>
                <div>
                  <div className="text-red-700"><strong>Limit:</strong> {formatTokens(rateLimitInfo.tokensPerMinute)} TPM</div>
                  <div className="text-red-700"><strong>Wait Time:</strong> {formatTime(rateLimitInfo.retryAfter)}
                    {rateLimitInfo.retryAfter > 3600 && (
                      <span className="text-red-800"> ({Math.round(rateLimitInfo.retryAfter / 3600)} hours)</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-red-100 rounded text-xs text-red-800">
                <strong>Why so long?</strong> Your recent usage was very high. Even if you stop making requests now,
                it will take time for old requests to expire from OpenAI's 60-second rolling window.
              </div>
            </div>
          )}

          {/* Provider Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AI_PROVIDERS.map(provider => {
              const status = bucketStatuses.get(provider.id);
              const isRateLimited = rateLimitInfo?.provider === provider.id && rateLimitInfo.retryAfter && rateLimitInfo.retryAfter > 0;

              return (
                <div key={provider.id} className={`border rounded-lg p-4 ${isRateLimited ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                  }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{provider.name}</h4>
                      <p className="text-xs text-gray-500">{provider.description}</p>
                    </div>
                    {isRateLimited && <span className="text-red-600 text-lg">🚫</span>}
                  </div>

                  {status && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-gray-600">
                            Usage {status.isSimulated ? '(Estimated)' : '(API Data)'}
                            {!status.isSimulated && <span className="ml-1 text-amber-700">📡</span>}
                          </span>
                          <span className="text-sm font-mono">
                            {formatTokens(status.used)} / {formatTokens(status.limit)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(status.used, status.limit)}`}
                            style={{ width: `${Math.min(100, (status.used / status.limit) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Available: {formatTokens(status.available)}</span>
                          <span>{((status.used / status.limit) * 100).toFixed(1)}% used</span>
                        </div>
                      </div>

                      {isRateLimited && rateLimitInfo && (
                        <div className="text-xs text-red-700 bg-red-100 p-2 rounded">
                          <div><strong>Retry in:</strong> {formatTime(rateLimitInfo.retryAfter || 0)}</div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 space-y-1">
                        <div><strong>Rate Limit:</strong> {formatTokens(status.limit)} tokens/minute</div>
                        <div><strong>Tier:</strong> {provider.tier}</div>
                        <div><strong>Cost:</strong> {provider.costEstimate}</div>
                        {status.isSimulated && (
                          <div className="text-amber-600">⚠️ Estimated until you make a request</div>
                        )}
                      </div>
                    </div>
                  )}

                  {!status && (
                    <div className="text-xs text-gray-500">
                      No usage data available. Status will appear after making requests.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tips Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">💡 Tips to Avoid Rate Limits</h3>
            <div className="text-xs text-gray-700 space-y-1">
              <div>• <strong>Use GPT-4o-mini:</strong> Higher rate limits (100K TPM vs 30K TPM for GPT-4o)</div>
              <div>• <strong>Smaller contexts:</strong> Use the context window to limit input size</div>
              <div>• <strong>Batch operations:</strong> Wait between multiple AI generations</div>
              <div>• <strong>Monitor usage:</strong> Check this panel before large operations</div>
              <div>• <strong>Upgrade tier:</strong> Higher OpenAI tiers have higher rate limits</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
