import React from 'react';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ResizableTextArea } from '../ui/ResizableTextArea';

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
        <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <h4 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                    📓 General Notes
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
                        📝 {isGenerating ? 'Generating...' : 'AI Generate'}
                    </Button>
                </Tooltip>
            </div>

            <div className="p-4 bg-white border border-emerald-200 rounded-lg shadow-sm">
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
