import React from 'react';
import { TabType } from '../../types/book';

interface TabNavigationProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

const tabs = [
    { id: 'characters' as TabType, label: '👥 Characters' },
    { id: 'chapters' as TabType, label: '📚 Chapters' },
    { id: 'locations' as TabType, label: '🗺️ Locations' },
    { id: 'notes' as TabType, label: '📓 Notes' }
];

export const TabNavigation: React.FC<TabNavigationProps> = ({
    activeTab,
    onTabChange
}) => {
    return (
        <nav className="mb-6">
            <div className="flex gap-2 p-1 bg-emerald-100/50 rounded-lg">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`px-4 py-2.5 rounded-md font-medium transition-all duration-200 transform ${activeTab === tab.id
                                ? 'bg-emerald-600 text-white shadow-md scale-105'
                                : 'text-emerald-700 hover:bg-emerald-200/50 hover:scale-102'
                            }`}
                        onClick={() => onTabChange(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </nav>
    );
};
