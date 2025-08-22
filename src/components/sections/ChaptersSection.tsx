import React, { useState } from 'react';
import { Chapter } from '../../types/book';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ResizableTextArea } from '../ui/ResizableTextArea';

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
        <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <h4 className="text-lg font-semibold text-emerald-800 flex items-center gap-2 mb-4">
                    📚 Chapters ({chapters.length})
                </h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newChapterName}
                        onChange={(e) => setNewChapterName(e.target.value)}
                        placeholder="Chapter name..."
                        className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddChapter()}
                    />
                    <Tooltip
                        text="Add a new chapter to your book structure"
                        id="add-chapter-button"
                    >
                        <Button onClick={handleAddChapter} variant="primary">
                            ✨ Add Chapter
                        </Button>
                    </Tooltip>
                </div>
            </div>

            <div className="space-y-3">
                {chapters.map((chapter, index) => (
                    <div key={index} className="p-4 bg-white border border-emerald-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <input
                                type="text"
                                value={chapter.name}
                                onChange={(e) => onUpdateChapter(index, { ...chapter, name: e.target.value })}
                                className="font-semibold text-amber-900 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-2 -mx-2"
                                placeholder="Chapter name"
                            />
                            <div className="flex gap-2">
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
                                        🤖 AI Summary
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
                                        ⬆️
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
                                        ⬇️
                                    </Button>
                                </Tooltip>
                                <Tooltip
                                    text="Delete this chapter permanently"
                                    id={`chapter-delete-${index}`}
                                >
                                    <Button
                                        onClick={() => onDeleteChapter(index)}
                                        variant="danger"
                                        size="sm"
                                    >
                                        🗑️
                                    </Button>
                                </Tooltip>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-emerald-600 font-medium">Chapter Notes</label>
                            <ResizableTextArea
                                value={chapter.notes}
                                onChange={(notes) => onUpdateChapter(index, { ...chapter, notes })}
                                placeholder="Chapter summary and notes..."
                                minRows={3}
                                maxRows={15}
                            />
                        </div>
                    </div>
                ))}

                {chapters.length === 0 && (
                    <div className="text-center py-12 text-emerald-600">
                        <div className="text-6xl mb-4">📚</div>
                        <p className="text-lg font-medium">No chapters yet</p>
                        <p className="text-sm opacity-75">Add your first chapter above</p>
                    </div>
                )}
            </div>
        </div>
    );
};
