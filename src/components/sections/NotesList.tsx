import React, { useState } from 'react';
import { BookNote } from '../../types/book';
import { Button } from '../ui/Button';
import { ResizableTextArea } from '../ui/ResizableTextArea';
import { NotebookIcon, PlusIcon, TrashIcon, TagIcon, EyeOffIcon, EyeIcon } from '../ui/Icons';
import { Tooltip } from '../ui/Tooltip';

interface NotesListProps {
  notes: BookNote[];
  currentWindowEnd: number;
  onAddNote: (note: Omit<BookNote, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateNote: (id: string, updates: Partial<BookNote>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onReorderNotes: (noteIds: string[]) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes,
  currentWindowEnd,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onReorderNotes,
  isLoading,
  error
}) => {
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const toggleNoteExpansion = (noteId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const handleAddNote = async () => {
    const noteCount = notes.length;
    await onAddNote({
      bookId: notes[0]?.bookId || '', // Will be set by parent
      title: `Note ${noteCount + 1}`,
      body: '',
      tags: [],
      position: noteCount * 1000,
      spoilerProtected: false,
      minVisiblePage: undefined
    });
  };

  const handleUpdateTags = async (noteId: string, tagsText: string) => {
    // Parse comma-separated tags, clean up whitespace, dedupe case-insensitive
    const tags = tagsText
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .filter((tag, index, arr) => 
        arr.findIndex(t => t.toLowerCase() === tag.toLowerCase()) === index
      );
    
    await onUpdateNote(noteId, { tags });
  };

  const isNoteVisible = (note: BookNote): boolean => {
    if (!note.spoilerProtected) return true;
    if (!note.minVisiblePage) return true;
    return currentWindowEnd >= note.minVisiblePage;
  };

  const renderSpoilerPlaceholder = (note: BookNote) => (
    <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
      <div className="flex items-center justify-center gap-2 text-gray-500 mb-2">
        <EyeOffIcon size={20} />
        <span className="font-medium">Spoiler Protected Note</span>
      </div>
      <p className="text-sm text-gray-400">
        This note will be visible after page {note.minVisiblePage}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Current window: 1-{currentWindowEnd}
      </p>
    </div>
  );

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-xl border border-red-200">
        <p className="text-red-700 font-medium">Error loading notes</p>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <NotebookIcon size={20} className="text-orange-600" />
            </div>
            Notes ({notes.length})
          </h4>
          <Tooltip text="Add a new note" id="add-note-button">
            <Button
              onClick={handleAddNote}
              variant="primary"
              disabled={isLoading}
            >
              <PlusIcon size={16} />
              Add Note
            </Button>
          </Tooltip>
        </div>
        
        {notes.length === 0 && (
          <p className="text-gray-600 text-sm">
            Create your first note to organize your thoughts and insights.
          </p>
        )}
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        {notes.map((note) => {
          const isVisible = isNoteVisible(note);
          const isExpanded = expandedNotes.has(note.id);

          if (!isVisible) {
            return (
              <div key={note.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                {renderSpoilerPlaceholder(note)}
              </div>
            );
          }

          return (
            <div key={note.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
              <div className="p-6 space-y-4">
                {/* Note Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={note.title || ''}
                      onChange={(e) => onUpdateNote(note.id, { title: e.target.value })}
                      placeholder="Note title..."
                      className="font-semibold text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg px-3 py-1 -mx-3 w-full"
                    />
                    
                    {/* Tags */}
                    <div className="flex items-center gap-2">
                      <TagIcon size={16} className="text-gray-400" />
                      <input
                        type="text"
                        value={note.tags.join(', ')}
                        onChange={(e) => handleUpdateTags(note.id, e.target.value)}
                        placeholder="Tags (comma-separated)..."
                        className="text-sm text-gray-600 bg-transparent border border-gray-200 rounded-md px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-transparent flex-1"
                      />
                    </div>
                    
                    {/* Tag chips display */}
                    {note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {note.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {/* Spoiler Protection Toggle */}
                    <Tooltip 
                      text={note.spoilerProtected ? "Remove spoiler protection" : "Protect from spoilers"}
                      id={`spoiler-toggle-${note.id}`}
                    >
                      <Button
                        onClick={() => onUpdateNote(note.id, { spoilerProtected: !note.spoilerProtected })}
                        variant="secondary"
                        size="sm"
                        className={`p-2 ${note.spoilerProtected ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400'}`}
                      >
                        {note.spoilerProtected ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </Button>
                    </Tooltip>
                    
                    {/* Delete Button */}
                    <Tooltip text="Delete note" id={`delete-note-${note.id}`}>
                      <Button
                        onClick={() => onDeleteNote(note.id)}
                        variant="danger"
                        size="sm"
                        className="p-2"
                      >
                        <TrashIcon size={16} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                {/* Spoiler Protection Settings */}
                {note.spoilerProtected && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <EyeOffIcon size={16} className="text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">Spoiler Protection</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-yellow-700">Visible after page:</label>
                      <input
                        type="number"
                        value={note.minVisiblePage || ''}
                        onChange={(e) => onUpdateNote(note.id, { 
                          minVisiblePage: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                        placeholder="Page number"
                        className="border border-yellow-300 rounded px-2 py-1 text-sm w-20 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  </div>
                )}

                {/* Note Body */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-600 font-medium">Content</label>
                    <Button
                      onClick={() => toggleNoteExpansion(note.id)}
                      variant="secondary"
                      size="sm"
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </Button>
                  </div>
                  
                  <ResizableTextArea
                    value={note.body}
                    onChange={(value) => onUpdateNote(note.id, { body: value })}
                    placeholder="Write your note here..."
                    minRows={isExpanded ? 6 : 3}
                    maxRows={isExpanded ? 20 : 8}
                  />
                </div>
                
                {/* Metadata */}
                <div className="text-xs text-gray-400 border-t border-gray-100 pt-2">
                  Created: {new Date(note.createdAt).toLocaleDateString()}
                  {note.updatedAt !== note.createdAt && (
                    <span> • Updated: {new Date(note.updatedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-6 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
          <p>Loading notes...</p>
        </div>
      )}
    </div>
  );
};
