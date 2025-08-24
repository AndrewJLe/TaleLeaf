import React, { useEffect, useState } from 'react';
import { Location } from '../../types/book';
import { Button } from '../ui/Button';
import { ChevronDownIcon, ChevronUpIcon, MapPinIcon, PlusIcon, SaveIcon, SparklesIcon, TrashIcon } from '../ui/Icons';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { SaveStateIndicator } from '../ui/SaveStateIndicator';
import { Tooltip } from '../ui/Tooltip';

interface LocationsSectionProps {
    locations: Location[];
    onAddLocation: (location: Location) => void;
    onUpdateLocation: (index: number, location: Location) => void;
    onDeleteLocation: (index: number) => void;
    onMoveLocation: (index: number, direction: 'up' | 'down') => void;
    onGenerateLocations: () => void;
    isGenerating: boolean;
}

export const LocationsSection: React.FC<LocationsSectionProps> = ({
    locations,
    onAddLocation,
    onUpdateLocation,
    onDeleteLocation,
    onMoveLocation,
    onGenerateLocations,
    isGenerating
}) => {
    const [newLocationName, setNewLocationName] = useState('');
    const [localLocations, setLocalLocations] = useState<Location[]>(locations);
    const [savingStates, setSavingStates] = useState<{ [key: number]: boolean }>({});
    const [unsavedChanges, setUnsavedChanges] = useState<{ [key: number]: boolean }>({});
    const [showSavedStates, setShowSavedStates] = useState<{ [key: number]: boolean }>({});

    // Sync with prop changes
    useEffect(() => {
        setLocalLocations(locations);
        setUnsavedChanges({});
        setShowSavedStates({});
    }, [locations]);

    // Track changes for individual locations
    const handleLocationNotesChange = (index: number, notes: string) => {
        const updatedLocations = [...localLocations];
        updatedLocations[index] = { ...updatedLocations[index], notes };
        setLocalLocations(updatedLocations);

        setUnsavedChanges(prev => ({
            ...prev,
            [index]: notes !== locations[index]?.notes
        }));
    };

    // Save individual location
    const handleSaveLocation = async (index: number) => {
        if (!unsavedChanges[index]) return;

        setSavingStates(prev => ({ ...prev, [index]: true }));
        setShowSavedStates(prev => ({ ...prev, [index]: false }));
        try {
            // Ensure minimum 800ms for better UX perception
            await Promise.all([
                onUpdateLocation(index, localLocations[index]),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);

            setUnsavedChanges(prev => ({ ...prev, [index]: false }));
            setShowSavedStates(prev => ({ ...prev, [index]: true }));

            // Hide the "saved" indicator after 2 seconds
            setTimeout(() => {
                setShowSavedStates(prev => ({ ...prev, [index]: false }));
            }, 2000);
        } catch (error) {
            console.error('Failed to save location:', error);
        } finally {
            setSavingStates(prev => ({ ...prev, [index]: false }));
        }
    };

    const handleAddLocation = () => {
        if (!newLocationName.trim()) return;
        onAddLocation({ name: newLocationName.trim(), notes: '' });
        setNewLocationName('');
    };

    return (
        <div className="space-y-6">
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <MapPinIcon size={20} className="text-purple-600" />
                        </div>
                        Locations ({locations.length})
                    </h4>
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
                    <div key={index} className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                                <MapPinIcon size={24} className="text-purple-600" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <div className="flex justify-between items-center">
                                    <input
                                        type="text"
                                        value={location.name}
                                        onChange={(e) => onUpdateLocation(index, { ...location, name: e.target.value })}
                                        className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg px-3 py-1 -mx-3"
                                        placeholder="Location name"
                                    />
                                    <div className="flex items-center gap-2">
                                        <SaveStateIndicator
                                            isSaving={savingStates[index] || false}
                                            hasUnsavedChanges={unsavedChanges[index] || false}
                                            showSaved={showSavedStates[index] || false}
                                        />
                                        <Tooltip
                                            text="Move this location up in the order"
                                            id={`location-up-${index}`}
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
                                            id={`location-down-${index}`}
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
                                        <button
                                            onClick={() => handleSaveLocation(index)}
                                            disabled={savingStates[index] || !unsavedChanges[index]}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center gap-2 ${savingStates[index]
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : unsavedChanges[index]
                                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                                                    : 'bg-emerald-100 text-emerald-700 cursor-default'
                                                }`}
                                            title="Ctrl+Enter to save"
                                        >
                                            <SaveIcon size={14} />
                                            {savingStates[index] ? 'Saving...' : 'Save'}
                                        </button>
                                        <Tooltip
                                            text="Remove this location from your list"
                                            id={`delete-location-${index}`}
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
                                        value={localLocations[index]?.notes || ''}
                                        onChange={(notes) => handleLocationNotesChange(index, notes)}
                                        onSave={() => handleSaveLocation(index)}
                                        placeholder="Describe this location, its significance, atmosphere..."
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