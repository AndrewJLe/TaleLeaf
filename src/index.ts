// Types
export * from './types/book';

// Hooks
export { useExpandableFields } from './hooks/useExpandableFields';
export { useAIGeneration } from './hooks/useAIGeneration';
export { useTooltip } from './hooks/useTooltip';
export { useBookActions } from './hooks/useBookActions';

// UI Components
export { Button } from './components/ui/Button';
export { Tooltip } from './components/ui/Tooltip';
export { ExpandableTextArea } from './components/ui/ExpandableTextArea';
export { TabNavigation } from './components/ui/TabNavigation';

// Section Components
export { CharactersSection } from './components/sections/CharactersSection';
export { ChaptersSection } from './components/sections/ChaptersSection';
export { LocationsSection } from './components/sections/LocationsSection';
export { NotesSection } from './components/sections/NotesSection';

// Main Components
export { default as BookEditor } from './components/BookEditor';
export { default as BookEditorRefactored } from './components/BookEditorRefactored';
export { default as ContextWindow } from './components/ContextWindow';
export { default as AISettingsModal } from './components/AISettingsModal';
