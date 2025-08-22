import React, { useState } from 'react';
import { Location } from '../../types/book';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ResizableTextArea } from '../ui/ResizableTextArea';

interface LocationsSectionProps {
    locations: Location[];
    onAddLocation: (location: Location) => void;
    onUpdateLocation: (index: number, location: Location) => void;
    onDeleteLocation: (index: number) => void;
    onGenerateLocations: () => void;
    isGenerating: boolean;
}

export const LocationsSection: React.FC<LocationsSectionProps> = ({
    locations,
    onAddLocation,
    onUpdateLocation,
    onDeleteLocation,
    onGenerateLocations,
    isGenerating
}) => {
    const [newLocationName, setNewLocationName] = useState('');

    const handleAddLocation = () => {
        if (!newLocationName.trim()) return;
        onAddLocation({ name: newLocationName.trim(), notes: '' });
        setNewLocationName('');
    };

    return (
        <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                        🗺️ Locations ({locations.length})
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
                            🗺️ {isGenerating ? 'Generating...' : 'AI Generate'}
                        </Button>
                    </Tooltip>
                </div>

                {/* Manual Add Location */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        placeholder="Location name..."
                        className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddLocation()}
                    />
                    <Tooltip
                        text="Add a new location to your book"
                        id="add-location-button"
                    >
                        <Button onClick={handleAddLocation} variant="primary">
                            ✨ Add Location
                        </Button>
                    </Tooltip>
                </div>
            </div>

            <div className="space-y-3">
                {locations.map((location, index) => (
                    <div key={index} className="p-4 bg-white border border-emerald-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <span className="text-emerald-600 text-xl">🗺️</span>
                            </div>
                            <div className="flex-1 space-y-3">
                                <div className="flex justify-between items-center">
                                    <input
                                        type="text"
                                        value={location.name}
                                        onChange={(e) => onUpdateLocation(index, { ...location, name: e.target.value })}
                                        className="font-semibold text-amber-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-2 -mx-2"
                                        placeholder="Location name"
                                    />
                                    <Tooltip
                                        text="Remove this location from your list"
                                        id={`delete-location-${index}`}
                                    >
                                        <Button
                                            onClick={() => onDeleteLocation(index)}
                                            variant="danger"
                                            size="sm"
                                        >
                                            🗑️ Delete
                                        </Button>
                                    </Tooltip>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-emerald-600 font-medium">Location Description</label>
                                    <ResizableTextArea
                                        value={location.notes}
                                        onChange={(notes) => onUpdateLocation(index, { ...location, notes })}
                                        placeholder="Describe this location, its significance, atmosphere..."
                                        minRows={3}
                                        maxRows={15}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {locations.length === 0 && (
                    <div className="text-center py-12 text-emerald-600">
                        <div className="text-6xl mb-4">🗺️</div>
                        <p className="text-lg font-medium">No locations yet</p>
                        <p className="text-sm opacity-75">Add your first location above or use AI Generate</p>
                    </div>
                )}
            </div>
        </div>
    );
};