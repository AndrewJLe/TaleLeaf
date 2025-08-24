import React, { useEffect, useState } from 'react';
import { Location } from '../../types/book';
import { Button } from '../ui/Button';
import { ChevronDownIcon, ChevronUpIcon, MapPinIcon, PlusIcon, SaveIcon, SparklesIcon, TrashIcon } from '../ui/Icons';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { SaveStateIndicator } from '../ui/SaveStateIndicator';
import { SaveStatus } from '../ui/SaveStatus';
import { Tooltip } from '../ui/Tooltip';

interface LocationsSectionProps {
    locations: Location[];
    onAddLocation: (location: Omit<Location, 'id'>) => void;
    onUpdateLocation: (index: number, location: Location) => void;
    onDeleteLocation: (index: number) => void;
    onMoveLocation: (index: number, direction: 'up' | 'down') => void;
    onGenerateLocations: () => void;
    isGenerating: boolean;
    isSaving?: boolean;
    lastSaved?: Date | null;
    saveError?: string | null;
}

export const LocationsSection: React.FC<LocationsSectionProps> = ({
    locations,
    onAddLocation,
    onUpdateLocation,
    onDeleteLocation,
    onMoveLocation,
    onGenerateLocations,
    isGenerating,
    isSaving = false,
    lastSaved = null,
    saveError = null
}) => {
    const [newLocationName, setNewLocationName] = useState('');

    // ID-based draft tracking
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [dirty, setDirty] = useState<Record<string, boolean>>({});
    const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
    const [showSavedStates, setShowSavedStates] = useState<Record<string, boolean>>({});

    // Create location lookup map for easy access
    const locationMap = React.useMemo(() => {
        return locations.reduce((acc, location, index) => {
            acc[location.id] = { location, index };
            return acc;
        }, {} as Record<string, { location: Location; index: number }>);
    }, [locations]);

    // Clean up drafts when locations are removed
    useEffect(() => {
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

        // Save them sequentially for better UX feedback
        for (const id of dirtyIds) {
            const locationInfo = locationMap[id];
            if (locationInfo) {
                await handleSaveLocation(locationInfo.location);
            }
        }
    };

    // Count dirty locations for UI
    const dirtyCount = Object.values(dirty).filter(Boolean).length;

    const handleAddLocation = () => {
        if (!newLocationName.trim()) return;
        onAddLocation({ name: newLocationName.trim(), notes: '' });
        setNewLocationName('');
    };

    return (
        <div className="space-y-6">
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <MapPinIcon size={20} className="text-purple-600" />
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900">Locations ({locations.length})</h4>
                            <SaveStatus isSaving={isSaving} lastSaved={lastSaved} error={saveError} className="mt-0.5" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {dirtyCount > 0 && (
                            <Button
                                onClick={handleSaveAll}
                                variant="secondary"
                                size="sm"
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                                <SaveIcon size={14} />
                                Save All ({dirtyCount})
                            </Button>
                        )}
                        <Tooltip
                            text="Use AI to automatically find and extract locations mentioned in your selected text"
                            id="locations-ai-generate"
                        >
                            <Button
                                onClick={onGenerateLocations}
                                isLoading={isGenerating}
                                variant="primary"
                            >
                                <SparklesIcon size={16} />
                                {isGenerating ? 'Generating...' : 'AI Generate'}
                            </Button>
                        </Tooltip>
                    </div>
                </div>

                {/* Manual Add Location */}
                <div className="flex gap-3">
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
                        <Button onClick={handleAddLocation} variant="primary">
                            <PlusIcon size={16} />
                            Add Location
                        </Button>
                    </Tooltip>
                </div>
            </div>

            <div className="space-y-4">
                {locations.map((location, index) => (
                    <div key={location.id} className="p-4 sm:p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="space-y-4">
                            {/* Title Row */}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center relative flex-shrink-0">
                                    <MapPinIcon size={18} className="text-purple-600" />
                                    {dirty[location.id] && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white"></div>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={location.name}
                                    onChange={(e) => onUpdateLocation(index, { ...location, name: e.target.value })}
                                    className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg px-3 py-1 -mx-3 flex-1 min-w-0"
                                    placeholder="Location name"
                                />
                            </div>

                            {/* Actions Row - Responsive Layout */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                                {/* Primary Actions - Save and Status */}
                                <div className="flex items-center gap-2 order-2 sm:order-1">
                                    <SaveStateIndicator
                                        isSaving={savingStates[location.id] || false}
                                        hasUnsavedChanges={dirty[location.id] || false}
                                        showSaved={showSavedStates[location.id] || false}
                                    />
                                    <button
                                        onClick={() => handleSaveLocation(location)}
                                        disabled={savingStates[location.id] || !dirty[location.id]}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center gap-2 ${savingStates[location.id]
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : dirty[location.id]
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                                                : 'bg-emerald-100 text-emerald-700 cursor-default'
                                            }`}
                                        title="Ctrl+Enter to save"
                                    >
                                        <SaveIcon size={14} />
                                        <span className="hidden sm:inline">
                                            {savingStates[location.id] ? 'Saving...' : 'Save'}
                                        </span>
                                    </button>
                                </div>

                                {/* Secondary Actions - Navigation and Tools */}
                                <div className="flex items-center gap-2 order-1 sm:order-2">
                                    <div className="flex items-center gap-1">
                                        <Tooltip
                                            text="Move this location up in the order"
                                            id={`location-up-${location.id}`}
                                        >
                                            <Button
                                                onClick={() => onMoveLocation(index, 'up')}
                                                variant="ghost"
                                                size="sm"
                                                disabled={index === 0}
                                            >
                                                <ChevronUpIcon size={14} />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip
                                            text="Move this location down in the order"
                                            id={`location-down-${location.id}`}
                                        >
                                            <Button
                                                onClick={() => onMoveLocation(index, 'down')}
                                                variant="ghost"
                                                size="sm"
                                                disabled={index === locations.length - 1}
                                            >
                                                <ChevronDownIcon size={14} />
                                            </Button>
                                        </Tooltip>
                                    </div>

                                    <div className="w-px h-6 bg-gray-200"></div>

                                    <Tooltip
                                        text="Remove this location from your list"
                                        id={`delete-location-${location.id}`}
                                    >
                                        <Button
                                            onClick={() => onDeleteLocation(index)}
                                            variant="danger"
                                            size="sm"
                                        >
                                            <TrashIcon size={14} />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm text-gray-600 font-medium">Location Description</label>
                                <ResizableTextArea
                                    value={getDisplayValue(location)}
                                    onChange={(notes) => handleLocationNotesChange(location, notes)}
                                    onSave={() => handleSaveLocation(location)}
                                    placeholder="Describe this location, its significance, atmosphere..."
                                    minRows={3}
                                    maxRows={15}
                                />
                                {dirty[location.id] && (
                                    <p className="text-xs text-gray-500">
                                        Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Enter</kbd> or click Save to save your changes
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {locations.length === 0 && (
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
