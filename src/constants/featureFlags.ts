// Feature flags for TaleLeaf
// Controls rollout of new features behind development toggles

interface FeatureFlags {
  notesV2: boolean;
  locationsV2: boolean;
  aiSummaries: boolean;
  collabPreview: boolean;
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
    if (key && ['notesV2', 'locationsV2', 'aiSummaries', 'collabPreview'].includes(key)) {
      flags[key as keyof FeatureFlags] = value !== 'off' && value !== 'false';
    }
  });

  return flags;
}

// Get feature flag state (localStorage + query param overrides)
function getFeatureFlags(): FeatureFlags {
  const defaults: FeatureFlags = {
    // Enable normalized notes model by default now that book_notes table is live
    notesV2: true,
    locationsV2: false,
    aiSummaries: false,
    collabPreview: false
  };

  if (typeof window === 'undefined') return defaults;

  // Load from localStorage
  const stored: Partial<FeatureFlags> = {};
  Object.keys(defaults).forEach(key => {
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

export const featureFlags = getFeatureFlags();
export { setFeatureFlag };
export type { FeatureFlags };

// Dev helper: get current flags as object for debugging
export function getCurrentFlags(): FeatureFlags {
  return getFeatureFlags();
}
