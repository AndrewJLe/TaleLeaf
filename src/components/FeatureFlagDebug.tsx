import React from 'react';
import { featureFlags, setFeatureFlag } from '../constants/featureFlags';

export function FeatureFlagDebug() {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-3 rounded-lg text-xs font-mono shadow-lg z-50">
      <div className="font-bold mb-2">🚩 Feature Flags</div>
      {Object.entries(featureFlags).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-3 mb-1">
          <span className={value ? 'text-green-400' : 'text-gray-400'}>
            {key}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-xs">{value ? 'ON' : 'OFF'}</span>
            <button
              onClick={() => setFeatureFlag(key as keyof typeof featureFlags, !value)}
              className="text-blue-400 hover:text-blue-300 ml-1 px-1"
            >
              ⚡
            </button>
          </div>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t border-gray-600 text-gray-400 text-xs">
        URL: ?ff=notesV2,locationsV2:off
      </div>
    </div>
  );
}
