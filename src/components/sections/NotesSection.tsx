import React, { useEffect, useState } from 'react';
import { Note } from '../../types/book';
import { Button } from '../ui/Button';
import { ChevronDownIcon, ChevronUpIcon, NotebookIcon, PlusIcon, SaveIcon, SparklesIcon, TrashIcon, UndoIcon } from '../ui/Icons';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { SaveStateIndicator } from '../ui/SaveStateIndicator';
import { SaveStatus } from '../ui/SaveStatus';
import { Tooltip } from '../ui/Tooltip';

interface NotesSectionProps {
    notes: Note[];
    onAddNote: (note: Omit<Note, 'id'>) => void;
    onUpdateNote: (index: number, note: Note) => void;
    onBatchUpdateNotes?: (notes: Note[]) => Promise<void>;
    onDeleteNote: (index: number) => void;
    onMoveNote: (index: number, direction: 'up' | 'down') => void;
    onGenerateNotes: () => void;
    isGenerating: boolean;
    isSaving?: boolean;
    lastSaved?: Date | null;
    saveError?: string | null;
    // Expose unsaved changes state for external components
    onUnsavedChangesUpdate?: (hasChanges: boolean, count: number) => void;
    // Expose save/discard functions for external triggers
    onSaveAllRef?: React.MutableRefObject<(() => Promise<void>) | null>;
    onDiscardAllRef?: React.MutableRefObject<(() => void) | null>;
}

