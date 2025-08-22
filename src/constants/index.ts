// UI Constants
export const DEFAULT_PAGE_COUNT = 300;
export const DEFAULT_TEXTAREA_ROWS = 4;
export const DEFAULT_EXPANDED_TEXTAREA_ROWS = 8;
export const NOTES_EXPANDED_ROWS = 12;

// Z-Index Constants
export const Z_INDEX = {
    TOOLTIP: 50,
    MODAL: 100,
    DROPDOWN: 40
} as const;

// Animation Durations
export const ANIMATION_DURATION = {
    SHORT: 200,
    MEDIUM: 300,
    LONG: 500
} as const;

// Storage Keys
export const STORAGE_KEYS = {
    AI_SETTINGS: 'taleleaf:ai-settings',
    BOOKS: 'taleleaf:books'
} as const;

// Error Messages
export const ERROR_MESSAGES = {
    AI_GENERATION_FAILED: 'Failed to generate content. Please try again.',
    API_KEY_MISSING: 'API key required. Please configure it in settings.',
    INVALID_PROVIDER: 'Invalid AI provider selected',
    NETWORK_ERROR: 'Network error. Please check your connection.'
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
    CONTENT_GENERATED: 'Content generated successfully!',
    SETTINGS_SAVED: 'Settings saved successfully!',
    BOOK_SAVED: 'Book saved successfully!'
} as const;
