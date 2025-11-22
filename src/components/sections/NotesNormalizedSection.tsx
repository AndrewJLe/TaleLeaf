import React, { useEffect, useMemo, useState } from "react";
import { BookNote } from "../../types/book";
import { Button } from "../ui/Button";
import {
  EyeIcon,
  EyeOffIcon,
  NotebookIcon,
  PlusIcon,
  SaveIcon,
  UndoIcon,
} from "../ui/Icons";
import { Tooltip } from "../ui/Tooltip";
import { BaseEntityCard, EntityCardConfig } from "./BaseEntityCard";

interface NotesNormalizedSectionProps {
  notes: BookNote[];
  currentWindowEnd: number;
  addNote: (
    note: Omit<BookNote, "id" | "createdAt" | "updatedAt" | "bookId">,
  ) => Promise<void> | void;
  immediateUpdateNote: (
    id: string,
    updates: Partial<BookNote>,
  ) => Promise<void> | void;
  updateDraft: (id: string, updates: Partial<BookNote>) => void;
  saveNote: (id: string) => Promise<void>;
  cancelNote: (id: string) => void;
  deleteNote: (id: string) => Promise<void>;
  reorderNotes: (noteIds: string[]) => Promise<void>;
  saveAllNotes: () => Promise<void>;
  discardAllChanges: () => void;
  dirtyNoteIds: string[];
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  error?: string | null;
  tagColorMap?: Record<string, string>;
  onPersistTagColor?: (tag: string, color: string) => Promise<void> | void;
  onUnsavedChangesUpdate?: (has: boolean, count: number) => void;
  onSaveAllRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  onDiscardAllRef?: React.MutableRefObject<(() => void) | null>;
}

interface NoteEntityProxy {
  id: string;
  name: string;
  notes: string;
  tags: string[];
}