export const NotesSection: React.FC<NotesSectionProps> = ({
    notes,
    onAddNote,
    onUpdateNote,
    onBatchUpdateNotes,
    onDeleteNote,
    onMoveNote,
    onGenerateNotes,
    isGenerating,
    isSaving = false,
    lastSaved = null,
    saveError = null,
    onUnsavedChangesUpdate,
    onSaveAllRef,
    onDiscardAllRef
}) => {
    const [newNoteName, setNewNoteName] = useState('');

    // ID-based draft tracking
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [dirty, setDirty] = useState<Record<string, boolean>>({});
    const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
    const [showSavedStates, setShowSavedStates] = useState<Record<string, boolean>>({});

    // Create note lookup map for easy access
    const noteMap = React.useMemo(() => {
        return notes.reduce((acc, note, index) => {
            acc[note.id] = { note, index };
            return acc;
        }, {} as Record<string, { note: Note; index: number }>);
    }, [notes]);

    // Clean up drafts when notes are removed
    useEffect(() => {
        const currentIds = new Set(notes.map(n => n.id));
        setDrafts(prev => {
            const cleaned = { ...prev };
            Object.keys(cleaned).forEach(id => {
                if (!currentIds.has(id)) {
                    delete cleaned[id];
                }
            });
            return cleaned;
        });
        setDirty(prev => {
            const cleaned = { ...prev };
            Object.keys(cleaned).forEach(id => {
                if (!currentIds.has(id)) {
                    delete cleaned[id];
                }
            });
            return cleaned;
        });
    }, [notes]);

    // Get display value (draft or persisted)
    const getDisplayValue = (note: Note): string => {
        return drafts[note.id] ?? note.notes;
    };

    // Track changes for individual notes
    const handleNoteContentChange = (note: Note, content: string) => {
        setDrafts(prev => ({ ...prev, [note.id]: content }));
        setDirty(prev => ({
            ...prev,
            [note.id]: content !== note.notes
        }));
    };

    // Save individual note
    const handleSaveNote = async (note: Note) => {
        if (!dirty[note.id]) return;

        const noteInfo = noteMap[note.id];
        if (!noteInfo) return;

        setSavingStates(prev => ({ ...prev, [note.id]: true }));
        setShowSavedStates(prev => ({ ...prev, [note.id]: false }));

        try {
            // Ensure minimum 800ms for better UX perception
            await Promise.all([
                onUpdateNote(noteInfo.index, {
                    ...note,
                    notes: drafts[note.id]
                }),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);

            // Clear draft and mark as clean
            setDrafts(prev => {
                const { [note.id]: _, ...rest } = prev;
                return rest;
            });
            setDirty(prev => ({ ...prev, [note.id]: false }));
            setShowSavedStates(prev => ({ ...prev, [note.id]: true }));

            // Hide the "saved" indicator after 2 seconds
            setTimeout(() => {
                setShowSavedStates(prev => ({ ...prev, [note.id]: false }));
            }, 2000);
        } catch (error) {
            console.error('Failed to save note:', error);
        } finally {
            setSavingStates(prev => ({ ...prev, [note.id]: false }));
        }
    };

    // Save all dirty notes
    const handleSaveAll = async () => {
        const dirtyIds = Object.keys(dirty).filter(id => dirty[id]);
        if (dirtyIds.length === 0) return;

        // Set all dirty notes to saving state
        setSavingStates(prev => {
            const newStates = { ...prev };
            dirtyIds.forEach(id => { newStates[id] = true; });
            return newStates;
        });

        try {
            if (onBatchUpdateNotes) {
                // Use the batch update method - this prevents race conditions
                const updatedNotes = notes.map(note =>
                    dirty[note.id] ? { ...note, notes: drafts[note.id] } : note
                );

                await onBatchUpdateNotes(updatedNotes);
            } else {
                // Fallback to sequential individual updates with delays
                for (let i = 0; i < dirtyIds.length; i++) {
                    const id = dirtyIds[i];
                    const noteIndex = notes.findIndex(note => note.id === id);

                    if (noteIndex !== -1 && drafts[id] !== undefined) {
                        await onUpdateNote(noteIndex, {
                            ...notes[noteIndex],
                            notes: drafts[id]
                        });

                        // Add delay between saves to prevent race conditions
                        if (i < dirtyIds.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    }
                }
            }

            // Wait a bit for save to complete
            await new Promise(resolve => setTimeout(resolve, 800));

            // Clear all drafts and mark as clean
            setDrafts(prev => {
                const newDrafts = { ...prev };
                dirtyIds.forEach(id => { delete newDrafts[id]; });
                return newDrafts;
            });
            setDirty(prev => {
                const newDirty = { ...prev };
                dirtyIds.forEach(id => { newDirty[id] = false; });
                return newDirty;
            });
            setShowSavedStates(prev => {
                const newStates = { ...prev };
                dirtyIds.forEach(id => { newStates[id] = true; });
                return newStates;
            });

            // Hide saved indicators after 2 seconds
            setTimeout(() => {
                setShowSavedStates(prev => {
                    const newStates = { ...prev };
                    dirtyIds.forEach(id => { newStates[id] = false; });
                    return newStates;
                });
            }, 2000);

        } catch (error) {
            console.error('Failed to save notes:', error);
        } finally {
            setSavingStates(prev => {
                const newStates = { ...prev };
                dirtyIds.forEach(id => { newStates[id] = false; });
                return newStates;
            });
        }
    };

    // Cancel individual note changes
    const handleCancelNote = (note: Note) => {
        setDrafts(prev => {
            const { [note.id]: _, ...rest } = prev;
            return rest;
        });
        setDirty(prev => ({ ...prev, [note.id]: false }));
    };

    // Discard all changes
    const handleDiscardAll = () => {
        setDrafts({});
        setDirty({});
    };

    // Count dirty notes for UI
    const dirtyCount = Object.values(dirty).filter(Boolean).length;

    // Notify parent component about unsaved changes
    useEffect(() => {
        onUnsavedChangesUpdate?.(dirtyCount > 0, dirtyCount);
    }, [dirtyCount, onUnsavedChangesUpdate]);

    // Expose functions to parent via refs
    useEffect(() => {
        if (onSaveAllRef) {
            onSaveAllRef.current = handleSaveAll;
        }
        if (onDiscardAllRef) {
            onDiscardAllRef.current = handleDiscardAll;
        }
    });

    const handleAddNote = () => {
        if (!newNoteName.trim()) return;
        onAddNote({ name: newNoteName.trim(), notes: '' });
        setNewNoteName('');
    };
    return (
        <div className="space-y-6">
            <div className="p-4 sm:p-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
                            <NotebookIcon size={20} className="text-orange-600" />
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900">Notes ({notes.length})</h4>
                            <SaveStatus isSaving={isSaving} lastSaved={lastSaved} error={saveError} className="mt-0.5" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {dirtyCount > 0 && (
                            <>
                                <Button
                                    onClick={handleSaveAll}
                                    variant="secondary"
                                    size="sm"
                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    <SaveIcon size={14} />
                                    Save All ({dirtyCount})
                                </Button>
                                <Button
                                    onClick={handleDiscardAll}
                                    variant="secondary"
                                    size="sm"
                                    className="bg-gray-600 text-white hover:bg-gray-700"
                                >
                                    <UndoIcon size={14} />
                                    Discard All
                                </Button>
                            </>
                        )}
                        <Tooltip
                            text="Use AI to generate insightful notes and analysis from your selected text"
                            id="notes-ai-generate"
                        >
                            <Button
                                onClick={onGenerateNotes}
                                isLoading={isGenerating}
                                variant="primary"
                                className="w-full sm:w-auto"
                            >
                                <SparklesIcon size={16} />
                                {isGenerating ? 'Generating...' : 'AI Generate'}
                            </Button>
                        </Tooltip>
                    </div>
                </div>

                {/* Manual Add Note */}
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={newNoteName}
                        onChange={(e) => setNewNoteName(e.target.value)}
                        placeholder="Note title..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                    />
                    <Tooltip text="Add note to your list" id="add-note">
                        <Button
                            onClick={handleAddNote}
                            variant="primary"
                            disabled={!newNoteName.trim()}
                        >
                            <PlusIcon size={16} />
                            Add Note
                        </Button>
                    </Tooltip>
                </div>
            </div>

            <div className="space-y-4">
                {notes.map((note, index) => (
                    <div key={note.id} className="p-4 sm:p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="space-y-4">
                            {/* Title Row */}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center relative flex-shrink-0">
                                    <NotebookIcon size={18} className="text-orange-600" />
                                    {dirty[note.id] && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white"></div>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={note.name}
                                    onChange={(e) => onUpdateNote(index, { ...note, name: e.target.value })}
                                    className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg px-3 py-1 -mx-3 flex-1 min-w-0"
                                    placeholder="Note title"
                                />
                            </div>

                            {/* Actions Row - Responsive Layout */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                                {/* Primary Actions - Save, Cancel and Status */}
                                <div className="flex items-center gap-2 order-2 sm:order-1">
                                    <button
                                        onClick={() => handleSaveNote(note)}
                                        disabled={savingStates[note.id] || !dirty[note.id]}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center gap-2 ${savingStates[note.id]
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : dirty[note.id]
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                                                : 'bg-emerald-100 text-emerald-700 cursor-default'
                                            }`}
                                        title="Ctrl+Enter to save"
                                    >
                                        <SaveIcon size={14} />
                                        <span className="hidden sm:inline">
                                            {savingStates[note.id] ? 'Saving...' : 'Save'}
                                        </span>
                                    </button>

                                    {dirty[note.id] && (
                                        <Tooltip text="Cancel changes and revert to saved version" id={`cancel-note-${note.id}`}>
                                            <Button
                                                onClick={() => handleCancelNote(note)}
                                                variant="secondary"
                                                size="sm"
                                                className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                                            >
                                                <UndoIcon size={14} />
                                                <span className="hidden sm:inline">Cancel</span>
                                            </Button>
                                        </Tooltip>
                                    )}

                                    <SaveStateIndicator
                                        isSaving={savingStates[note.id] || false}
                                        hasUnsavedChanges={dirty[note.id] || false}
                                        showSaved={showSavedStates[note.id] || false}
                                    />
                                </div>

                                {/* Secondary Actions - Navigation and Tools */}
                                <div className="flex items-center gap-2 order-1 sm:order-2">
                                    <div className="flex items-center gap-1">
                                        <Tooltip
                                            text="Move this note up in the order"
                                            id={`note-up-${note.id}`}
                                        >
                                            <Button
                                                onClick={() => onMoveNote(index, 'up')}
                                                variant="ghost"
                                                size="sm"
                                                disabled={index === 0}
                                            >
                                                <ChevronUpIcon size={14} />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip
                                            text="Move this note down in the order"
                                            id={`note-down-${note.id}`}
                                        >
                                            <Button
                                                onClick={() => onMoveNote(index, 'down')}
                                                variant="ghost"
                                                size="sm"
                                                disabled={index === notes.length - 1}
                                            >
                                                <ChevronDownIcon size={14} />
                                            </Button>
                                        </Tooltip>
                                    </div>

                                    <div className="w-px h-6 bg-gray-200"></div>

                                    <Tooltip
                                        text="Remove this note from your list"
                                        id={`delete-note-${note.id}`}
                                    >
                                        <Button
                                            onClick={() => onDeleteNote(index)}
                                            variant="danger"
                                            size="sm"
                                        >
                                            <TrashIcon size={14} />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-gray-600 font-medium">Note Content</label>
                                <ResizableTextArea
                                    value={getDisplayValue(note)}
                                    onChange={(content) => handleNoteContentChange(note, content)}
                                    onSave={() => handleSaveNote(note)}
                                    placeholder="Write your note content here..."
                                    minRows={3}
                                    maxRows={15}
                                />
                                {dirty[note.id] && (
                                    <p className="text-xs text-gray-500">
                                        Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Enter</kbd> or click Save to save your changes
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {notes.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <div className="mb-4 flex justify-center">
                            <NotebookIcon size={64} strokeWidth={1} className="text-gray-300" />
                        </div>
                        <p className="text-lg font-medium text-gray-700">No notes yet</p>
                        <p className="text-sm text-gray-500">Add your first note above or use AI Generate</p>
                    </div>
                )}
            </div>
        </div>
    );
};
