import React, { useState } from 'react';
import { Location } from '../../types/book';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { MapPinIcon, SparklesIcon, PlusIcon, TrashIcon } from '../ui/Icons';

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

                                <div className="space-y-2">
                                    <label className="text-sm text-gray-600 font-medium">Location Description</label>
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