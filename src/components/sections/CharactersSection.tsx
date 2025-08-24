import React, { useEffect, useState } from 'react';
import { Character } from '../../types/book';
import { Button } from '../ui/Button';
import { PlusIcon, SaveIcon, SparklesIcon, TrashIcon, UsersIcon } from '../ui/Icons';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { SaveStateIndicator } from '../ui/SaveStateIndicator';
import { SaveStatus } from '../ui/SaveStatus';
import { Tooltip } from '../ui/Tooltip';

interface CharactersSectionProps {
    characters: Character[];
    onAddCharacter: (character: Character) => void;
    onUpdateCharacter: (index: number, character: Character) => void;
    onDeleteCharacter: (index: number) => void;
    onGenerateCharacters: () => void;
    isGenerating: boolean;
    isSaving?: boolean;
    lastSaved?: Date | null;
    saveError?: string | null;
}

export const CharactersSection: React.FC<CharactersSectionProps> = ({
    characters,
    onAddCharacter,
    onUpdateCharacter,
    onDeleteCharacter,
    onGenerateCharacters,
    isGenerating,
    isSaving = false,
    lastSaved = null,
    saveError = null
}) => {
    const [newCharacterName, setNewCharacterName] = useState('');
    const [localCharacters, setLocalCharacters] = useState<Character[]>(characters);
    const [savingStates, setSavingStates] = useState<{ [key: number]: boolean }>({});
    const [unsavedChanges, setUnsavedChanges] = useState<{ [key: number]: boolean }>({});
    const [showSavedStates, setShowSavedStates] = useState<{ [key: number]: boolean }>({});

    // Sync with prop changes
    useEffect(() => {
        setLocalCharacters(characters);
        setUnsavedChanges({});
        setShowSavedStates({});
    }, [characters]);

    // Track changes for individual characters
    const handleCharacterNotesChange = (index: number, notes: string) => {
        const updatedCharacters = [...localCharacters];
        updatedCharacters[index] = { ...updatedCharacters[index], notes };
        setLocalCharacters(updatedCharacters);

        setUnsavedChanges(prev => ({
            ...prev,
            [index]: notes !== characters[index]?.notes
        }));
    };

    // Save individual character
    const handleSaveCharacter = async (index: number) => {
        if (!unsavedChanges[index]) return;

        setSavingStates(prev => ({ ...prev, [index]: true }));
        setShowSavedStates(prev => ({ ...prev, [index]: false }));
        try {
            // Ensure minimum 800ms for better UX perception
            await Promise.all([
                onUpdateCharacter(index, localCharacters[index]),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);

            setUnsavedChanges(prev => ({ ...prev, [index]: false }));
            setShowSavedStates(prev => ({ ...prev, [index]: true }));

            // Hide the "saved" indicator after 2 seconds
            setTimeout(() => {
                setShowSavedStates(prev => ({ ...prev, [index]: false }));
            }, 2000);
        } catch (error) {
            console.error('Failed to save character:', error);
        } finally {
            setSavingStates(prev => ({ ...prev, [index]: false }));
        }
    };

    const handleAddCharacter = () => {
        if (!newCharacterName.trim()) return;
        onAddCharacter({ name: newCharacterName.trim(), notes: '' });
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

                {/* Manual Add Character */}
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
                    <div key={index} className="p-4 sm:p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <UsersIcon size={24} className="text-amber-600" />
                            </div>
                            <div className="flex-1 space-y-4 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                    <input
                                        type="text"
                                        value={character.name}
                                        onChange={(e) => onUpdateCharacter(index, { ...character, name: e.target.value })}
                                        className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg px-3 py-1 -mx-3 w-full sm:w-auto"
                                        placeholder="Character name"
                                    />
                                    <div className="flex items-center gap-2">
                                        <SaveStateIndicator
                                            isSaving={savingStates[index]}
                                            showSaved={showSavedStates[index]}
                                            hasUnsavedChanges={unsavedChanges[index]}
                                        />
                                        <Tooltip
                                            text="Save character notes"
                                            id={`save-character-${index}`}
                                        >
                                            <Button
                                                onClick={() => handleSaveCharacter(index)}
                                                disabled={savingStates[index] || !unsavedChanges[index]}
                                                variant="secondary"
                                                size="sm"
                                                className={`${unsavedChanges[index] ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}
                                            >
                                                <SaveIcon size={14} />
                                                {savingStates[index] ? 'Saving...' : 'Save'}
                                            </Button>
                                        </Tooltip>
                                        <Tooltip
                                            text="Remove this character from your list"
                                            id={`delete-character-${index}`}
                                        >
                                            <Button
                                                onClick={() => onDeleteCharacter(index)}
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
                                    <label className="text-sm text-gray-600 font-medium">Character Description</label>
                                    <ResizableTextArea
                                        value={localCharacters[index]?.notes || ''}
                                        onChange={(notes) => handleCharacterNotesChange(index, notes)}
                                        onSave={() => handleSaveCharacter(index)}
                                        placeholder="Describe this character, their personality, role, background..."
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
