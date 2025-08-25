import React, { useState } from 'react';
import { TabType } from '../../types/book';
import { BookOpenIcon, MapPinIcon, NotebookIcon, UsersIcon } from './Icons';
import { UnsavedChangesModal } from './UnsavedChangesModal';

interface TabNavigationProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    // Unsaved changes per tab
    unsavedChanges?: {
        characters?: { hasChanges: boolean; count: number };
        chapters?: { hasChanges: boolean; count: number };
        locations?: { hasChanges: boolean; count: number };
        notes?: { hasChanges: boolean; count: number };
    };
    // Save/discard functions per tab
    onSaveChanges?: (tab: TabType) => Promise<void>;
    onDiscardChanges?: (tab: TabType) => void;
}

const tabs = [
    { id: 'characters' as TabType, label: 'Characters', icon: UsersIcon },
    { id: 'chapters' as TabType, label: 'Chapters', icon: BookOpenIcon },
    { id: 'locations' as TabType, label: 'Locations', icon: MapPinIcon },
    { id: 'notes' as TabType, label: 'Notes', icon: NotebookIcon }
];

export const TabNavigation: React.FC<TabNavigationProps> = ({
    activeTab,
    onTabChange,
    unsavedChanges = {},
    onSaveChanges,
    onDiscardChanges
}) => {
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [pendingTab, setPendingTab] = useState<TabType | null>(null);

    const handleTabClick = (tabId: TabType) => {
        // Check if current tab has unsaved changes
        const currentTabUnsaved = unsavedChanges[activeTab];
        if (tabId !== activeTab && currentTabUnsaved?.hasChanges) {
            setPendingTab(tabId);
            setShowUnsavedModal(true);
        } else {
            onTabChange(tabId);
        }
    };

    const handleSaveAndContinue = async () => {
        if (onSaveChanges && pendingTab) {
            try {
                await onSaveChanges(activeTab); // Save current tab's changes
                setShowUnsavedModal(false);
                onTabChange(pendingTab);
                setPendingTab(null);
            } catch (error) {
                console.error('Failed to save changes:', error);
                // Keep modal open on error
            }
        }
    };

    const handleDiscardAndContinue = () => {
        if (onDiscardChanges && pendingTab) {
            onDiscardChanges(activeTab); // Discard current tab's changes
            setShowUnsavedModal(false);
            onTabChange(pendingTab);
            setPendingTab(null);
        }
    };

    const handleStay = () => {
        setShowUnsavedModal(false);
        setPendingTab(null);
    };

    // Get current tab's unsaved info for the modal
    const currentTabUnsaved = unsavedChanges[activeTab];
    const unsavedCount = currentTabUnsaved?.count || 0;
    return (
        <>
            <nav className="mb-6">
                <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-lg">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-medium transition-all duration-200 ${activeTab === tab.id
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                                onClick={() => handleTabClick(tab.id)}
                            >
                                <Icon size={16} strokeWidth={2} />
                                <span>{tab.label}</span>
                                {unsavedChanges[tab.id]?.hasChanges && (
                                    <span className="ml-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full">
                                        {unsavedChanges[tab.id]?.count || 0}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>

            <UnsavedChangesModal
                isOpen={showUnsavedModal}
                onSaveAndContinue={handleSaveAndContinue}
                onDiscardAndContinue={handleDiscardAndContinue}
                onStay={handleStay}
                unsavedCount={unsavedCount}
            />
        </>
    );
};
