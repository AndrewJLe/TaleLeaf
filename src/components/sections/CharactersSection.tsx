import React, { useState } from 'react';
import { Character } from '../../types/book';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ResizableTextArea } from '../ui/ResizableTextArea';

interface CharactersSectionProps {
    characters: Character[];
    onAddCharacter: (character: Character) => void;
    onUpdateCharacter: (index: number, character: Character) => void;
    onDeleteCharacter: (index: number) => void;
    onEnhanceCharacter: (index: number) => void;
    onGenerateCharacters: () => void;
    isGenerating: boolean;
}

export const CharactersSection: React.FC<CharactersSectionProps> = ({
    characters,
    onAddCharacter,
    onUpdateCharacter,
    onDeleteCharacter,
    onEnhanceCharacter,
    onGenerateCharacters,
    isGenerating
}) => {
    const [newCharacterName, setNewCharacterName] = useState('');

    const handleAddCharacter = () => {
        if (!newCharacterName.trim()) return;
        onAddCharacter({ name: newCharacterName.trim(), notes: '' });
        setNewCharacterName('');
    };

    return (
        <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                        👥 Characters ({characters.length})
                    </h4>
                    <Tooltip
                        text="Use AI to automatically find and extract characters from your selected text"
                        id="characters-ai-generate"
                    >
                        <Button
                            onClick={onGenerateCharacters}
                            isLoading={isGenerating}
                            variant="primary"
                        >
                            🤖 {isGenerating ? 'Generating...' : 'AI Generate'}
                        </Button>
                    </Tooltip>
                </div>

                {/* Manual Add Character */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newCharacterName}
                        onChange={(e) => setNewCharacterName(e.target.value)}
                        placeholder="Character name..."
                        className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCharacter()}
                    />
                    <Tooltip
                        text="Add a new character to your book"
                        id="add-character-button"
                    >
                        <Button onClick={handleAddCharacter} variant="primary">
                            ✨ Add Character
                        </Button>
                    </Tooltip>
                </div>
            </div>

            <div className="space-y-3">
                {characters.map((character, index) => (
                    <div key={index} className="p-4 bg-white border border-emerald-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <span className="text-emerald-600 text-sm">⋮⋮</span>
                            </div>
                            <div className="flex-1 space-y-3">
                                <div className="flex justify-between items-center">
                                    <input
                                        type="text"
                                        value={character.name}
                                        onChange={(e) => onUpdateCharacter(index, { ...character, name: e.target.value })}
                                        className="font-semibold text-amber-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-2 -mx-2"
                                        placeholder="Character name"
                                    />
                                    <div className="flex gap-2">
                                        <Tooltip
                                            text="Use AI to enhance this character's profile with more details from your selected text"
                                            id={`enhance-character-${index}`}
                                        >
                                            <Button
                                                onClick={() => onEnhanceCharacter(index)}
                                                variant="ghost"
                                                size="sm"
                                                isLoading={isGenerating}
                                            >
                                                🤖 AI Enhance
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
                                            >
                                                🗑️ Delete
                                            </Button>
                                        </Tooltip>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-emerald-600 font-medium">Character Notes</label>
                                    <ResizableTextArea
                                        value={character.notes}
                                        onChange={(notes) => onUpdateCharacter(index, { ...character, notes })}
                                        placeholder="Character description, personality, relationships..."
                                        minRows={3}
                                        maxRows={15}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {characters.length === 0 && (
                    <div className="text-center py-12 text-emerald-600">
                        <div className="text-6xl mb-4">👥</div>
                        <p className="text-lg font-medium">No characters yet</p>
                        <p className="text-sm opacity-75">Add your first character above or use AI Generate</p>
                    </div>
                )}
            </div>
        </div>
    );
};
