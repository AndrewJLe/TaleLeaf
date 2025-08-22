// Types
export * from './types/book';

// Hooks
export { useAIGeneration } from './hooks/useAIGeneration';
export { useBookActions } from './hooks/useBookActions';
export { useExpandableFields } from './hooks/useExpandableFields';
export { useTooltip } from './hooks/useTooltip';

// UI Components
export { Button } from './components/ui/Button';
export { ExpandableTextArea } from './components/ui/ExpandableTextArea';
export { TabNavigation } from './components/ui/TabNavigation';
export { Tooltip } from './components/ui/Tooltip';

// Section Components
export { ChaptersSection } from './components/sections/ChaptersSection';
export { CharactersSection } from './components/sections/CharactersSection';
export { LocationsSection } from './components/sections/LocationsSection';
export { NotesSection } from './components/sections/NotesSection';

// Main Components
export { default as AISettingsModal } from './components/AISettingsModal';
export { default as BookEditor, default as BookEditorRefactored } from './components/BookEditor';
export { default as ContextWindow } from './components/ContextWindow';

