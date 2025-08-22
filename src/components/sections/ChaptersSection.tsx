import React, { useState } from 'react';
import { Chapter } from '../../types/book';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { BookOpenIcon, SparklesIcon, PlusIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon } from '../ui/Icons';

interface ChaptersSectionProps {
    chapters: Chapter[];
    onAddChapter: (chapter: Chapter) => void;
    onUpdateChapter: (index: number, chapter: Chapter) => void;
    onDeleteChapter: (index: number) => void;
    onMoveChapter: (index: number, direction: 'up' | 'down') => void;
    onGenerateSummary: (index: number) => void;
    isGenerating: boolean;
}

export const ChaptersSection: React.FC<ChaptersSectionProps> = ({
    chapters,
    onAddChapter,
    onUpdateChapter,
    onDeleteChapter,
    onMoveChapter,
    onGenerateSummary,
    isGenerating
}) => {
    const [newChapterName, setNewChapterName] = useState('');

    const handleAddChapter = () => {
        if (!newChapterName.trim()) return;
        onAddChapter({ name: newChapterName.trim(), notes: '' });
        setNewChapterName('');
    };

    return (
        <div className="space-y-6">
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <BookOpenIcon size={20} className="text-green-600" />
                        </div>
                        Chapters ({chapters.length})
                    </h4>
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
                    <div key={index} className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                                <BookOpenIcon size={24} className="text-green-600" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <div className="flex justify-between items-center">
                                    <input
                                        type="text"
                                        value={chapter.name}
                                        onChange={(e) => onUpdateChapter(index, { ...chapter, name: e.target.value })}
                                        className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg px-3 py-1 -mx-3"
                                        placeholder="Chapter title"
                                    />
                                    <div className="flex items-center gap-2">
                                        <Tooltip
                                            text="Generate an AI-powered summary of this chapter from your selected text"
                                            id={`chapter-summary-${index}`}
                                        >
                                            <Button
                                                onClick={() => onGenerateSummary(index)}
                                                variant="ghost"
                                                size="sm"
                                                isLoading={isGenerating}
                                            >
                                                <SparklesIcon size={14} />
                                                Summary
                                            </Button>
                                        </Tooltip>
                                        <Tooltip
                                            text="Move this chapter up in the order"
                                            id={`chapter-up-${index}`}
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
                                            id={`chapter-down-${index}`}
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
                                        <Tooltip
                                            text="Remove this chapter from your list"
                                            id={`delete-chapter-${index}`}
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

                                <div className="space-y-2">
                                    <label className="text-sm text-gray-600 font-medium">Chapter Notes</label>
                                    <ResizableTextArea
                                        value={chapter.notes}
                                        onChange={(notes) => onUpdateChapter(index, { ...chapter, notes })}
                                        placeholder="Chapter summary and notes..."
                                        minRows={3}
                                        maxRows={15}
                                    />
                                </div>
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