export const NotesNormalizedSection: React.FC<NotesNormalizedSectionProps> = ({
  notes,
  currentWindowEnd,
  addNote,
  immediateUpdateNote,
  updateDraft,
  saveNote,
  cancelNote,
  deleteNote,
  reorderNotes,
  saveAllNotes,
  discardAllChanges,
  dirtyNoteIds,
  hasUnsavedChanges,
  isLoading,
  error,
  tagColorMap = {},
  onPersistTagColor,
  onUnsavedChangesUpdate,
  onSaveAllRef,
  onDiscardAllRef,
}) => {
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [showSaved, setShowSaved] = useState<Record<string, boolean>>({});
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [editingName, setEditingName] = useState<Record<string, boolean>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  const config: EntityCardConfig = {
    entityType: "note",
    icon: NotebookIcon,
    iconColor: "orange",
    gradientFrom: "orange",
    nameEditMode: "pencil",
    placeholder: "Write your note content here...",
  };

  useEffect(() => {
    if (onSaveAllRef) onSaveAllRef.current = saveAllNotes;
    if (onDiscardAllRef) onDiscardAllRef.current = discardAllChanges;
  }, [saveAllNotes, discardAllChanges, onSaveAllRef, onDiscardAllRef]);

  useEffect(() => {
    onUnsavedChangesUpdate?.(hasUnsavedChanges, dirtyNoteIds.length);
  }, [hasUnsavedChanges, dirtyNoteIds, onUnsavedChangesUpdate]);

  const handleAddNote = async () => {
    const count = notes.length;
    // Immediate create (no dirty state afterward)
    await addNote({
      title: newNoteTitle.trim() || `Note ${count + 1}`,
      body: "",
      tags: [],
      position:
        count === 0 ? 0 : Math.max(...notes.map((n) => n.position)) + 1000,
      spoilerProtected: false,
      minVisiblePage: undefined,
      groupId: null,
    });
    setNewNoteTitle("");
  };

  const proxyEntities: NoteEntityProxy[] = useMemo(
    () =>
      notes
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((n) => ({
          id: n.id,
          name: n.title || "",
          notes: n.body,
          tags: n.tags,
        })),
    [notes],
  );

  const isDirty = (id: string) => dirtyNoteIds.includes(id);

  const handleSave = async (entity: NoteEntityProxy) => {
    if (!isDirty(entity.id)) return;
    setSaving((p) => ({ ...p, [entity.id]: true }));
    setShowSaved((p) => ({ ...p, [entity.id]: false }));
    await saveNote(entity.id);
    setSaving((p) => ({ ...p, [entity.id]: false }));
    setShowSaved((p) => ({ ...p, [entity.id]: true }));
    setTimeout(() => setShowSaved((p) => ({ ...p, [entity.id]: false })), 1800);
  };

  const handleCancel = (entity: NoteEntityProxy) => {
    cancelNote(entity.id);
  };
  const handleUpdateEntity = (_index: number, entity: NoteEntityProxy) => {
    // If only tags changed (length diff) update immediately, else draft
    const original = notes.find((n) => n.id === entity.id);
    if (original && original.tags.length !== entity.tags.length) {
      immediateUpdateNote(entity.id, { tags: entity.tags });
      return;
    }
    updateDraft(entity.id, {
      title: entity.name,
      body: entity.notes,
      tags: entity.tags,
    });
  };
  const handleNotesChange = (entity: NoteEntityProxy, value: string) => {
    updateDraft(entity.id, { body: value });
  };

  // Name editing handled inline when starting edit so the draft is initialized
  // from the displayed proxy entity (keeps behavior consistent with other sections)

  const changeNameDraft = (id: string, v: string) =>
    setNameDrafts((prev) => ({ ...prev, [id]: v }));

  const finishNameEdit = async (id: string, save: boolean) => {
    const draft = nameDrafts[id];
    if (save) {
      // Persist immediately like other single-field immediate ops
      await immediateUpdateNote(id, { title: draft?.trim() || undefined });
    }
    // Clear editing state
    setEditingName((prev) => ({ ...prev, [id]: false }));
    setNameDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const ordered = [...notes].sort((a, b) => a.position - b.position);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= ordered.length) return;
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
    ordered.forEach((n, i) => updateDraft(n.id, { position: i * 1000 }));
    await reorderNotes(ordered.map((n) => n.id));
  };

  const handleDelete = async (index: number) => {
    const entity = proxyEntities[index];
    if (!entity) return;
    await deleteNote(entity.id);
  };

  const toggleSpoiler = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    updateDraft(id, { spoilerProtected: !note.spoilerProtected });
  };

  const spoilerAction = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return null;
    return (
      <Tooltip
        text={
          note.spoilerProtected
            ? "Disable spoiler protection"
            : "Enable spoiler protection"
        }
        id={`spoiler-${noteId}`}
      >
        <Button
          onClick={() => toggleSpoiler(noteId)}
          variant="ghost"
          size="sm"
          className={
            note.spoilerProtected ? "text-yellow-600" : "text-gray-400"
          }
        >
          {note.spoilerProtected ? (
            <EyeOffIcon size={14} />
          ) : (
            <EyeIcon size={14} />
          )}
        </Button>
      </Tooltip>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-4 sm:p-6 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <NotebookIcon size={20} className="text-orange-600" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900">
              Notes ({notes.length})
            </h4>
            {hasUnsavedChanges && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                {dirtyNoteIds.length} unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Button
                onClick={saveAllNotes}
                size="sm"
                variant="primary"
                disabled={isLoading}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <SaveIcon size={14} />
                <span className="hidden sm:inline ml-1">Save All</span>
              </Button>
            )}
            {hasUnsavedChanges && (
              <Button
                onClick={discardAllChanges}
                size="sm"
                variant="secondary"
                className="bg-gray-600 text-white hover:bg-gray-700"
              >
                <UndoIcon size={14} />
                <span className="hidden sm:inline ml-1">Discard All</span>
              </Button>
            )}
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
                placeholder="Note title..."
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              />
              <Button
                onClick={handleAddNote}
                variant="primary"
                disabled={isLoading}
              >
                <PlusIcon size={16} /> Add Note
              </Button>
            </div>
          </div>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
      <div className="space-y-4">
        {proxyEntities.map((entity, index) => {
          const noteObj = notes.find((n) => n.id === entity.id);
          const initialName =
            nameDrafts[entity.id] ??
            noteObj?.title ??
            (noteObj?.body ? noteObj.body.slice(0, 60) : entity.name);
          return (
            <BaseEntityCard
              key={entity.id}
              entity={entity as any}
              index={index}
              totalCount={proxyEntities.length}
              config={{
                ...config,
                showSpecialActions: spoilerAction(entity.id),
              }}
              displayValue={entity.notes}
              isDirty={isDirty(entity.id)}
              isSaving={!!saving[entity.id]}
              showSaved={!!showSaved[entity.id]}
              onUpdateEntity={handleUpdateEntity as any}
              onNotesChange={handleNotesChange as any}
              onSave={() => handleSave(entity)}
              onCancel={() => handleCancel(entity)}
              onMove={handleMove}
              onDelete={handleDelete}
              tagColorMap={tagColorMap}
              onPersistTagColor={onPersistTagColor}
              // Name edit props (pencil mode)
              editingName={!!editingName[entity.id]}
              nameDraft={initialName}
              onStartNameEdit={() => {
                const noteObj = notes.find((n) => n.id === entity.id);
                const initial =
                  nameDrafts[entity.id] ??
                  noteObj?.title ??
                  (noteObj?.body ? noteObj.body.slice(0, 60) : entity.name);
                setNameDrafts((prev) => ({ ...prev, [entity.id]: initial }));
                setEditingName((prev) => ({ ...prev, [entity.id]: true }));
              }}
              onNameChange={(v) => changeNameDraft(entity.id, v)}
              onFinishNameEdit={(save) => finishNameEdit(entity.id, save)}
            />
          );
        })}
        {proxyEntities.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            <NotebookIcon
              size={64}
              strokeWidth={1}
              className="text-gray-300 mb-4"
            />
            <p className="text-lg font-medium text-gray-700">No notes yet</p>
            <p className="text-sm text-gray-500">
              Add your first note to get started.
            </p>
          </div>
        )}
        {isLoading && (
          <div className="text-center py-6 text-gray-500">Loading notes...</div>
        )}
      </div>
    </div>
  );
};
