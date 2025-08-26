import React, { useEffect, useState } from 'react';
import { Location } from '../../types/book';
import { Button } from '../ui/Button';
import { MapPinIcon, PlusIcon, SaveIcon, SparklesIcon, UndoIcon } from '../ui/Icons';
import { SaveStatus } from '../ui/SaveStatus';
import { Tooltip } from '../ui/Tooltip';
import { BaseEntityCard, EntityCardConfig } from './BaseEntityCard';

interface LocationsSectionProps {
  locations: Location[];
  onAddLocation: (location: Omit<Location, 'id'>) => void;
  onUpdateLocation: (index: number, location: Location) => void;
  onBatchUpdateLocations?: (locations: Location[]) => Promise<void>;
  onDeleteLocation: (index: number) => void;
  onMoveLocation: (index: number, direction: 'up' | 'down') => void;
  onGenerateLocations: () => void;
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

export const LocationsSection: React.FC<LocationsSectionProps> = ({
  locations,
  onAddLocation,
  onUpdateLocation,
  onBatchUpdateLocations,
  onDeleteLocation,
  onMoveLocation,
  onGenerateLocations,
  isGenerating,
  isSaving = false,
  lastSaved = null,
  saveError = null,
  onUnsavedChangesUpdate,
  onSaveAllRef,
  onDiscardAllRef
}) => {
  const [newLocationName, setNewLocationName] = useState('');

  // ID-based draft tracking
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [showSavedStates, setShowSavedStates] = useState<Record<string, boolean>>({});
  // Local state for inline name editing
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState<Record<string, boolean>>({});

  // Entity card configuration
  const cardConfig: EntityCardConfig = {
    entityType: 'location',
    icon: MapPinIcon,
    iconColor: 'purple',
    gradientFrom: 'purple',
    nameEditMode: 'inline',
    placeholder: 'Describe this location, its significance, atmosphere...'
  };

  // Create location lookup map for easy access
  const locationMap = React.useMemo(() => {
    if (!locations) return {};
    return locations.reduce((acc, location, index) => {
      acc[location.id] = { location, index };
      return acc;
    }, {} as Record<string, { location: Location; index: number }>);
  }, [locations]);

  // Clean up drafts when locations are removed
  useEffect(() => {
    if (!locations) return;
    const currentIds = new Set(locations.map(l => l.id));
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
  }, [locations]);

  // Get display value (draft or persisted)
  const getDisplayValue = (location: Location): string => {
    return drafts[location.id] ?? location.notes;
  };

  // Track changes for individual locations
  const handleLocationNotesChange = (location: Location, notes: string) => {
    setDrafts(prev => ({ ...prev, [location.id]: notes }));
    setDirty(prev => ({
      ...prev,
      [location.id]: notes !== location.notes
    }));
  };

  // Save individual location
  const handleSaveLocation = async (location: Location) => {
    if (!dirty[location.id]) return;

    const locationInfo = locationMap[location.id];
    if (!locationInfo) return;

    setSavingStates(prev => ({ ...prev, [location.id]: true }));
    setShowSavedStates(prev => ({ ...prev, [location.id]: false }));

    try {
      // Ensure minimum 800ms for better UX perception
      await Promise.all([
        onUpdateLocation(locationInfo.index, {
          ...location,
          notes: drafts[location.id]
        }),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);

      // Clear draft and mark as clean
      setDrafts(prev => {
        const { [location.id]: _, ...rest } = prev;
        return rest;
      });
      setDirty(prev => ({ ...prev, [location.id]: false }));
      setShowSavedStates(prev => ({ ...prev, [location.id]: true }));

      // Hide the "saved" indicator after 2 seconds
      setTimeout(() => {
        setShowSavedStates(prev => ({ ...prev, [location.id]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to save location:', error);
    } finally {
      setSavingStates(prev => ({ ...prev, [location.id]: false }));
    }
  };

  // Save all dirty locations
  const handleSaveAll = async () => {
    const dirtyIds = Object.keys(dirty).filter(id => dirty[id]);
    if (dirtyIds.length === 0) return;

    // Set all dirty locations to saving state
    setSavingStates(prev => {
      const newStates = { ...prev };
      dirtyIds.forEach(id => { newStates[id] = true; });
      return newStates;
    });

    try {
      if (onBatchUpdateLocations) {
        // Use the batch update method - this prevents race conditions
        const updatedLocations = (locations || []).map(location =>
          dirty[location.id] ? { ...location, notes: drafts[location.id] } : location
        );

        await onBatchUpdateLocations(updatedLocations);
      } else {
        // Fallback to sequential individual updates with delays
        for (let i = 0; i < dirtyIds.length; i++) {
          const id = dirtyIds[i];
          const locationInfo = locationMap[id];
          if (locationInfo && drafts[id] !== undefined) {
            await onUpdateLocation(locationInfo.index, {
              ...locationInfo.location,
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
      console.error('Failed to save locations:', error);
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

  // Count dirty locations for UI
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

  const handleAddLocation = () => {
    if (!newLocationName.trim()) return;
    onAddLocation({ name: newLocationName.trim(), notes: '', tags: [] });
    setNewLocationName('');
  };

  return (
    <div className="space-y-6">
      <div className="p-4 sm:p-6 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <MapPinIcon size={20} className="text-purple-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Locations ({(locations || []).length})</h4>
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
              text="Use AI to automatically find and extract locations mentioned in your selected text"
              id="locations-ai-generate"
            >
              <Button
                onClick={onGenerateLocations}
                isLoading={isGenerating}
                variant="primary"
                className="w-full sm:w-auto"
              >
                <SparklesIcon size={16} />
                {isGenerating ? 'Generating...' : 'AI Generate'}
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Manual Add Location */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newLocationName}
            onChange={(e) => setNewLocationName(e.target.value)}
            placeholder="Location name..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
            onKeyPress={(e) => e.key === 'Enter' && handleAddLocation()}
          />
          <Tooltip
            text="Add a new location to your book"
            id="add-location-button"
          >
            <Button
              onClick={handleAddLocation}
              variant="primary"
              className="w-full sm:w-auto"
            >
              <PlusIcon size={16} />
              Add Location
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="space-y-4">
        {(locations || []).map((location, index) => (
          <BaseEntityCard
            key={location.id}
            entity={location}
            index={index}
            totalCount={(locations || []).length}
            config={cardConfig}
            displayValue={getDisplayValue(location)}
            isDirty={dirty[location.id] || false}
            isSaving={savingStates[location.id] || false}
            showSaved={showSavedStates[location.id] || false}
            onUpdateEntity={onUpdateLocation}
            onNotesChange={handleLocationNotesChange}
            onSave={handleSaveLocation}
            onCancel={(location) => {
              setDrafts(prev => {
                const { [location.id]: _, ...rest } = prev;
                return rest;
              });
              setDirty(prev => ({ ...prev, [location.id]: false }));
            }}
            onMove={onMoveLocation}
            onDelete={onDeleteLocation}
            editingName={editingName[location.id] || false}
            nameDraft={nameDrafts[location.id] ?? location.name}
            onStartNameEdit={() => {
              setNameDrafts(prev => ({ ...prev, [location.id]: location.name }));
              setEditingName(prev => ({ ...prev, [location.id]: true }));
            }}
            onNameChange={(name) => setNameDrafts(prev => ({ ...prev, [location.id]: name }))}
            onFinishNameEdit={(save) => {
              if (save) {
                const newName = nameDrafts[location.id];
                if (newName !== undefined && newName !== location.name) {
                  onUpdateLocation(index, { ...location, name: newName });
                }
              }
              setEditingName(prev => ({ ...prev, [location.id]: false }));
              setNameDrafts(prev => { const copy = { ...prev }; delete copy[location.id]; return copy; });
            }}
          />
        ))}

        {(locations || []).length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="mb-4 flex justify-center">
              <MapPinIcon size={64} strokeWidth={1} className="text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-700">No locations yet</p>
            <p className="text-sm text-gray-500">Add your first location above or use AI Generate</p>
          </div>
        )}
      </div>
    </div>
  );
};
