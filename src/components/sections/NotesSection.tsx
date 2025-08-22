import React from 'react';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { NotebookIcon, SparklesIcon } from '../ui/Icons';

interface NotesSectionProps {
    notes: string;
    onUpdateNotes: (notes: string) => void;
    onGenerateNotes: () => void;
    isGenerating: boolean;
}

export const NotesSection: React.FC<NotesSectionProps> = ({
    notes,
    onUpdateNotes,
    onGenerateNotes,
    isGenerating
}) => {
    return (
        <div className="space-y-6">
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <NotebookIcon size={20} className="text-orange-600" />
                        </div>
                        General Notes
                    </h4>
                    <Tooltip
                        text="Use AI to generate insightful notes and analysis from your selected text"
                        id="notes-ai-generate"
                    >
                        <Button
                            onClick={onGenerateNotes}
                            isLoading={isGenerating}
                            variant="primary"
                        >
                            <SparklesIcon size={16} />
                            {isGenerating ? 'Generating...' : 'AI Generate'}
                        </Button>
                    </Tooltip>
                </div>
            </div>

            <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
                <ResizableTextArea
                    value={notes || ''}
                    onChange={onUpdateNotes}
                    placeholder="Write your notes here, or use AI Generate to create insights about your selected text..."
                    minRows={8}
                    maxRows={20}
                />
            </div>
        </div>
    );
};
