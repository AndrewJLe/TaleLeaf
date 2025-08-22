import { useState, useCallback } from 'react';
import { AIGenerationState } from '../types/book';

export const useAIGeneration = () => {
    const [aiGenerationState, setAiGenerationState] = useState<AIGenerationState>({
        characters: false,
        chapters: false,
        locations: false,
        notes: false
    });

    const [isAILoading, setIsAILoading] = useState(false);

    const setGenerationLoading = useCallback((type: keyof AIGenerationState, loading: boolean) => {
        setAiGenerationState(prev => ({
            ...prev,
            [type]: loading
        }));
    }, []);

    const isAnyGenerating = useCallback(() => {
        return Object.values(aiGenerationState).some(Boolean);
    }, [aiGenerationState]);

    return {
        aiGenerationState,
        isAILoading,
        setIsAILoading,
        setGenerationLoading,
        isAnyGenerating
    };
};
