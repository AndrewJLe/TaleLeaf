import React, { useEffect, useState } from "react";
import { Character } from "../../types/book";
import { Button } from "../ui/Button";
import {
  PlusIcon,
  SaveIcon,
  SparklesIcon,
  UndoIcon,
  UsersIcon,
} from "../ui/Icons";
import { SaveStatus } from "../ui/SaveStatus";
import { Tooltip } from "../ui/Tooltip";
import { BaseEntityCard, EntityCardConfig } from "./BaseEntityCard";

interface CharactersSectionProps {
  characters: Character[];
  onAddCharacter: (character: Omit<Character, "id">) => void;
  onUpdateCharacter: (index: number, character: Character) => void;
  onBatchUpdateCharacters?: (characters: Character[]) => Promise<void>;
  onDeleteCharacter: (index: number) => void;
  onMoveCharacter: (index: number, direction: "up" | "down") => void;
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
  tagColorMap?: Record<string, string>;
  onPersistTagColor?: (name: string, color: string) => void | Promise<void>;
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
  onDiscardAllRef,
  tagColorMap = {},
  onPersistTagColor,
}) => {
  const [newCharacterName, setNewCharacterName] = useState("");

  // ID-based draft tracking
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [showSavedStates, setShowSavedStates] = useState<
    Record<string, boolean>
  >({});
  // Local state for inline name editing
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState<Record<string, boolean>>({});

  // Entity card configuration
  const cardConfig: EntityCardConfig = {
    entityType: "character",
    icon: UsersIcon,
    iconColor: "amber",
    gradientFrom: "emerald",
    nameEditMode: "pencil",
    placeholder:
      "Describe this character, their personality, role, background...",
  };

  // Create character lookup map for easy access
  const characterMap = React.useMemo(() => {
    return characters.reduce(
      (acc, char, index) => {
        acc[char.id] = { character: char, index };
        return acc;
      },
      {} as Record<string, { character: Character; index: number }>,
    );
  }, [characters]);

  // Clean up drafts when characters are removed
  useEffect(() => {
    const currentIds = new Set(characters.map((c) => c.id));
    setDrafts((prev) => {
      const cleaned = { ...prev };
      Object.keys(cleaned).forEach((id) => {
        if (!currentIds.has(id)) {
          delete cleaned[id];
        }
      });
      return cleaned;
    });
    setDirty((prev) => {
      const cleaned = { ...prev };
      Object.keys(cleaned).forEach((id) => {
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
    setDrafts((prev) => ({ ...prev, [character.id]: notes }));
    setDirty((prev) => ({
      ...prev,
      [character.id]: notes !== character.notes,
    }));
  };

  // Save individual character
  const handleSaveCharacter = async (character: Character) => {
    if (!dirty[character.id]) return;

    const characterInfo = characterMap[character.id];
    if (!characterInfo) return;

    setSavingStates((prev) => ({ ...prev, [character.id]: true }));
    setShowSavedStates((prev) => ({ ...prev, [character.id]: false }));

    try {
      // Ensure minimum 800ms for better UX perception
      await Promise.all([
        onUpdateCharacter(characterInfo.index, {
          ...character,
          notes: drafts[character.id],
        }),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);

      // Clear draft and mark as clean
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[character.id];
        return next;
      });
      setDirty((prev) => ({ ...prev, [character.id]: false }));
      setShowSavedStates((prev) => ({ ...prev, [character.id]: true }));

      // Hide the "saved" indicator after 2 seconds
      setTimeout(() => {
        setShowSavedStates((prev) => ({ ...prev, [character.id]: false }));
      }, 2000);
    } catch (error) {
      console.error("Failed to save character:", error);
    } finally {
      setSavingStates((prev) => ({ ...prev, [character.id]: false }));
    }
  };

  // Save all dirty characters
  const handleSaveAll = async () => {
    const dirtyIds = Object.keys(dirty).filter((id) => dirty[id]);
    if (dirtyIds.length === 0) return;

    // Set all dirty characters to saving state
    setSavingStates((prev) => {
      const newStates = { ...prev };
      dirtyIds.forEach((id) => {
        newStates[id] = true;
      });
      return newStates;
    });

    try {
      if (onBatchUpdateCharacters) {
        // Use the batch update method - this prevents race conditions
        const updatedCharacters = characters.map((character) =>
          dirty[character.id]
            ? { ...character, notes: drafts[character.id] }
            : character,
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
              notes: drafts[id],
            });

            // Add delay between saves to prevent race conditions
            if (i < dirtyIds.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
        }
      }

      // Wait a bit for save to complete
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Clear all drafts and mark as clean
      setDrafts((prev) => {
        const newDrafts = { ...prev };
        dirtyIds.forEach((id) => {
          delete newDrafts[id];
        });
        return newDrafts;
      });
      setDirty((prev) => {
        const newDirty = { ...prev };
        dirtyIds.forEach((id) => {
          newDirty[id] = false;
        });
        return newDirty;
      });
      setShowSavedStates((prev) => {
        const newStates = { ...prev };
        dirtyIds.forEach((id) => {
          newStates[id] = true;
        });
        return newStates;
      });

      // Hide saved indicators after 2 seconds
      setTimeout(() => {
        setShowSavedStates((prev) => {
          const newStates = { ...prev };
          dirtyIds.forEach((id) => {
            newStates[id] = false;
          });
          return newStates;
        });
      }, 2000);
    } catch (error) {
      console.error("Failed to save characters:", error);
    } finally {
      setSavingStates((prev) => {
        const newStates = { ...prev };
        dirtyIds.forEach((id) => {
          newStates[id] = false;
        });
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
    onAddCharacter({ name: newCharacterName.trim(), notes: "", tags: [] });
    setNewCharacterName("");
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
              <h4 className="text-lg font-semibold text-gray-900">
                Characters ({characters.length})
              </h4>
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
                {isGenerating ? "Generating..." : "AI Generate"}
              </Button>
            </Tooltip>
          </div>
        </div>{" "}
        {/* Manual Add Character */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newCharacterName}
            onChange={(e) => setNewCharacterName(e.target.value)}
            placeholder="Character name..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
            onKeyPress={(e) => e.key === "Enter" && handleAddCharacter()}
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
          <BaseEntityCard
            key={character.id}
            entity={character}
            index={index}
            totalCount={characters.length}
            config={cardConfig}
            displayValue={getDisplayValue(character)}
            isDirty={dirty[character.id] || false}
            isSaving={savingStates[character.id] || false}
            showSaved={showSavedStates[character.id] || false}
            onUpdateEntity={onUpdateCharacter}
            onNotesChange={handleCharacterNotesChange}
            onSave={handleSaveCharacter}
            onCancel={(character) => {
              setDrafts((prev) => {
                const next = { ...prev };
                delete next[character.id];
                return next;
              });
              setDirty((prev) => ({ ...prev, [character.id]: false }));
            }}
            onMove={onMoveCharacter}
            onDelete={onDeleteCharacter}
            editingName={editingName[character.id] || false}
            nameDraft={nameDrafts[character.id] ?? character.name}
            onStartNameEdit={() => {
              setNameDrafts((prev) => ({
                ...prev,
                [character.id]: character.name,
              }));
              setEditingName((prev) => ({ ...prev, [character.id]: true }));
            }}
            onNameChange={(name) =>
              setNameDrafts((prev) => ({ ...prev, [character.id]: name }))
            }
            onFinishNameEdit={(save) => {
              if (save) {
                const newName = nameDrafts[character.id];
                if (newName !== undefined && newName !== character.name) {
                  onUpdateCharacter(index, { ...character, name: newName });
                }
              }
              setEditingName((prev) => ({ ...prev, [character.id]: false }));
              setNameDrafts((prev) => {
                const copy = { ...prev };
                delete copy[character.id];
                return copy;
              });
            }}
            tagColorMap={tagColorMap}
            onPersistTagColor={onPersistTagColor}
          />
        ))}

        {characters.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="mb-4 flex justify-center">
              <UsersIcon size={64} strokeWidth={1} className="text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-700">
              No characters yet
            </p>
            <p className="text-sm text-gray-500">
              Add your first character above or use AI Generate
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
