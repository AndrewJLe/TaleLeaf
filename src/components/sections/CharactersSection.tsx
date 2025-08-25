import React, { useEffect, useRef, useState } from 'react';
import { Character } from '../../types/book';
import { Button } from '../ui/Button';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, SaveIcon, SparklesIcon, TrashIcon, UndoIcon, UsersIcon } from '../ui/Icons';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { SaveStateIndicator } from '../ui/SaveStateIndicator';
import { SaveStatus } from '../ui/SaveStatus';
import { Tooltip } from '../ui/Tooltip';

interface CharactersSectionProps {
    characters: Character[];
    onAddCharacter: (character: Omit<Character, 'id'>) => void;
    onUpdateCharacter: (index: number, character: Character) => void;
    onBatchUpdateCharacters?: (characters: Character[]) => Promise<void>;
    onDeleteCharacter: (index: number) => void;
    onMoveCharacter: (index: number, direction: 'up' | 'down') => void;
    onGenerateCharacters: () => void;
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

export const CharactersSection: React.FC<CharactersSectionProps> = ({
    characters,
    onAddCharacter,
    onUpdateCharacter,
    onBatchUpdateCharacters,
    onDeleteCharacter,
    onMoveCharacter,
    onGenerateCharacters,
    isGenerating,
    isSaving = false,
    lastSaved = null,
    saveError = null,
    onUnsavedChangesUpdate,
    onSaveAllRef,
    onDiscardAllRef
}) => {
    const [newCharacterName, setNewCharacterName] = useState('');

    // ID-based draft tracking
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [dirty, setDirty] = useState<Record<string, boolean>>({});
    const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
    const [showSavedStates, setShowSavedStates] = useState<Record<string, boolean>>({});
    // Local state for inline name editing
    const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
    const [editingName, setEditingName] = useState<Record<string, boolean>>({});

    // Tags + color picker state (Characters tab only)
    const [newTagDrafts, setNewTagDrafts] = useState<Record<string, string>>({});
    const [newTagColorDrafts, setNewTagColorDrafts] = useState<Record<string, string>>({});
    const [tagColorOverrides, setTagColorOverrides] = useState<Record<string, string>>({});
    const [swatchOpenFor, setSwatchOpenFor] = useState<string | null>(null);
    const [addingTagFor, setAddingTagFor] = useState<string | null>(null);
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // Deterministic palette and helpers
    const TAG_PALETTE = [
        '#F97316', // orange
        '#EF4444', // red
        '#10B981', // emerald
        '#3B82F6', // blue
        '#8B5CF6', // violet
        '#F59E0B', // amber
        '#06B6D4', // teal
        '#EC4899', // pink
        '#6366F1', // indigo
        '#84CC16'  // lime
    ];

    const hashString = (s: string) => {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = (h << 5) - h + s.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    };

    const colorForTagName = (tag: string) => {
        if (tagColorOverrides[tag]) return tagColorOverrides[tag];
        const idx = hashString(tag) % TAG_PALETTE.length;
        return TAG_PALETTE[idx];
    };

    const luminance = (hex: string) => {
        const c = hex.replace('#', '');
        const r = parseInt(c.substring(0, 2), 16) / 255;
        const g = parseInt(c.substring(2, 4), 16) / 255;
        const b = parseInt(c.substring(4, 6), 16) / 255;
        const a = [r, g, b].map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
        return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    };

    const readableTextColor = (bgHex: string) => {
        return luminance(bgHex) > 0.5 ? '#111827' : '#ffffff';
    };

    const isValidTag = (t: string) => /^[a-z0-9]+$/.test(t);

    const handleCreateTag = (character: Character, index: number) => {
        const id = character.id;
        const raw = (newTagDrafts[id] || '').trim().toLowerCase();
        if (!raw) return;
        if (!isValidTag(raw)) return; // silent fail for now
        if (character.tags?.includes(raw)) {
            setNewTagDrafts(prev => ({ ...prev, [id]: '' }));
            return;
        }
        const color = newTagColorDrafts[id] || colorForTagName(raw);
        const updated = { ...character, tags: [...(character.tags || []), raw] };
        onUpdateCharacter(index, updated);
        setTagColorOverrides(prev => ({ ...prev, [raw]: color }));
        setNewTagDrafts(prev => ({ ...prev, [id]: '' }));
        setNewTagColorDrafts(prev => ({ ...prev, [id]: '' }));
        setSwatchOpenFor(null);
        // keep focus on input if present
        setTimeout(() => inputRefs.current[id]?.focus(), 0);
    };

    const handleRemoveTag = (character: Character, index: number, tag: string) => {
        const updated = { ...character, tags: (character.tags || []).filter(t => t !== tag) };
        onUpdateCharacter(index, updated);
    };

    // Create character lookup map for easy access
    const characterMap = React.useMemo(() => {
        return characters.reduce((acc, char, index) => {
            acc[char.id] = { character: char, index };
            return acc;
        }, {} as Record<string, { character: Character; index: number }>);
    }, [characters]);

    // Clean up drafts when characters are removed
    useEffect(() => {
        const currentIds = new Set(characters.map(c => c.id));
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
    }, [characters]);

    // Get display value (draft or persisted)
    const getDisplayValue = (character: Character): string => {
        return drafts[character.id] ?? character.notes;
    };

    // Track changes for individual characters
    const handleCharacterNotesChange = (character: Character, notes: string) => {
        setDrafts(prev => ({ ...prev, [character.id]: notes }));
        setDirty(prev => ({
            ...prev,
            [character.id]: notes !== character.notes
        }));
    };

    // Save individual character
    const handleSaveCharacter = async (character: Character) => {
        if (!dirty[character.id]) return;

        const characterInfo = characterMap[character.id];
        if (!characterInfo) return;

        setSavingStates(prev => ({ ...prev, [character.id]: true }));
        setShowSavedStates(prev => ({ ...prev, [character.id]: false }));

        try {
            // Ensure minimum 800ms for better UX perception
            await Promise.all([
                onUpdateCharacter(characterInfo.index, {
                    ...character,
                    notes: drafts[character.id]
                }),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);

            // Clear draft and mark as clean
            setDrafts(prev => {
                const { [character.id]: _, ...rest } = prev;
                return rest;
            });
            setDirty(prev => ({ ...prev, [character.id]: false }));
            setShowSavedStates(prev => ({ ...prev, [character.id]: true }));

            // Hide the "saved" indicator after 2 seconds
            setTimeout(() => {
                setShowSavedStates(prev => ({ ...prev, [character.id]: false }));
            }, 2000);
        } catch (error) {
            console.error('Failed to save character:', error);
        } finally {
            setSavingStates(prev => ({ ...prev, [character.id]: false }));
        }
    };

    // Save all dirty characters
    const handleSaveAll = async () => {
        const dirtyIds = Object.keys(dirty).filter(id => dirty[id]);
        if (dirtyIds.length === 0) return;

        // Set all dirty characters to saving state
        setSavingStates(prev => {
            const newStates = { ...prev };
            dirtyIds.forEach(id => { newStates[id] = true; });
            return newStates;
        });

        try {
            if (onBatchUpdateCharacters) {
                // Use the batch update method - this prevents race conditions
                const updatedCharacters = characters.map(character =>
                    dirty[character.id] ? { ...character, notes: drafts[character.id] } : character
                );

                await onBatchUpdateCharacters(updatedCharacters);
            } else {
                // Fallback to sequential individual updates with delays
                for (let i = 0; i < dirtyIds.length; i++) {
                    const id = dirtyIds[i];
                    const characterInfo = characterMap[id];
                    if (characterInfo && drafts[id] !== undefined) {
                        await onUpdateCharacter(characterInfo.index, {
                            ...characterInfo.character,
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
            console.error('Failed to save characters:', error);
        } finally {
            setSavingStates(prev => {
                const newStates = { ...prev };
                dirtyIds.forEach(id => { newStates[id] = false; });
                return newStates;
            });
        }
    };

    // Discard all changes
    const handleDiscardAll = () => {
        setDrafts({});
        setDirty({});
    };

    // Count dirty characters for UI
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

    const handleAddCharacter = () => {
        if (!newCharacterName.trim()) return;
        onAddCharacter({ name: newCharacterName.trim(), notes: '', tags: [] });
        setNewCharacterName('');
    };

    return (
        <div className="space-y-6">
            <div className="p-4 sm:p-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                            <UsersIcon size={20} className="text-amber-600" />
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900">Characters ({characters.length})</h4>
                            <SaveStatus
                                isSaving={isSaving}
                                lastSaved={lastSaved}
                                error={saveError}
                                className="mt-0.5"
                            />
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
                            text="Use AI to automatically find and extract characters mentioned in your selected text"
                            id="characters-ai-generate"
                        >
                            <Button
                                onClick={onGenerateCharacters}
                                isLoading={isGenerating}
                                variant="primary"
                                className="w-full sm:w-auto"
                            >
                                <SparklesIcon size={16} />
                                {isGenerating ? 'Generating...' : 'AI Generate'}
                            </Button>
                        </Tooltip>
                    </div>
                </div>                {/* Manual Add Character */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        value={newCharacterName}
                        onChange={(e) => setNewCharacterName(e.target.value)}
                        placeholder="Character name..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCharacter()}
                    />
                    <Tooltip
                        text="Add a new character to your book"
                        id="add-character-button"
                    >
                        <Button
                            onClick={handleAddCharacter}
                            variant="primary"
                            className="w-full sm:w-auto"
                        >
                            <PlusIcon size={16} />
                            Add Character
                        </Button>
                    </Tooltip>
                </div>
            </div>

            <div className="space-y-4">
                {characters.map((character, index) => (
                    <div key={character.id} className="group relative overflow-hidden p-4 sm:p-6 bg-gradient-to-br from-emerald-100 to-white border border-emerald-100 hover:border-2 hover:border-emerald-400 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="space-y-4">
                            {/* Title Row */}
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center relative flex-shrink-0 transition-transform transform hover:scale-105 active:scale-95 cursor-pointer"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => { /* TODO: open character details modal */ }}
                                >
                                    <UsersIcon size={18} className="text-amber-600" />
                                    {dirty[character.id] && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white"></div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-1 min-w-0 group">
                                    {editingName[character.id] ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={nameDrafts[character.id] ?? character.name}
                                            onChange={(e) => setNameDrafts(prev => ({ ...prev, [character.id]: e.target.value }))}
                                            onBlur={() => {
                                                const newName = nameDrafts[character.id];
                                                if (newName !== undefined && newName !== character.name) {
                                                    onUpdateCharacter(index, { ...character, name: newName });
                                                }
                                                setEditingName(prev => ({ ...prev, [character.id]: false }));
                                                setNameDrafts(prev => { const copy = { ...prev }; delete copy[character.id]; return copy; });
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const newName = nameDrafts[character.id];
                                                    if (newName !== undefined && newName !== character.name) {
                                                        onUpdateCharacter(index, { ...character, name: newName });
                                                    }
                                                    setEditingName(prev => ({ ...prev, [character.id]: false }));
                                                    setNameDrafts(prev => { const copy = { ...prev }; delete copy[character.id]; return copy; });
                                                } else if (e.key === 'Escape') {
                                                    setEditingName(prev => ({ ...prev, [character.id]: false }));
                                                    setNameDrafts(prev => { const copy = { ...prev }; delete copy[character.id]; return copy; });
                                                }
                                            }}
                                            className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg px-3 py-1 w-full"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2 w-full">
                                            <div className="font-semibold text-gray-900 text-lg truncate">{character.name || 'Character name'}</div>
                                            <Tooltip text="Edit character name" id={`edit-character-name-${character.id}`}>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setNameDrafts(prev => ({ ...prev, [character.id]: character.name })); setEditingName(prev => ({ ...prev, [character.id]: true })); }}
                                                    className="ml-1 p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 focus:outline-none opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 transition-opacity"
                                                    aria-label={`Edit name for ${character.name}`}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
                                                        <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor" />
                                                    </svg>
                                                </button>
                                            </Tooltip>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tags (moved under name) */}
                            <div className="mt-2 basis-full">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {(character.tags || []).map(tag => (
                                            <div key={tag} className="group inline-flex items-center rounded-full px-2 py-0.5 text-xs sm:text-sm font-medium transform transition-transform hover:scale-105" style={{ backgroundColor: colorForTagName(tag), color: readableTextColor(colorForTagName(tag)) }}>
                                                <span className="truncate max-w-[10rem]">{tag}</span>
                                                <button
                                                    aria-label={`Remove tag ${tag}`}
                                                    onClick={() => handleRemoveTag(character, index, tag)}
                                                    className="ml-2 text-red-600 font-semibold text-xs sm:text-sm opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}

                                        {/* Add Tag button moved inline after the last tag */}
                                        {addingTagFor !== character.id && (
                                            <button
                                                onClick={() => { setAddingTagFor(character.id); setTimeout(() => inputRefs.current[character.id]?.focus(), 0); }}
                                                className="px-2 py-1 rounded-md bg-emerald-600 text-white text-sm flex items-center gap-1 hover:bg-emerald-700 shadow-sm transition-all"
                                                aria-label="Add tag"
                                            >
                                                <span className="font-semibold">+</span>
                                                <span aria-hidden className="text-sm">🏷️</span>
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        {addingTagFor === character.id && (
                                            <button
                                                onClick={() => { setAddingTagFor(null); setNewTagDrafts(prev => ({ ...prev, [character.id]: '' })); setNewTagColorDrafts(prev => ({ ...prev, [character.id]: '' })); }}
                                                className="px-3 py-1 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 hover:shadow-sm transition-all"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {addingTagFor === character.id && (
                                    <div className="mt-2 flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                ref={(el) => { inputRefs.current[character.id] = el; }}
                                                value={newTagDrafts[character.id] ?? ''}
                                                onChange={(e) => {
                                                    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                                                    setNewTagDrafts(prev => ({ ...prev, [character.id]: sanitized }));
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const raw = (newTagDrafts[character.id] || '').trim().toLowerCase();
                                                        if (isValidTag(raw)) {
                                                            e.preventDefault();
                                                            handleCreateTag(character, index);
                                                        }
                                                    } else if (e.key === 'Escape') {
                                                        setAddingTagFor(null);
                                                    }
                                                }}
                                                placeholder="add tag (lowercase alphanumeric)"
                                                className="px-3 py-2 sm:py-1 border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-colors duration-150 w-full sm:w-auto"
                                            />
                                            <button
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => setSwatchOpenFor(swatchOpenFor === character.id ? null : character.id)}
                                                className="px-2 sm:px-3 py-2 sm:py-1 bg-white border border-gray-200 rounded-lg shadow-sm text-sm hover:scale-105 transition-transform flex items-center gap-1"
                                                title="Pick tag color"
                                            >
                                                <span className="text-lg">🎨</span>
                                                <span className="hidden sm:inline text-xs text-gray-600">Color</span>
                                            </button>
                                            <button
                                                onClick={() => handleCreateTag(character, index)}
                                                disabled={!isValidTag((newTagDrafts[character.id] || '').trim().toLowerCase())}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors ${isValidTag((newTagDrafts[character.id] || '').trim().toLowerCase()) ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                            >
                                                Create
                                            </button>
                                        </div>

                                        {swatchOpenFor === character.id && (
                                            <div className="w-full">
                                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                                    {TAG_PALETTE.map(col => (
                                                        <button
                                                            key={col}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => setNewTagColorDrafts(prev => ({ ...prev, [character.id]: col }))}
                                                            className={`w-5 h-5 rounded-full transform transition-transform hover:scale-110 focus:scale-110 outline-none ${newTagColorDrafts[character.id] === col ? 'ring-4 ring-emerald-200' : 'ring-2 ring-transparent'}`}
                                                            style={{ backgroundColor: col }}
                                                            aria-label={`Select ${col}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions Row - Responsive Layout */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                                {/* Primary Actions - Save and Status */}
                                <div className="flex items-center gap-2 order-2 sm:order-1">
                                    <button
                                        onClick={() => handleSaveCharacter(character)}
                                        disabled={savingStates[character.id] || !dirty[character.id]}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center gap-2 ${savingStates[character.id]
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : dirty[character.id]
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                                                : 'bg-emerald-100 text-emerald-700 cursor-default'
                                            }`}
                                        title="Ctrl+Enter to save"
                                    >
                                        <SaveIcon size={14} />
                                        <span className="hidden sm:inline">
                                            {savingStates[character.id] ? 'Saving...' : 'Save'}
                                        </span>
                                    </button>
                                    {dirty[character.id] && (
                                        <Button
                                            onClick={() => {
                                                // Revert draft for this character
                                                setDrafts(prev => {
                                                    const { [character.id]: _, ...rest } = prev;
                                                    return rest;
                                                });
                                                setDirty(prev => ({ ...prev, [character.id]: false }));
                                            }}
                                            variant="secondary"
                                            size="sm"
                                            className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                                        >
                                            <UndoIcon size={14} />
                                            <span className="hidden sm:inline">Cancel</span>
                                        </Button>
                                    )}
                                    <SaveStateIndicator
                                        isSaving={savingStates[character.id]}
                                        showSaved={showSavedStates[character.id]}
                                        hasUnsavedChanges={dirty[character.id]}
                                    />
                                </div>

                                {/* Secondary Actions - Navigation and Tools */}
                                <div className="flex items-center gap-2 order-1 sm:order-2">
                                    <div className="flex items-center gap-1">
                                        <Tooltip
                                            text="Move this character up in the order"
                                            id={`character-up-${character.id}`}
                                        >
                                            <Button
                                                onClick={() => onMoveCharacter(index, 'up')}
                                                variant="ghost"
                                                size="sm"
                                                disabled={index === 0}
                                            >
                                                <ChevronUpIcon size={14} />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip
                                            text="Move this character down in the order"
                                            id={`character-down-${character.id}`}
                                        >
                                            <Button
                                                onClick={() => onMoveCharacter(index, 'down')}
                                                variant="ghost"
                                                size="sm"
                                                disabled={index === characters.length - 1}
                                            >
                                                <ChevronDownIcon size={14} />
                                            </Button>
                                        </Tooltip>
                                    </div>

                                    <div className="w-px h-6 bg-gray-200"></div>

                                    <Tooltip
                                        text="Remove this character from your list"
                                        id={`delete-character-${character.id}`}
                                    >
                                        <Button
                                            onClick={() => onDeleteCharacter(index)}
                                            variant="danger"
                                            size="sm"
                                        >
                                            <TrashIcon size={14} />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-gray-600 font-medium">Character Description</label>
                                <ResizableTextArea
                                    value={getDisplayValue(character)}
                                    onChange={(notes) => handleCharacterNotesChange(character, notes)}
                                    onSave={() => handleSaveCharacter(character)}
                                    placeholder="Describe this character, their personality, role, background..."
                                    className="!bg-white !border-gray-200"
                                    minRows={3}
                                    maxRows={15}
                                />
                                {dirty[character.id] && (
                                    <p className="text-xs text-gray-500">
                                        Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Enter</kbd> or click Save to save your changes
                                    </p>
                                )}
                            </div>

                        </div>

                        {/* Sheen overlay: thin diagonal light line moving across the card */}
                        <div className="pointer-events-none absolute inset-0 z-20 transform -translate-x-full -translate-y-full group-hover:translate-x-full group-hover:translate-y-full transition-transform duration-900 ease-out will-change-transform">
                            <div className="absolute left-0 top-[-10%] -translate-y-1/4 bg-gradient-to-r from-transparent via-white/70 to-transparent w-12 h-[300%] rotate-45 -skew-x-12 opacity-80 blur-md"></div>
                        </div>
                    </div>
                ))}

                {characters.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <div className="mb-4 flex justify-center">
                            <UsersIcon size={64} strokeWidth={1} className="text-gray-300" />
                        </div>
                        <p className="text-lg font-medium text-gray-700">No characters yet</p>
                        <p className="text-sm text-gray-500">Add your first character above or use AI Generate</p>
                    </div>
                )}
            </div>
        </div>
    );
};
