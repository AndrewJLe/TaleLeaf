import React, { useEffect, useRef, useState } from 'react';
import { featureFlags } from '../../constants/featureFlags';
import { TAG_PALETTE, colorForTagName, hexToRgba, isValidSimpleTag, readableTextColor } from '../../lib/tag-colors';
import { trackEntityDeleted } from '../../lib/telemetry';
import { Button } from '../ui/Button';
import { ChevronDownIcon, ChevronUpIcon, SaveIcon, TrashIcon, UndoIcon } from '../ui/Icons';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { SaveStateIndicator } from '../ui/SaveStateIndicator';
import { Tooltip } from '../ui/Tooltip';

export interface BaseEntity {
  id: string;
  name: string;
  notes: string;
  tags: string[];
}

export interface EntityCardConfig {
  entityType: string; // 'character' | 'chapter' | 'location' | 'note'
  icon: React.ComponentType<{ size: number; className?: string }>;
  iconColor: string; // e.g., 'amber' | 'green' | 'purple' | 'orange'
  gradientFrom: string; // e.g., 'emerald' for 'from-emerald-100'
  nameEditMode?: 'inline' | 'pencil'; // default 'inline'
  placeholder: string; // placeholder for description text area
  showSpecialActions?: React.ReactNode; // optional custom actions for specific entity types
}

interface BaseEntityCardProps<T extends BaseEntity> {
  entity: T;
  index: number;
  totalCount: number;
  config: EntityCardConfig;

  // State management
  displayValue: string;
  isDirty: boolean;
  isSaving: boolean;
  showSaved: boolean;

  // Callbacks
  onUpdateEntity: (index: number, entity: T) => void;
  onNotesChange: (entity: T, notes: string) => void;
  onSave: (entity: T) => void;
  onCancel: (entity: T) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onDelete: (index: number) => void;

  // Name editing state (for pencil mode)
  editingName?: boolean;
  nameDraft?: string;
  onStartNameEdit?: () => void;
  onNameChange?: (name: string) => void;
  onFinishNameEdit?: (save: boolean) => void;

  // Tag color persistence
  tagColorMap?: Record<string, string>; // lowercased tag -> color
  onPersistTagColor?: (tag: string, color: string) => Promise<void> | void;

  // Optional: highlight matching tags (case-insensitive substring match)
  highlightTokens?: string[];
}

const isValidTag = isValidSimpleTag;

