import React, { useEffect, useState } from "react";
import { Chapter } from "../../types/book";
import { Button } from "../ui/Button";
import {
  BookOpenIcon,
  PlusIcon,
  SaveIcon,
  SparklesIcon,
  UndoIcon,
} from "../ui/Icons";
import { SaveStatus } from "../ui/SaveStatus";
import { Tooltip } from "../ui/Tooltip";
import { BaseEntityCard, EntityCardConfig } from "./BaseEntityCard";

interface ChaptersSectionProps {
  chapters: Chapter[];
  onAddChapter: (chapter: Omit<Chapter, "id">) => void;
  onUpdateChapter: (index: number, chapter: Chapter) => void;
  onBatchUpdateChapters?: (chapters: Chapter[]) => Promise<void>;
  onDeleteChapter: (index: number) => void;
  onMoveChapter: (index: number, direction: "up" | "down") => void;
  onGenerateSummary: (index: number) => void;
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

export const ChaptersSection: React.FC<ChaptersSectionProps> = ({
  chapters,
  onAddChapter,
  onUpdateChapter,
  onBatchUpdateChapters,
  onDeleteChapter,
  onMoveChapter,
  onGenerateSummary,
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
  const [newChapterName, setNewChapterName] = useState("");

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
    entityType: "chapter",
    icon: BookOpenIcon,
    iconColor: "blue",
    gradientFrom: "blue",
    nameEditMode: "pencil",
    placeholder: "Chapter summary and notes...",
    showSpecialActions: (
      <Tooltip
        text="Generate an AI-powered summary of this chapter from your selected text"
        id={`chapter-summary-generate`}
      >
        <Button
          onClick={() => {
            /* onGenerateSummary will be passed per-chapter */
          }}
          variant="ghost"
          size="sm"
          isLoading={isGenerating}
        >
          <SparklesIcon size={14} />
          <span className="hidden sm:inline">Summary</span>
        </Button>
      </Tooltip>
    ),
  };

  // Create chapter lookup map for easy access
  const chapterMap = React.useMemo(() => {
    if (!chapters) return {};
    return chapters.reduce(
      (acc, chapter, index) => {
        acc[chapter.id] = { chapter, index };
        return acc;
      },
      {} as Record<string, { chapter: Chapter; index: number }>,
    );
  }, [chapters]);

  // Clean up drafts when chapters are removed
  useEffect(() => {
    if (!chapters) return;
    const currentIds = new Set(chapters.map((c) => c.id));
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
  }, [chapters]);

  // Get display value (draft or persisted)
  const getDisplayValue = (chapter: Chapter): string => {
    return drafts[chapter.id] ?? chapter.notes;
  };

  // Track changes for individual chapters
  const handleChapterNotesChange = (chapter: Chapter, notes: string) => {
    setDrafts((prev) => ({ ...prev, [chapter.id]: notes }));
    setDirty((prev) => ({
      ...prev,
      [chapter.id]: notes !== chapter.notes,
    }));
  };

  // Save individual chapter
  const handleSaveChapter = async (chapter: Chapter) => {
    if (!dirty[chapter.id]) return;

    const chapterInfo = chapterMap[chapter.id];
    if (!chapterInfo) return;

    setSavingStates((prev) => ({ ...prev, [chapter.id]: true }));
    setShowSavedStates((prev) => ({ ...prev, [chapter.id]: false }));

    try {
      // Ensure minimum 800ms for better UX perception
      await Promise.all([
        onUpdateChapter(chapterInfo.index, {
          ...chapter,
          notes: drafts[chapter.id],
        }),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);

      // Clear draft and mark as clean
      setDrafts((prev) => {
        const { [chapter.id]: _, ...rest } = prev;
        return rest;
      });
      setDirty((prev) => ({ ...prev, [chapter.id]: false }));
      setShowSavedStates((prev) => ({ ...prev, [chapter.id]: true }));

      // Hide the "saved" indicator after 2 seconds
      setTimeout(() => {
        setShowSavedStates((prev) => ({ ...prev, [chapter.id]: false }));
      }, 2000);
    } catch (error) {
      console.error("Failed to save chapter:", error);
    } finally {
      setSavingStates((prev) => ({ ...prev, [chapter.id]: false }));
    }
  };

  // Save all dirty chapters
  const handleSaveAll = async () => {
    const dirtyIds = Object.keys(dirty).filter((id) => dirty[id]);
    if (dirtyIds.length === 0) return;

    // Set all dirty chapters to saving state
    setSavingStates((prev) => {
      const newStates = { ...prev };
      dirtyIds.forEach((id) => {
        newStates[id] = true;
      });
      return newStates;
    });

    try {
      if (onBatchUpdateChapters) {
        // Use the batch update method - this prevents race conditions
        const updatedChapters = (chapters || []).map((chapter) =>
          dirty[chapter.id]
            ? { ...chapter, notes: drafts[chapter.id] }
            : chapter,
        );

        await onBatchUpdateChapters(updatedChapters);
      } else {
        // Fallback to sequential individual updates with delays
        for (let i = 0; i < dirtyIds.length; i++) {
          const id = dirtyIds[i];
          const chapterInfo = chapterMap[id];
          if (chapterInfo && drafts[id] !== undefined) {
            await onUpdateChapter(chapterInfo.index, {
              ...chapterInfo.chapter,
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
      console.error("Failed to save chapters:", error);
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

  // Count dirty chapters for UI
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

  const handleAddChapter = () => {
    if (!newChapterName.trim()) return;
    onAddChapter({ name: newChapterName.trim(), notes: "", tags: [] });
    setNewChapterName("");
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <BookOpenIcon size={20} className="text-green-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">
                Chapters ({(chapters || []).length})
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
          </div>
        </div>

        {/* Manual Add Chapter */}
        <div className="flex gap-3">
          <input
            type="text"
            value={newChapterName}
            onChange={(e) => setNewChapterName(e.target.value)}
            placeholder="Chapter title..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
            onKeyPress={(e) => e.key === "Enter" && handleAddChapter()}
          />
          <Tooltip
            text="Add a new chapter to your book structure"
            id="add-chapter-button"
          >
            <Button onClick={handleAddChapter} variant="primary">
              <PlusIcon size={16} />
              Add Chapter
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="space-y-4">
        {(chapters || []).map((chapter, index) => (
          <BaseEntityCard
            key={chapter.id}
            entity={chapter}
            index={index}
            totalCount={(chapters || []).length}
            config={{
              ...cardConfig,
              showSpecialActions: (
                <Tooltip
                  text="Generate an AI-powered summary of this chapter from your selected text"
                  id={`chapter-summary-${chapter.id}`}
                >
                  <Button
                    onClick={() => onGenerateSummary(index)}
                    variant="ghost"
                    size="sm"
                    isLoading={isGenerating}
                  >
                    <SparklesIcon size={14} />
                    <span className="hidden sm:inline">Summary</span>
                  </Button>
                </Tooltip>
              ),
            }}
            displayValue={getDisplayValue(chapter)}
            isDirty={dirty[chapter.id] || false}
            isSaving={savingStates[chapter.id] || false}
            showSaved={showSavedStates[chapter.id] || false}
            onUpdateEntity={onUpdateChapter}
            onNotesChange={handleChapterNotesChange}
            onSave={handleSaveChapter}
            onCancel={(chapter) => {
              setDrafts((prev) => {
                const { [chapter.id]: _, ...rest } = prev;
                return rest;
              });
              setDirty((prev) => ({ ...prev, [chapter.id]: false }));
            }}
            onMove={onMoveChapter}
            onDelete={onDeleteChapter}
            editingName={editingName[chapter.id] || false}
            nameDraft={nameDrafts[chapter.id] ?? chapter.name}
            onStartNameEdit={() => {
              setNameDrafts((prev) => ({
                ...prev,
                [chapter.id]: chapter.name,
              }));
              setEditingName((prev) => ({ ...prev, [chapter.id]: true }));
            }}
            onNameChange={(name) =>
              setNameDrafts((prev) => ({ ...prev, [chapter.id]: name }))
            }
            onFinishNameEdit={(save) => {
              if (save) {
                const newName = nameDrafts[chapter.id];
                if (newName !== undefined && newName !== chapter.name) {
                  onUpdateChapter(index, {
                    ...chapter,
                    name: newName,
                    title: newName,
                  });
                }
              }
              setEditingName((prev) => ({ ...prev, [chapter.id]: false }));
              setNameDrafts((prev) => {
                const copy = { ...prev };
                delete copy[chapter.id];
                return copy;
              });
            }}
            tagColorMap={tagColorMap}
            onPersistTagColor={onPersistTagColor}
          />
        ))}

        {(chapters || []).length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="mb-4 flex justify-center">
              <BookOpenIcon
                size={64}
                strokeWidth={1}
                className="text-gray-300"
              />
            </div>
            <p className="text-lg font-medium text-gray-700">No chapters yet</p>
            <p className="text-sm text-gray-500">
              Add your first chapter above
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
