// Types
export * from './types/book';

// Hooks
export { useAIGeneration } from './hooks/useAIGeneration';
export { useBookActions } from './hooks/useBookActions';
export { useTooltip } from './hooks/useTooltip';

// UI Components
export { Button } from './components/ui/Button';
export { TabNavigation } from './components/ui/TabNavigation';
export { Tooltip } from './components/ui/Tooltip';

// Section Components
export { ChaptersSection } from './components/sections/ChaptersSection';
export { CharactersSection } from './components/sections/CharactersSection';
export { LocationsSection } from './components/sections/LocationsSection';
// Normalized notes section (legacy NotesSection removed)
export { NotesNormalizedSection } from './components/sections/NotesNormalizedSection';

// Shared utilities
export { colorForTagName, readableTextColor, TAG_PALETTE } from './lib/tag-colors';

// Main Components
export { default as BookEditor } from './components/BookEditor';
export { default as ContextWindow } from './components/ContextWindow';