export function BaseEntityCard<T extends BaseEntity>({
  entity,
  index,
  totalCount,
  config,
  displayValue,
  isDirty,
  isSaving,
  showSaved,
  onUpdateEntity,
  onNotesChange,
  onSave,
  onCancel,
  onMove,
  onDelete,
  editingName = false,
  nameDraft = '',
  onStartNameEdit,
  onNameChange,
  onFinishNameEdit
  , tagColorMap = {}
  , onPersistTagColor
  , highlightTokens = []
}: BaseEntityCardProps<T>) {
  // Local tag management state
  const [newTagDraft, setNewTagDraft] = useState('');
  const [newTagColorDraft, setNewTagColorDraft] = useState('');
  const [tagColorOverrides, setTagColorOverrides] = useState<Record<string, string>>(tagColorMap);

  // Sync local overrides when external map changes (e.g., after persistence)
  useEffect(() => {
    // Avoid unconditional state churn: only merge if incoming tagColorMap adds/changes values.
    setTagColorOverrides(prev => {
      if (!tagColorMap || Object.keys(tagColorMap).length === 0) return prev; // nothing new
      let needsUpdate = false;
      for (const [k, v] of Object.entries(tagColorMap)) {
        if (prev[k] !== v) { needsUpdate = true; break; }
      }
      if (!needsUpdate) return prev; // prevent re-render loop when parent passes new object identity
      return { ...tagColorMap, ...prev }; // preserve local overrides precedence
    });
  }, [tagColorMap]);
  const [swatchOpen, setSwatchOpen] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { icon: Icon, iconColor, gradientFrom, nameEditMode = 'inline', placeholder, showSpecialActions } = config;

  // Tailwind JIT can't detect classes built from template literals like `from-${gradientFrom}-100`.
  // Provide an explicit mapping from logical gradient names to the full set of Tailwind utility
  // classes so the classes are present in source and won't be purged.
  const GRADIENT_CLASS_MAP: Record<string, string> = {
    emerald: 'from-emerald-100 to-white border-emerald-100 hover:border-emerald-400',
    green: 'from-green-100 to-white border-green-100 hover:border-green-400',
    purple: 'from-purple-100 to-white border-purple-100 hover:border-purple-400',
    orange: 'from-orange-100 to-white border-orange-100 hover:border-orange-400',
    amber: 'from-amber-100 to-white border-amber-100 hover:border-amber-400',
    blue: 'from-blue-100 to-white border-blue-100 hover:border-blue-400',
    indigo: 'from-indigo-100 to-white border-indigo-100 hover:border-indigo-400'
  };

  const gradientClass = GRADIENT_CLASS_MAP[gradientFrom] || GRADIENT_CLASS_MAP['emerald'];

  const handleCreateTag = async () => {
    const raw = newTagDraft.trim().toLowerCase();
    if (!raw || !isValidTag(raw) || (entity.tags || []).includes(raw)) {
      setNewTagDraft('');
      return;
    }

    const color = newTagColorDraft || colorForTagName(raw, { ...tagColorMap, ...tagColorOverrides });

    // Optimistic update: show tag immediately
    const updated = { ...entity, tags: [...(entity.tags || []), raw] } as T;
    onUpdateEntity(index, updated);
    setTagColorOverrides(prev => ({ ...prev, [raw]: color }));

    // Update UI state immediately for responsive feel
    setNewTagDraft('');
    setNewTagColorDraft('');
    setSwatchOpen(false);

    // Persist color in background (don't wait for it)
    if (onPersistTagColor) {
      try {
        const result = onPersistTagColor(raw, color);
        // Handle promise if returned
        if (result && typeof result.catch === 'function') {
          result.catch((e: any) => {
            console.warn('Failed to persist tag color', e);
          });
        }
      } catch (e: any) {
        console.warn('Failed to persist tag color', e);
      }
    }

    // Keep focus on input if present
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleRemoveTag = (tag: string) => {
    const updated = { ...entity, tags: (entity.tags || []).filter(t => t !== tag) } as T;
    onUpdateEntity(index, updated);
  };

  // Delete confirmation state
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteInFlight, setDeleteInFlight] = useState(false);

  const performDelete = async () => {
    setDeleteInFlight(true);
    try {
      onDelete(index);
      trackEntityDeleted(config.entityType, { soft: true });
    } finally {
      setDeleteInFlight(false);
      setConfirmingDelete(false);
    }
  };

  const renderNameField = () => {
    if (nameEditMode === 'pencil' && !editingName) {
      return (
        <div className="flex items-center gap-2 w-full">
          <div className="font-semibold text-gray-900 text-lg truncate">{entity.name || `${config.entityType} name`}</div>
          <Tooltip text={`Edit ${config.entityType} name`} id={`edit-${config.entityType}-name-${entity.id}`}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStartNameEdit?.(); }}
              className="ml-1 p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 focus:outline-none opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 transition-opacity"
              aria-label={`Edit name for ${entity.name}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
                <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor" />
              </svg>
            </button>
          </Tooltip>
        </div>
      );
    }

    if (nameEditMode === 'pencil' && editingName) {
      return (
        <input
          autoFocus
          type="text"
          value={nameDraft}
          onChange={(e) => onNameChange?.(e.target.value)}
          onBlur={() => onFinishNameEdit?.(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onFinishNameEdit?.(true);
            } else if (e.key === 'Escape') {
              onFinishNameEdit?.(false);
            }
          }}
          className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg px-3 py-1 w-full"
        />
      );
    }

    // Default inline editing
    return (
      <input
        type="text"
        value={entity.name}
        onChange={(e) => onUpdateEntity(index, { ...entity, name: e.target.value } as T)}
        className={`font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-${iconColor}-500 rounded-lg px-3 py-1 -mx-3 flex-1 min-w-0`}
        placeholder={`${config.entityType} name`}
      />
    );
  };

  return (
    <div className={`group relative overflow-hidden p-4 sm:p-6 bg-gradient-to-br ${gradientClass} hover:border-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-200`}>
      <div className="space-y-4">
        {/* Title Row */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg bg-${iconColor}-100 flex items-center justify-center relative flex-shrink-0 transition-transform transform hover:scale-105 active:scale-95 cursor-pointer`}
            role="button"
            tabIndex={0}
            onClick={() => { /* TODO: open entity details modal */ }}
          >
            <Icon size={18} className={`text-${iconColor}-600`} />
            {isDirty && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white"></div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0 group">
            {renderNameField()}
          </div>
        </div>

        {/* Tags */}
        <div className="mt-2 basis-full">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {(entity.tags || []).map(tag => {
                const lc = tag.toLowerCase();
                const baseColor = tagColorOverrides[lc] || tagColorMap[lc] || colorForTagName(tag, { ...tagColorMap, ...tagColorOverrides });
                const tokens = (highlightTokens || []).map(t => (t || '').toLowerCase()).filter(Boolean);
                const isHighlighted = tokens.length > 0 && tokens.some(tok => lc.includes(tok));
                return (
                  <div
                    key={tag}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs sm:text-sm font-medium transform transition-transform hover:scale-105 hover:[&>button]:opacity-100"
                    style={{ backgroundColor: hexToRgba(baseColor, 0.6), color: readableTextColor(baseColor), boxShadow: isHighlighted ? `0 0 0 2px ${baseColor}` : undefined }}
                  >
                    <span className="truncate max-w-[10rem]">{tag}</span>
                    <button
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 text-red-600 font-semibold text-xs sm:text-sm opacity-0 focus:opacity-100 focus:outline-none transition-all transform hover:scale-110 hover:font-bold hover:text-red-700 px-1"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {/* Add Tag button */}
              {!addingTag && (
                <Tooltip text="Add tag" id={`add-tag-${entity.id}`}>
                  <button
                    onClick={() => { setAddingTag(true); setTimeout(() => inputRef.current?.focus(), 0); }}
                    className="inline-flex items-center justify-center rounded-full px-2 py-0.5 bg-emerald-200/40 text-emerald-500 text-sm border border-white/20 hover:bg-emerald-200/80 hover:scale-105 transition-all shadow-sm"
                    aria-label="Add tag"
                  >
                    <span className="text-sm">+</span>
                    <span aria-hidden className="ml-1 text-xs">🏷️</span>
                  </button>
                </Tooltip>
              )}
            </div>

            <div>
              {addingTag && (
                <button
                  onClick={() => { setAddingTag(false); setNewTagDraft(''); setNewTagColorDraft(''); }}
                  className="px-3 py-1 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 hover:shadow-sm transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {addingTag && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={newTagDraft}
                  onChange={(e) => {
                    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                    setNewTagDraft(sanitized);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const raw = newTagDraft.trim().toLowerCase();
                      if (isValidTag(raw)) {
                        e.preventDefault();
                        handleCreateTag();
                      }
                    } else if (e.key === 'Escape') {
                      setAddingTag(false);
                    }
                  }}
                  placeholder="add tag here"
                  className="px-3 py-2 sm:py-1 border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-colors duration-150 w-full sm:w-auto"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSwatchOpen(!swatchOpen)}
                  className="px-2 sm:px-3 py-2 sm:py-1 bg-white border border-gray-200 rounded-lg shadow-sm text-sm hover:scale-105 transition-transform flex items-center gap-1"
                  title="Pick tag color"
                >
                  <span className="text-lg">🎨</span>
                  <span className="hidden sm:inline text-xs text-gray-600">Color</span>
                </button>
                <button
                  onClick={handleCreateTag}
                  disabled={!isValidTag(newTagDraft.trim().toLowerCase())}
                  className={`px-3 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors ${isValidTag(newTagDraft.trim().toLowerCase()) ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                  Create
                </button>
              </div>

              {swatchOpen && (
                <div className="w-full">
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {TAG_PALETTE.map(col => (
                      <button
                        key={col}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setNewTagColorDraft(col)}
                        className={`w-5 h-5 rounded-full transform transition-transform hover:scale-110 focus:scale-110 outline-none ${newTagColorDraft === col ? 'ring-4 ring-emerald-200' : 'ring-2 ring-transparent'}`}
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

        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {/* Primary Actions - Save and Status */}
          <div className="flex items-center gap-2 order-2 sm:order-1">
            <button
              onClick={() => onSave(entity)}
              disabled={isSaving || !isDirty}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center gap-2 ${isSaving
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : isDirty
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                  : 'bg-emerald-100 text-emerald-700 cursor-default'
                }`}
              title="Ctrl+Enter to save"
            >
              <SaveIcon size={14} />
              <span className="hidden sm:inline">
                {isSaving ? 'Saving...' : 'Save'}
              </span>
            </button>
            {isDirty && (
              <Button
                onClick={() => onCancel(entity)}
                variant="secondary"
                size="sm"
                className="bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                <UndoIcon size={14} />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            )}
            <SaveStateIndicator
              isSaving={isSaving}
              showSaved={showSaved}
              hasUnsavedChanges={isDirty}
            />
          </div>

          {/* Secondary Actions - Navigation and Tools */}
          <div className="flex items-center gap-2 order-1 sm:order-2">
            {showSpecialActions}

            <div className="flex items-center gap-1">
              <Tooltip
                text={`Move this ${config.entityType} up in the order`}
                id={`${config.entityType}-up-${entity.id}`}
              >
                <Button
                  onClick={() => onMove(index, 'up')}
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                >
                  <ChevronUpIcon size={14} />
                </Button>
              </Tooltip>
              <Tooltip
                text={`Move this ${config.entityType} down in the order`}
                id={`${config.entityType}-down-${entity.id}`}
              >
                <Button
                  onClick={() => onMove(index, 'down')}
                  variant="ghost"
                  size="sm"
                  disabled={index === totalCount - 1}
                >
                  <ChevronDownIcon size={14} />
                </Button>
              </Tooltip>
            </div>

            <div className="w-px h-6 bg-gray-200"></div>

            <Tooltip
              text={`Remove this ${config.entityType} from your list`}
              id={`delete-${config.entityType}-${entity.id}`}
            >
              <Button
                onClick={() => {
                  if (featureFlags.confirmDeleteEntities) {
                    setConfirmingDelete(true);
                  } else {
                    performDelete();
                  }
                }}
                variant="danger"
                size="sm"
              >
                <TrashIcon size={14} />
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-600 font-medium">{config.entityType.charAt(0).toUpperCase() + config.entityType.slice(1)} Description</label>
          <ResizableTextArea
            value={displayValue}
            onChange={(notes) => onNotesChange(entity, notes)}
            onSave={() => onSave(entity)}
            placeholder={placeholder}
            className="!bg-white !border-gray-200"
            minRows={3}
            maxRows={15}
          />
          {isDirty && (
            <p className="text-xs text-gray-500">
              Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Enter</kbd> or click Save to save your changes
            </p>
          )}
        </div>
      </div>

      {/* Sheen overlay */}
      <div className="pointer-events-none absolute inset-0 z-20 transform -translate-x-full -translate-y-full group-hover:translate-x-full group-hover:translate-y-full transition-transform duration-900 ease-out will-change-transform">
        <div className="absolute left-0 top-[-10%] -translate-y-1/4 bg-gradient-to-r from-transparent via-white/70 to-transparent w-12 h-[300%] rotate-45 -skew-x-12 opacity-80 blur-md"></div>
      </div>

      {confirmingDelete && featureFlags.confirmDeleteEntities && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-red-200 rounded-xl shadow-lg p-5 w-full max-w-sm">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Delete {config.entityType}?</h4>
            <p className="text-xs text-gray-600 mb-4">This will remove this {config.entityType} from active view. (Soft-deleted)</p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleteInFlight}
                className="flex-1"
              >Cancel</Button>
              <Button
                variant="danger"
                size="sm"
                onClick={performDelete}
                disabled={deleteInFlight}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >{deleteInFlight ? 'Deleting…' : 'Delete'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
