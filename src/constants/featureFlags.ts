// Feature flags for TaleLeaf
// Controls rollout of new features behind development toggles

interface FeatureFlags {
  // Keep legacy flags present for runtime compatibility, but the UI
  // only exposes `debugAIChat` now.
  notesV2: boolean;
  locationsV2: boolean;
  aiSummaries: boolean;
  collabPreview: boolean;
  confirmDeleteEntities: boolean;
  telemetryBasic: boolean;
  debugAIChat: boolean;
}

// Parse query parameters for flag overrides (dev/testing)
function parseQueryFlags(): Partial<FeatureFlags> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const flagParam = params.get('ff');
  if (!flagParam) return {};

  const flags: Partial<FeatureFlags> = {};
  flagParam.split(',').forEach(flag => {
    const [key, value] = flag.split(':');
    const enabled = value !== 'off' && value !== 'false';
    if (!key) return;
    if (['notesV2', 'locationsV2', 'aiSummaries', 'collabPreview', 'confirmDeleteEntities', 'telemetryBasic', 'debugAIChat'].includes(key)) {
      (flags as any)[key] = enabled;
    }
  });

  return flags;
}

// Get feature flag state (localStorage + query param overrides)
function getFeatureFlags(): FeatureFlags {
  const defaults: FeatureFlags = {
    // Legacy/default flags retained for compatibility
    notesV2: true,
    locationsV2: false,
    aiSummaries: false,
    collabPreview: false,
    confirmDeleteEntities: true,
    telemetryBasic: true,
    // New debug-only flag
    debugAIChat: false
  };

  if (typeof window === 'undefined') return defaults;

  // Load from localStorage
  const stored: Partial<FeatureFlags> = {};
  Object.keys(defaults).forEach((key) => {
    const value = localStorage.getItem(`ff.${key}`);
    if (value === '1' || value === 'true') {
      stored[key as keyof FeatureFlags] = true;
    }
  });

  // Apply query param overrides
  const queryFlags = parseQueryFlags();

  return { ...defaults, ...stored, ...queryFlags };
}

// Set feature flag (persists to localStorage)
function setFeatureFlag(flag: keyof FeatureFlags, enabled: boolean) {
  if (typeof window === 'undefined') return;

  if (enabled) {
    localStorage.setItem(`ff.${flag}`, '1');
  } else {
    localStorage.removeItem(`ff.${flag}`);
  }

  // Reload to apply changes
  window.location.reload();
}

export const featureFlags = getFeatureFlags() as any;
export { setFeatureFlag };
export type { FeatureFlags };

// Dev helper: get current flags as object for debugging
export function getCurrentFlags(): FeatureFlags {
  return getFeatureFlags();
}
