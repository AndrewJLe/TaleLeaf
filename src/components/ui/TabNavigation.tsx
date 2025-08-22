import React from 'react';
import { TabType } from '../../types/book';
import { BookOpenIcon, MapPinIcon, NotebookIcon, UsersIcon } from './Icons';

interface TabNavigationProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

const tabs = [
    { id: 'characters' as TabType, label: 'Characters', icon: UsersIcon },
    { id: 'chapters' as TabType, label: 'Chapters', icon: BookOpenIcon },
    { id: 'locations' as TabType, label: 'Locations', icon: MapPinIcon },
    { id: 'notes' as TabType, label: 'Notes', icon: NotebookIcon }
];

export const TabNavigation: React.FC<TabNavigationProps> = ({
    activeTab,
    onTabChange
}) => {
    return (
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
                            onClick={() => onTabChange(tab.id)}
                        >
                            <Icon size={16} strokeWidth={2} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
