import React, { useEffect, useState } from 'react';
import { Note } from '../../types/book';
import { Button } from '../ui/Button';
import { ChevronDownIcon, ChevronUpIcon, NotebookIcon, PlusIcon, SaveIcon, SparklesIcon, TrashIcon } from '../ui/Icons';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { SaveStateIndicator } from '../ui/SaveStateIndicator';
import { Tooltip } from '../ui/Tooltip';

interface NotesSectionProps {
    notes: Note[];
    onAddNote: (note: Note) => void;
    onUpdateNote: (index: number, note: Note) => void;
    onDeleteNote: (index: number) => void;
    onMoveNote: (index: number, direction: 'up' | 'down') => void;
    onGenerateNotes: () => void;
    isGenerating: boolean;
}

export const NotesSection: React.FC<NotesSectionProps> = ({
    notes,
    onAddNote,
    onUpdateNote,
    onDeleteNote,
    onMoveNote,
    onGenerateNotes,
    isGenerating
}) => {
    const [newNoteName, setNewNoteName] = useState('');
    const [localNotes, setLocalNotes] = useState<Note[]>(notes);
    const [savingStates, setSavingStates] = useState<{ [key: number]: boolean }>({});
    const [unsavedChanges, setUnsavedChanges] = useState<{ [key: number]: boolean }>({});
    const [showSavedStates, setShowSavedStates] = useState<{ [key: number]: boolean }>({});

    // Sync with prop changes
    useEffect(() => {
        setLocalNotes(notes);
        setUnsavedChanges({});
        setShowSavedStates({});
    }, [notes]);

    // Track changes for individual notes
    const handleNoteContentChange = (index: number, content: string) => {
        const updatedNotes = [...localNotes];
        updatedNotes[index] = { ...updatedNotes[index], notes: content };
        setLocalNotes(updatedNotes);

        setUnsavedChanges(prev => ({
            ...prev,
            [index]: content !== notes[index]?.notes
        }));
    };

    // Save individual note
    const handleSaveNote = async (index: number) => {
        if (!unsavedChanges[index]) return;

        setSavingStates(prev => ({ ...prev, [index]: true }));
        setShowSavedStates(prev => ({ ...prev, [index]: false }));
        try {
            // Ensure minimum 800ms for better UX perception
            await Promise.all([
                onUpdateNote(index, localNotes[index]),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);

            setUnsavedChanges(prev => ({ ...prev, [index]: false }));
            setShowSavedStates(prev => ({ ...prev, [index]: true }));

            // Hide the "saved" indicator after 2 seconds
            setTimeout(() => {
                setShowSavedStates(prev => ({ ...prev, [index]: false }));
            }, 2000);
        } catch (error) {
            console.error('Failed to save note:', error);
        } finally {
            setSavingStates(prev => ({ ...prev, [index]: false }));
        }
    };

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
                        <h4 className="text-lg font-semibold text-gray-900">Notes ({notes.length})</h4>
                    </div>
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
                {localNotes.map((note, index) => (
                    <div key={index} className="p-4 sm:p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={note.name}
                                        onChange={(e) => onUpdateNote(index, { ...note, name: e.target.value })}
                                        className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg px-3 py-1 -mx-3 w-full sm:w-auto"
                                        placeholder="Note title"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <SaveStateIndicator
                                        isSaving={savingStates[index] || false}
                                        hasUnsavedChanges={unsavedChanges[index] || false}
                                        showSaved={showSavedStates[index] || false}
                                    />
                                    <Tooltip
                                        text="Move this note up in the order"
                                        id={`note-up-${index}`}
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
                                        id={`note-down-${index}`}
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
                                    <button
                                        onClick={() => handleSaveNote(index)}
                                        disabled={savingStates[index] || !unsavedChanges[index]}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center gap-2 ${savingStates[index]
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : unsavedChanges[index]
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                                                : 'bg-emerald-100 text-emerald-700 cursor-default'
                                            }`}
                                        title="Ctrl+Enter to save"
                                    >
                                        <SaveIcon size={14} />
                                        {savingStates[index] ? 'Saving...' : 'Save'}
                                    </button>
                                    <Tooltip
                                        text="Remove this note from your list"
                                        id={`delete-note-${index}`}
                                    >
                                        <Button
                                            onClick={() => onDeleteNote(index)}
                                            variant="danger"
                                            size="sm"
                                            className="self-start sm:self-auto"
                                        >
                                            <TrashIcon size={14} />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-gray-600 font-medium">Note Content</label>
                                <ResizableTextArea
                                    value={localNotes[index]?.notes || ''}
                                    onChange={(content) => handleNoteContentChange(index, content)}
                                    onSave={() => handleSaveNote(index)}
                                    placeholder="Write your note content here..."
                                    minRows={3}
                                    maxRows={15}
                                />
                                {unsavedChanges[index] && (
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
