import React, { useEffect, useState } from 'react';
import { Chapter } from '../../types/book';
import { Button } from '../ui/Button';
import { BookOpenIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon, SaveIcon, SparklesIcon, TrashIcon } from '../ui/Icons';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { SaveStateIndicator } from '../ui/SaveStateIndicator';
import { SaveStatus } from '../ui/SaveStatus';
import { Tooltip } from '../ui/Tooltip';

interface ChaptersSectionProps {
    chapters: Chapter[];
    onAddChapter: (chapter: Omit<Chapter, 'id'>) => void;
    onUpdateChapter: (index: number, chapter: Chapter) => void;
    onDeleteChapter: (index: number) => void;
    onMoveChapter: (index: number, direction: 'up' | 'down') => void;
    onGenerateSummary: (index: number) => void;
    isGenerating: boolean;
    isSaving?: boolean;
    lastSaved?: Date | null;
    saveError?: string | null;
}

export const ChaptersSection: React.FC<ChaptersSectionProps> = ({
    chapters,
    onAddChapter,
    onUpdateChapter,
    onDeleteChapter,
    onMoveChapter,
    onGenerateSummary,
    isGenerating,
    isSaving = false,
    lastSaved = null,
    saveError = null
}) => {
    const [newChapterName, setNewChapterName] = useState('');

    // ID-based draft tracking
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [dirty, setDirty] = useState<Record<string, boolean>>({});
    const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
    const [showSavedStates, setShowSavedStates] = useState<Record<string, boolean>>({});

    // Create chapter lookup map for easy access
    const chapterMap = React.useMemo(() => {
        return chapters.reduce((acc, chapter, index) => {
            acc[chapter.id] = { chapter, index };
            return acc;
        }, {} as Record<string, { chapter: Chapter; index: number }>);
    }, [chapters]);

    // Clean up drafts when chapters are removed
    useEffect(() => {
        const currentIds = new Set(chapters.map(c => c.id));
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
    }, [chapters]);

    // Get display value (draft or persisted)
    const getDisplayValue = (chapter: Chapter): string => {
        return drafts[chapter.id] ?? chapter.notes;
    };

    // Track changes for individual chapters
    const handleChapterNotesChange = (chapter: Chapter, notes: string) => {
        setDrafts(prev => ({ ...prev, [chapter.id]: notes }));
        setDirty(prev => ({
            ...prev,
            [chapter.id]: notes !== chapter.notes
        }));
    };

    // Save individual chapter
    const handleSaveChapter = async (chapter: Chapter) => {
        if (!dirty[chapter.id]) return;

        const chapterInfo = chapterMap[chapter.id];
        if (!chapterInfo) return;

        setSavingStates(prev => ({ ...prev, [chapter.id]: true }));
        setShowSavedStates(prev => ({ ...prev, [chapter.id]: false }));

        try {
            // Ensure minimum 800ms for better UX perception
            await Promise.all([
                onUpdateChapter(chapterInfo.index, {
                    ...chapter,
                    notes: drafts[chapter.id]
                }),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);

            // Clear draft and mark as clean
            setDrafts(prev => {
                const { [chapter.id]: _, ...rest } = prev;
                return rest;
            });
            setDirty(prev => ({ ...prev, [chapter.id]: false }));
            setShowSavedStates(prev => ({ ...prev, [chapter.id]: true }));

            // Hide the "saved" indicator after 2 seconds
            setTimeout(() => {
                setShowSavedStates(prev => ({ ...prev, [chapter.id]: false }));
            }, 2000);
        } catch (error) {
            console.error('Failed to save chapter:', error);
        } finally {
            setSavingStates(prev => ({ ...prev, [chapter.id]: false }));
        }
    };

    // Save all dirty chapters
    const handleSaveAll = async () => {
        const dirtyIds = Object.keys(dirty).filter(id => dirty[id]);
        if (dirtyIds.length === 0) return;

        // Save them sequentially for better UX feedback
        for (const id of dirtyIds) {
            const chapterInfo = chapterMap[id];
            if (chapterInfo) {
                await handleSaveChapter(chapterInfo.chapter);
            }
        }
    };

    // Count dirty chapters for UI
    const dirtyCount = Object.values(dirty).filter(Boolean).length;

    const handleAddChapter = () => {
        if (!newChapterName.trim()) return;
        onAddChapter({ name: newChapterName.trim(), notes: '' });
        setNewChapterName('');
    };

    return (
        <div className="space-y-6">
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <BookOpenIcon size={20} className="text-green-600" />
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900">Chapters ({chapters.length})</h4>
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
                    </div>
                </div>

                {/* Manual Add Chapter */}
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={newChapterName}
                        onChange={(e) => setNewChapterName(e.target.value)}
                        placeholder="Chapter title..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddChapter()}
                    />
                    <Tooltip
                        text="Add a new chapter to your book structure"
                        id="add-chapter-button"
                    >
                        <Button onClick={handleAddChapter} variant="primary">
                            <PlusIcon size={16} />
                            Add Chapter
                        </Button>
                    </Tooltip>
                </div>
            </div>

            <div className="space-y-4">
                {chapters.map((chapter, index) => (
                    <div key={chapter.id} className="p-4 sm:p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="space-y-4">
                            {/* Title Row with Chapter-level Actions */}
                            <div className="flex items-center gap-3 justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center relative flex-shrink-0">
                                        <BookOpenIcon size={18} className="text-green-600" />
                                        {dirty[chapter.id] && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white"></div>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={chapter.name}
                                        onChange={(e) => onUpdateChapter(index, { ...chapter, name: e.target.value })}
                                        className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg px-3 py-1 -mx-3 flex-1 min-w-0"
                                        placeholder="Chapter title"
                                    />
                                </div>

                                {/* Chapter-level Actions */}
                                <Tooltip
                                    text="Generate an AI-powered summary of this chapter from your selected text"
                                    id={`chapter-summary-${chapter.id}`}
                                >
                                    <Button
                                        onClick={() => onGenerateSummary(index)}
                                        variant="ghost"
                                        size="sm"
                                        isLoading={isGenerating}
                                    >
                                        <SparklesIcon size={14} />
                                        <span className="hidden sm:inline">Summary</span>
                                    </Button>
                                </Tooltip>
                            </div>

                            {/* Actions Row - Responsive Layout */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                                {/* Primary Actions - Save and Status */}
                                <div className="flex items-center gap-2 order-2 sm:order-1">
                                    <button
                                        onClick={() => handleSaveChapter(chapter)}
                                        disabled={savingStates[chapter.id] || !dirty[chapter.id]}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center gap-2 ${savingStates[chapter.id]
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : dirty[chapter.id]
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                                                : 'bg-emerald-100 text-emerald-700 cursor-default'
                                            }`}
                                        title="Ctrl+Enter to save"
                                    >
                                        <SaveIcon size={14} />
                                        <span className="hidden sm:inline">
                                            {savingStates[chapter.id] ? 'Saving...' : 'Save'}
                                        </span>
                                    </button>
                                    <SaveStateIndicator
                                        isSaving={savingStates[chapter.id] || false}
                                        hasUnsavedChanges={dirty[chapter.id] || false}
                                        showSaved={showSavedStates[chapter.id] || false}
                                    />
                                </div>

                                {/* Secondary Actions - Navigation and Delete Only */}
                                <div className="flex items-center gap-2 order-1 sm:order-2">
                                    <div className="flex items-center gap-1">
                                        <Tooltip
                                            text="Move this chapter up in the order"
                                            id={`chapter-up-${chapter.id}`}
                                        >
                                            <Button
                                                onClick={() => onMoveChapter(index, 'up')}
                                                variant="ghost"
                                                size="sm"
                                                disabled={index === 0}
                                            >
                                                <ChevronUpIcon size={14} />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip
                                            text="Move this chapter down in the order"
                                            id={`chapter-down-${chapter.id}`}
                                        >
                                            <Button
                                                onClick={() => onMoveChapter(index, 'down')}
                                                variant="ghost"
                                                size="sm"
                                                disabled={index === chapters.length - 1}
                                            >
                                                <ChevronDownIcon size={14} />
                                            </Button>
                                        </Tooltip>
                                    </div>

                                    <div className="w-px h-6 bg-gray-200"></div>

                                    <Tooltip
                                        text="Remove this chapter from your list"
                                        id={`delete-chapter-${chapter.id}`}
                                    >
                                        <Button
                                            onClick={() => onDeleteChapter(index)}
                                            variant="danger"
                                            size="sm"
                                        >
                                            <TrashIcon size={14} />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm text-gray-600 font-medium">Chapter Notes</label>
                                <ResizableTextArea
                                    value={getDisplayValue(chapter)}
                                    onChange={(notes) => handleChapterNotesChange(chapter, notes)}
                                    onSave={() => handleSaveChapter(chapter)}
                                    placeholder="Chapter summary and notes..."
                                    minRows={3}
                                    maxRows={15}
                                />
                                {dirty[chapter.id] && (
                                    <p className="text-xs text-gray-500">
                                        Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Enter</kbd> or click Save to save your changes
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {chapters.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <div className="mb-4 flex justify-center">
                            <BookOpenIcon size={64} strokeWidth={1} className="text-gray-300" />
                        </div>
                        <p className="text-lg font-medium text-gray-700">No chapters yet</p>
                        <p className="text-sm text-gray-500">Add your first chapter above</p>
                    </div>
                )}
            </div>
        </div>
    );
};
