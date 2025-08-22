import { useState, useCallback } from 'react';
import { ExpandedFieldsState } from '../types/book';

export const useExpandableFields = () => {
    const [expandedFields, setExpandedFields] = useState<ExpandedFieldsState>({});

    const toggleExpanded = useCallback((fieldId: string) => {
        setExpandedFields(prev => ({
            ...prev,
            [fieldId]: !prev[fieldId]
        }));
    }, []);

    const isExpanded = useCallback((fieldId: string) => {
        return expandedFields[fieldId] || false;
    }, [expandedFields]);

    const setExpanded = useCallback((fieldId: string, expanded: boolean) => {
        setExpandedFields(prev => ({
            ...prev,
            [fieldId]: expanded
        }));
    }, []);

    return {
        expandedFields,
        toggleExpanded,
        isExpanded,
        setExpanded
    };
};
