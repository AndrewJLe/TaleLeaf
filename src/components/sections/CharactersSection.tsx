import React from "react";
import { Button } from "../ui/Button";
import { SparklesIcon, TrashIcon, UsersIcon } from "../ui/Icons";
import { ResizableTextArea } from "../ui/ResizableTextArea";
import { Tooltip } from "../ui/Tooltip";

interface Character {
    id: string;
    name: string;
    description: string;
}

interface CharactersSectionProps {
    characters: Character[];
    isGeneratingCharacter: boolean;
    expandedCharacters: Record<string, boolean>;
    toggleCharacterExpansion: (id: string) => void;
    updateCharacter: (id: string, field: keyof Character, value: string) => void;
    deleteCharacter: (id: string) => void;
    addCharacter: () => void;
    generateCharacter: () => Promise<void>;
}

export const CharactersSection: React.FC<CharactersSectionProps> = ({
    characters,
    isGeneratingCharacter,
    expandedCharacters,
    toggleCharacterExpansion,
    updateCharacter,
    deleteCharacter,
    addCharacter,
    generateCharacter,
}) => {
    return (
        <div className="p-6 bg-amber-50 rounded-xl shadow-lg border border-amber-100">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-100 rounded-lg">
                    <UsersIcon size={24} className="text-amber-700" />
                </div>
                <h2 className="text-2xl font-bold text-amber-900">Characters</h2>
            </div>

            <div className="space-y-4 mb-6">
                {characters.map((character) => (
                    <div
                        key={character.id}
                        className="bg-white rounded-lg shadow-sm border border-amber-100 overflow-hidden"
                    >
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <input
                                    type="text"
                                    value={character.name}
                                    onChange={(e) =>
                                        updateCharacter(character.id, "name", e.target.value)
                                    }
                                    placeholder="Character name..."
                                    className="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none flex-1 placeholder-gray-400"
                                />
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => toggleCharacterExpansion(character.id)}
                                        variant="secondary"
                                        size="sm"
                                        className="text-amber-700 hover:bg-amber-100"
                                    >
                                        {expandedCharacters[character.id] ? "Collapse" : "Expand"}
                                    </Button>
                                    <Tooltip text="Delete character" id={`delete-character-${character.id}`}>
                                        <Button
                                            onClick={() => deleteCharacter(character.id)}
                                            variant="secondary"
                                            size="sm"
                                            className="p-2 text-red-500 hover:bg-red-50 hover:text-red-600"
                                        >
                                            <TrashIcon size={16} />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>

                            {expandedCharacters[character.id] && (
                                <div className="mt-3">
                                    <ResizableTextArea
                                        value={character.description}
                                        onChange={(value) =>
                                            updateCharacter(character.id, "description", value)
                                        }
                                        placeholder="Character description, personality, background..."
                                        className="w-full border border-amber-200 rounded-lg p-3 focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-3">
                <Button
                    onClick={addCharacter}
                    variant="primary"
                    className="bg-amber-700 hover:bg-amber-800 text-white"
                >
                    Add Character
                </Button>
                <Button
                    onClick={generateCharacter}
                    variant="secondary"
                    isLoading={isGeneratingCharacter}
                    className="bg-gradient-to-r from-amber-600 to-amber-800 text-white hover:from-amber-700 hover:to-amber-900"
                >
                    <SparklesIcon size={16} className="mr-2" />
                    AI Generate
                </Button>
            </div>
        </div>
    );
};
