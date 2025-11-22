import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookNote, Chapter, Character, Location } from "../../types/book";
import { BookOpenIcon, MapPinIcon, NotebookIcon, UsersIcon } from "../ui/Icons";
import { SaveStatus } from "../ui/SaveStatus";
import { BaseEntityCard, EntityCardConfig } from "./BaseEntityCard";

export type AllNotesSource = "character" | "chapter" | "location" | "note";

interface NormalizedAdapter<T> {
  items: T[];
  update: (id: string, patch: Partial<T>) => Promise<T | null> | T | null;
  remove: (id: string) => Promise<boolean> | boolean;
  reorder?: (orderedIds: string[]) => Promise<void> | void;
}

interface AllNotesSectionProps {
  headerSaving?: boolean;
  lastSaved?: Date | null;
  saveError?: string | null;
  // Normalized adapters
  characters: NormalizedAdapter<Character>;
  chapters: NormalizedAdapter<Chapter>;
  locations: NormalizedAdapter<Location>;
  notes: NormalizedAdapter<BookNote>;
  tagColorMap?: Record<string, string>;
  onPersistTagColor?: (tag: string, color: string) => Promise<void> | void;
  onUnsavedChangesUpdate?: (has: boolean, count: number) => void;
  // Refs for parent to trigger save/discard dialog flows
  onSaveAllRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  onDiscardAllRef?: React.MutableRefObject<(() => void) | null>;
}

interface AggregatedItem {
  key: string; // source:id
  source: AllNotesSource;
  id: string;
  name: string;
  notes: string;
  tags: string[];
  position: number;
}

