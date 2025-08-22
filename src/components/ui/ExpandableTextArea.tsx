import React from 'react';
import { ExpandableTextAreaProps } from '../../types/book';
import { Tooltip } from './Tooltip';

export const ExpandableTextArea: React.FC<ExpandableTextAreaProps> = ({
    value,
    onChange,
    placeholder,
    fieldId,
    label,
    isExpanded,
    onToggleExpand,
    rows = 4,
    expandedRows = 8
}) => {
    return (
        <div className="space-y-2">
            {label && (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-emerald-600 font-medium">{label}</span>
                    <Tooltip
                        text={isExpanded ? "Collapse notes area" : "Expand notes area for better writing"}
                        id={`expand-${fieldId}`}
                    >
                        <button
                            onClick={onToggleExpand}
                            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium hover:bg-emerald-50 px-2 py-1 rounded transition-all"
                        >
                            {isExpanded ? '📐 Collapse' : '📏 Expand'}
                        </button>
                    </Tooltip>
                </div>
            )}
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full p-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                placeholder={placeholder}
                rows={isExpanded ? expandedRows : rows}
            />
        </div>
    );
};
