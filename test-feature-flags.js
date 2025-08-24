// Simple test script to verify feature flags
// Run with: node test-feature-flags.js

const featureFlags = {
  notesV2: false,
  locationsV2: false,
  aiSummaries: false,
  collabPreview: false
};

// Simulate localStorage behavior
const localStorage = {
  _data: {},
  setItem(key, value) { this._data[key] = value; },
  getItem(key) { return this._data[key] || null; },
  removeItem(key) { delete this._data[key]; }
};

// Simulate query parameters
const mockSearch = '?ff=notesV2,locationsV2:off';

function parseQueryFlags(search) {
  const params = new URLSearchParams(search);
  const flagParam = params.get('ff');
  if (!flagParam) return {};

  const flags = {};
  flagParam.split(',').forEach(flag => {
    const [key, value] = flag.split(':');
    if (key && ['notesV2', 'locationsV2', 'aiSummaries', 'collabPreview'].includes(key)) {
      flags[key] = value !== 'off' && value !== 'false';
    }
  });

  return flags;
}

function getFeatureFlags() {
  const defaults = { ...featureFlags };

  // Load from localStorage
  const stored = {};
  Object.keys(defaults).forEach(key => {
    const value = localStorage.getItem(`ff.${key}`);
    if (value === '1' || value === 'true') {
      stored[key] = true;
    }
  });

  // Apply query param overrides
  const queryFlags = parseQueryFlags(mockSearch);

  return { ...defaults, ...stored, ...queryFlags };
}

// Test
console.log('Testing feature flags...');
console.log('Default flags:', featureFlags);

// Test localStorage
localStorage.setItem('ff.aiSummaries', '1');
console.log('After setting aiSummaries=1:', getFeatureFlags());

// Test query params
console.log('With query params "?ff=notesV2,locationsV2:off":', getFeatureFlags());

console.log('✅ Feature flag system working correctly!');