export const AllNotesSection: React.FC<AllNotesSectionProps> = ({
  headerSaving = false,
  lastSaved = null,
  saveError = null,
  characters,
  chapters,
  locations,
  notes,
  tagColorMap = {},
  onPersistTagColor,
  onUnsavedChangesUpdate,
  onSaveAllRef,
  onDiscardAllRef,
}) => {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"AND" | "OR">("AND");
  const removeToken = (tok: string) => {
    const current = tokens;
    const next = current.filter((t) => t !== tok);
    // rebuild query string roughly as space separated
    setQuery(next.join(" "));
  };

  // Draft/save state keyed by composite key
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [showSaved, setShowSaved] = useState<Record<string, boolean>>({});

  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState<Record<string, boolean>>({});

  const cardConfigBySource: Record<AllNotesSource, EntityCardConfig> = {
    character: {
      entityType: "character",
      icon: UsersIcon,
      iconColor: "amber",
      gradientFrom: "emerald",
      nameEditMode: "pencil",
      placeholder:
        "Describe this character, their personality, role, background...",
    },
    chapter: {
      entityType: "chapter",
      icon: BookOpenIcon,
      iconColor: "blue",
      gradientFrom: "blue",
      nameEditMode: "pencil",
      placeholder: "Chapter summary and notes...",
    },
    location: {
      entityType: "location",
      icon: MapPinIcon,
      iconColor: "purple",
      gradientFrom: "purple",
      nameEditMode: "pencil",
      placeholder: "Describe this location, its significance, atmosphere...",
    },
    note: {
      entityType: "note",
      icon: NotebookIcon,
      iconColor: "orange",
      gradientFrom: "orange",
      nameEditMode: "pencil",
      placeholder: "Write your note content here...",
    },
  };

  // Build aggregated list (stable grouped ordering)
  const aggregated: AggregatedItem[] = useMemo(() => {
    const asAgg = (
      src: AllNotesSource,
      id: string,
      name: string,
      body: string,
      tags: string[],
      position: number,
    ): AggregatedItem => ({
      key: `${src}:${id}`,
      source: src,
      id,
      name,
      notes: body,
      tags: tags || [],
      position: position ?? 0,
    });
    const chars = (characters.items || [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((c) =>
        asAgg(
          "character",
          c.id,
          c.name,
          c.notes,
          c.tags || [],
          c.position ?? 0,
        ),
      );
    const chaps = (chapters.items || [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((ch) =>
        asAgg(
          "chapter",
          ch.id,
          ch.name || ch.title || "Untitled",
          ch.notes,
          ch.tags || [],
          ch.position ?? 0,
        ),
      );
    const locs = (locations.items || [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((l) =>
        asAgg("location", l.id, l.name, l.notes, l.tags || [], l.position ?? 0),
      );
    const nts = (notes.items || [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((n) =>
        asAgg(
          "note",
          n.id,
          n.title || `Note`,
          n.body,
          n.tags || [],
          n.position ?? 0,
        ),
      );
    return [...chars, ...chaps, ...locs, ...nts];
  }, [characters.items, chapters.items, locations.items, notes.items]);

  const tokens = useMemo(
    () =>
      query
        .toLowerCase()
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    [query],
  );
  const filtered = useMemo(() => {
    if (tokens.length === 0) return aggregated;
    return aggregated.filter((item) => {
      const lcTags = (item.tags || []).map((tag) => tag.toLowerCase());
      if (filterMode === "AND") {
        return tokens.every((t) => lcTags.some((tag) => tag.includes(t)));
      }
      return tokens.some((t) => lcTags.some((tag) => tag.includes(t)));
    });
  }, [aggregated, tokens, filterMode]);

  // Unsaved changes tracking for modal
  const dirtyCount = useMemo(
    () => Object.values(dirty).filter(Boolean).length,
    [dirty],
  );
  useEffect(() => {
    onUnsavedChangesUpdate?.(dirtyCount > 0, dirtyCount);
  }, [dirtyCount, onUnsavedChangesUpdate]);

  // Parent triggers
  const updateImmediate = useCallback(
    async (
      item: AggregatedItem,
      patch: Partial<{ name: string; notes: string; tags: string[] }>,
    ) => {
      if (item.source === "character") {
        await characters.update(item.id, {
          name: patch.name,
          notes: patch.notes,
          tags: patch.tags,
        } as Partial<Character>);
      } else if (item.source === "chapter") {
        await chapters.update(item.id, {
          name: patch.name,
          title: patch.name,
          notes: patch.notes,
          tags: patch.tags,
        } as Partial<Chapter>);
      } else if (item.source === "location") {
        await locations.update(item.id, {
          name: patch.name,
          notes: patch.notes,
          tags: patch.tags,
        } as Partial<Location>);
      } else {
        await notes.update(item.id, {
          title: patch.name,
          body: patch.notes,
          tags: patch.tags,
        } as Partial<BookNote>);
      }
    },
    [chapters, characters, locations, notes],
  );

  const handleSaveByKey = useCallback(
    async (key: string) => {
      if (!dirty[key]) return;
      const item = aggregated.find((a) => a.key === key);
      if (!item) return;
      setSaving((prev) => ({ ...prev, [key]: true }));
      setShowSaved((prev) => ({ ...prev, [key]: false }));
      try {
        await updateImmediate(item, { notes: drafts[key] });
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setDirty((prev) => ({ ...prev, [key]: false }));
        setShowSaved((prev) => ({ ...prev, [key]: true }));
        setTimeout(
          () => setShowSaved((prev) => ({ ...prev, [key]: false })),
          2000,
        );
      } finally {
        setSaving((prev) => ({ ...prev, [key]: false }));
      }
    },
    [aggregated, dirty, drafts, updateImmediate],
  );

  useEffect(() => {
    if (onSaveAllRef)
      onSaveAllRef.current = async () => {
        await Promise.all(
          Object.keys(dirty)
            .filter((k) => dirty[k])
            .map((k) => handleSaveByKey(k)),
        );
      };
    if (onDiscardAllRef)
      onDiscardAllRef.current = () => {
        setDrafts((prev) => {
          const next = { ...prev };
          Object.keys(dirty).forEach((k) => {
            delete next[k];
          });
          return next;
        });
        setDirty({});
      };
  }, [dirty, handleSaveByKey, onDiscardAllRef, onSaveAllRef]);

  const getDisplayValue = (item: AggregatedItem) =>
    drafts[item.key] ?? item.notes ?? "";

  const handleNotesChange = (item: AggregatedItem, value: string) => {
    setDrafts((prev) => ({ ...prev, [item.key]: value }));
    setDirty((prev) => ({ ...prev, [item.key]: value !== item.notes }));
  };

  const handleSave = async (item: AggregatedItem) => {
    await handleSaveByKey(item.key);
  };

  const handleCancel = (item: AggregatedItem) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[item.key];
      return next;
    });
    setDirty((prev) => ({ ...prev, [item.key]: false }));
  };

  const handleDelete = async (index: number) => {
    const item = filtered[index];
    if (!item) return;
    if (item.source === "character") await characters.remove(item.id);
    else if (item.source === "chapter") await chapters.remove(item.id);
    else if (item.source === "location") await locations.remove(item.id);
    else await notes.remove(item.id);
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const item = filtered[index];
    if (!item) return;
    // Only reorder within same source type; find neighbor of same type in filtered order
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    const neighbor = filtered[neighborIndex];
    if (!neighbor || neighbor.source !== item.source) return; // ignore cross-type

    const sourceItems = aggregated
      .filter((a) => a.source === item.source)
      .sort((a, b) => a.position - b.position);
    const currentIdx = sourceItems.findIndex((a) => a.id === item.id);
    const neighborIdxInSource = sourceItems.findIndex(
      (a) => a.id === neighbor.id,
    );
    if (currentIdx < 0 || neighborIdxInSource < 0) return;
    [sourceItems[currentIdx], sourceItems[neighborIdxInSource]] = [
      sourceItems[neighborIdxInSource],
      sourceItems[currentIdx],
    ];
    const orderedIds = sourceItems.map((s) => s.id);
    if (item.source === "character" && characters.reorder)
      await characters.reorder(orderedIds);
    if (item.source === "chapter" && chapters.reorder)
      await chapters.reorder(orderedIds);
    if (item.source === "location" && locations.reorder)
      await locations.reorder(orderedIds);
    if (item.source === "note" && notes.reorder)
      await notes.reorder(orderedIds);
  };

  const startNameEdit = (k: string, initial: string) => {
    setNameDrafts((prev) => ({ ...prev, [k]: initial }));
    setEditingName((prev) => ({ ...prev, [k]: true }));
  };
  const changeNameDraft = (k: string, v: string) =>
    setNameDrafts((prev) => ({ ...prev, [k]: v }));
  const finishNameEdit = async (k: string, save: boolean) => {
    const item = aggregated.find((a) => a.key === k);
    if (!item) return;
    if (save) {
      const newName = nameDrafts[k];
      if (newName !== undefined && newName !== item.name) {
        await updateImmediate(item, { name: newName });
      }
    }
    setEditingName((prev) => ({ ...prev, [k]: false }));
    setNameDrafts((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="p-4 sm:p-6 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
              <NotebookIcon size={20} className="text-orange-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">
                All Notes ({filtered.length}
                {tokens.length > 0 ? ` / ${aggregated.length}` : ""})
              </h4>
              <SaveStatus
                isSaving={headerSaving}
                lastSaved={lastSaved}
                error={saveError}
                className="mt-0.5"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:max-w-xl">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by tag (e.g. suspect, alibi)"
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors bg-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 px-2 py-1"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <div className="inline-flex rounded-md bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setFilterMode("AND")}
                className={`px-3 py-1.5 text-xs font-medium rounded ${filterMode === "AND" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
                title="Match all tags"
              >
                AND
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("OR")}
                className={`px-3 py-1.5 text-xs font-medium rounded ${filterMode === "OR" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
                title="Match any tag"
              >
                OR
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500">
            Type tag(s) to filter. Use AND/OR toggle: AND requires all tokens
            match at least one tag; OR shows items if any token matches.
          </p>
          {tokens.length > 0 && (
            <div
              className="flex flex-wrap gap-2"
              aria-label="Active tag filters"
            >
              {tokens.map((t) => (
                <button
                  key={t + "-pill"}
                  onClick={() => removeToken(t)}
                  className="group inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 hover:text-orange-800 transition-colors"
                  title="Click to remove token"
                >
                  <span>{t}</span>
                  <span className="text-orange-500 group-hover:text-orange-700 font-bold">
                    ×
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 hover:text-gray-800"
                title="Clear all tokens"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((item, index) => {
          const baseCfg = cardConfigBySource[item.source];
          const badgeClassMap: Record<AllNotesSource, string> = {
            character: "bg-amber-100 text-amber-700",
            chapter: "bg-blue-100 text-blue-700",
            location: "bg-purple-100 text-purple-700",
            note: "bg-orange-100 text-orange-700",
          };
          const labelMap: Record<AllNotesSource, string> = {
            character: "Character",
            chapter: "Chapter",
            location: "Location",
            note: "Note",
          };
          const config: EntityCardConfig = {
            ...baseCfg,
            showSpecialActions: (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${badgeClassMap[item.source]}`}
              >
                {labelMap[item.source]}
              </span>
            ),
          };
          return (
            <BaseEntityCard
              key={item.key}
              entity={{
                id: item.id,
                name: nameDrafts[item.key] ?? item.name,
                notes: getDisplayValue(item),
                tags: item.tags,
              }}
              index={index}
              totalCount={filtered.length}
              config={config}
              displayValue={getDisplayValue(item)}
              isDirty={!!dirty[item.key]}
              isSaving={!!saving[item.key]}
              showSaved={!!showSaved[item.key]}
              onUpdateEntity={(_i, entity) =>
                updateImmediate(item, {
                  name: (entity as any).name,
                  tags: (entity as any).tags,
                }) as any
              }
              onNotesChange={(entity) =>
                handleNotesChange(item, (entity as any).notes)
              }
              onSave={() => handleSave(item)}
              onCancel={() => handleCancel(item)}
              onMove={handleMove}
              onDelete={() => handleDelete(index)}
              editingName={!!editingName[item.key]}
              nameDraft={nameDrafts[item.key] ?? item.name}
              onStartNameEdit={() => startNameEdit(item.key, item.name)}
              onNameChange={(v) => changeNameDraft(item.key, v)}
              onFinishNameEdit={(save) => finishNameEdit(item.key, save)}
              tagColorMap={tagColorMap}
              onPersistTagColor={onPersistTagColor}
              highlightTokens={tokens}
            />
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <NotebookIcon
              size={64}
              strokeWidth={1}
              className="text-gray-300 mb-4"
            />
            <p className="text-lg font-medium text-gray-700">
              No notes match your filter
            </p>
            <p className="text-sm text-gray-500">
              Try a different tag or clear the search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
