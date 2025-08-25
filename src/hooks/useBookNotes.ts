import { useCallback, useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabase-client';
import { isSupabaseEnabled } from '../lib/supabase-enabled';
import { BookNote } from '../types/book';

// Helper to compare note content for dirty detection
const shallowCompareNote = (a: BookNote, b: BookNote): boolean => {
  return (
    a.title === b.title &&
    a.body === b.body &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
    a.spoilerProtected === b.spoilerProtected &&
    a.minVisiblePage === b.minVisiblePage
  );
};

export interface UseBookNotesResult {
  notes: BookNote[];
  isLoading: boolean;
  error: string | null;
  addNote: (note: Omit<BookNote, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateNote: (id: string, updates: Partial<BookNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  reorderNotes: (noteIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
  // Draft state management
  updateDraft: (id: string, updates: Partial<BookNote>) => void;
  cancelNote: (id: string) => void;
  saveNote: (id: string) => Promise<void>;
  saveAllNotes: () => Promise<void>;
  discardAllChanges: () => void;
  dirtyNoteIds: string[];
  hasUnsavedChanges: boolean;
}

// Hook for managing book notes via normalized table (behind notesV2 flag)
export function useBookNotes(bookId: string, enabled: boolean = false): UseBookNotesResult {
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft state management
  const [baselines, setBaselines] = useState<Record<string, BookNote>>({});
  const [drafts, setDrafts] = useState<Record<string, BookNote>>({});
  const [newNoteCounter, setNewNoteCounter] = useState(0);

  // Calculate dirty notes
  const dirtyNoteIds = Object.keys(drafts).filter(id => {
    const draft = drafts[id];
    const baseline = baselines[id];

    // New note (no baseline) is dirty if it has content
    if (!baseline) {
      return draft.title?.trim() || draft.body.trim() || draft.tags.length > 0;
    }

    // Existing note is dirty if different from baseline
    return !shallowCompareNote(draft, baseline);
  });

  const hasUnsavedChanges = dirtyNoteIds.length > 0;

  // Convert DB row to BookNote interface
  const mapDbNote = useCallback((row: any): BookNote => ({
    id: row.id,
    bookId: row.book_id,
    title: row.title || undefined,
    body: row.body || '',
    tags: row.tags || [],
    position: row.position || 0,
    spoilerProtected: row.spoiler_protected || false,
    minVisiblePage: row.min_visible_page || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }), []);

  // Update draft (local changes only)
  const updateDraft = useCallback((id: string, updates: Partial<BookNote>) => {
    setDrafts(prev => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...updates } };
    });
  }, []);

  // Cancel note edits (revert to baseline)
  const cancelNote = useCallback((id: string) => {
    const baseline = baselines[id];
    if (baseline) {
      // Revert to baseline
      setDrafts(prev => ({ ...prev, [id]: { ...baseline } }));
    } else {
      // New note - remove from drafts
      setDrafts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setNotes(prev => prev.filter(n => n.id !== id));
    }
  }, [baselines]);

  // Save individual note
  const saveNote = useCallback(async (id: string) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;

    const draft = drafts[id];
    if (!draft) return;

    try {
      const isNewNote = !baselines[id];

      if (isNewNote) {
        // Create new note
        const { data, error: insertError } = await supabaseClient
          .from('book_notes')
          .insert({
            book_id: draft.bookId,
            title: draft.title || null,
            body: draft.body,
            tags: draft.tags,
            position: draft.position,
            spoiler_protected: draft.spoilerProtected,
            min_visible_page: draft.minVisiblePage || null
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const newNote = mapDbNote(data);

        // Update notes array - replace temp with real note
        setNotes(prev => prev.map(n => n.id === id ? newNote : n).sort((a, b) => a.position - b.position));

        // Update drafts and baselines with real ID
        setDrafts(prev => {
          const next = { ...prev };
          delete next[id]; // Remove temp ID
          next[newNote.id] = { ...newNote }; // Add real ID
          return next;
        });
        setBaselines(prev => ({ ...prev, [newNote.id]: { ...newNote } }));
      } else {
        // Update existing note
        const updateData: any = {};
        if ('title' in draft) updateData.title = draft.title || null;
        if ('body' in draft) updateData.body = draft.body;
        if ('tags' in draft) updateData.tags = draft.tags;
        if ('position' in draft) updateData.position = draft.position;
        if ('spoilerProtected' in draft) updateData.spoiler_protected = draft.spoilerProtected;
        if ('minVisiblePage' in draft) updateData.min_visible_page = draft.minVisiblePage || null;

        const { data, error: updateError } = await supabaseClient
          .from('book_notes')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (updateError) throw updateError;

        const updatedNote = mapDbNote(data);
        setNotes(prev => prev.map(n => n.id === id ? updatedNote : n).sort((a, b) => a.position - b.position));
        setBaselines(prev => ({ ...prev, [id]: { ...updatedNote } }));
        setDrafts(prev => ({ ...prev, [id]: { ...updatedNote } }));
      }
    } catch (err) {
      console.error('Failed to save note:', err);
      setError(err instanceof Error ? err.message : 'Failed to save note');
    }
  }, [enabled, drafts, baselines, mapDbNote]);

  // Save all dirty notes
  const saveAllNotes = useCallback(async () => {
    const promises = dirtyNoteIds.map(id => saveNote(id));
    await Promise.all(promises);
  }, [dirtyNoteIds, saveNote]);

  // Discard all unsaved changes
  const discardAllChanges = useCallback(() => {
    // Revert existing notes to baselines
    const revertedDrafts: Record<string, BookNote> = {};
    Object.keys(baselines).forEach(id => {
      revertedDrafts[id] = { ...baselines[id] };
    });

    // Remove new notes that were never saved
    const filteredNotes = notes.filter(note => baselines[note.id]);

    setDrafts(revertedDrafts);
    setNotes(filteredNotes);
  }, [baselines, notes]);

  // Fetch notes from database
  const fetchNotes = useCallback(async () => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient || !bookId) {
      setNotes([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabaseClient
        .from('book_notes')
        .select('*')
        .eq('book_id', bookId)
        .order('position', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      const mappedNotes = (data || []).map(mapDbNote);
      setNotes(mappedNotes);

      // Set up baselines and drafts for loaded notes
      const newBaselines: Record<string, BookNote> = {};
      const newDrafts: Record<string, BookNote> = {};
      mappedNotes.forEach((note: BookNote) => {
        newBaselines[note.id] = { ...note };
        newDrafts[note.id] = { ...note };
      });
      setBaselines(newBaselines);
      setDrafts(newDrafts);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notes');
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [bookId, enabled]);

  // Add new note
  const addNote = useCallback(async (noteData: Omit<BookNote, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;

    // Create temporary ID for new note
    const tempId = `temp-${Date.now()}-${newNoteCounter}`;
    setNewNoteCounter(prev => prev + 1);

    // Calculate next position (sparse, leave gaps for reordering)
    const maxPosition = Math.max(...notes.map(n => n.position), -1);
    const position = maxPosition + 1000;

    const newNote: BookNote = {
      ...noteData,
      id: tempId,
      position,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to notes and drafts (no baseline until saved)
    setNotes(prev => [...prev, newNote].sort((a, b) => a.position - b.position));
    setDrafts(prev => ({ ...prev, [tempId]: newNote }));
  }, [enabled, notes, newNoteCounter]);

  // Update existing note (legacy - now just updates draft)
  const updateNote = useCallback(async (id: string, updates: Partial<BookNote>) => {
    updateDraft(id, updates);
  }, [updateDraft]);

  // Delete note
  const deleteNote = useCallback(async (id: string) => {
    const isNewNote = !baselines[id];

    if (isNewNote) {
      // Just remove from drafts and notes (never saved)
      setDrafts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setNotes(prev => prev.filter(n => n.id !== id));
      return;
    }

    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;

    try {
      const { error: deleteError } = await supabaseClient
        .from('book_notes')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Remove from all state
      setNotes(prev => prev.filter(n => n.id !== id));
      setBaselines(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setDrafts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      console.error('Failed to delete note:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  }, [enabled, baselines]);

  // Reorder notes (batch update positions)
  const reorderNotes = useCallback(async (noteIds: string[]) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;

    try {
      // Create updates with new positions (sparse: 0, 1000, 2000, ...)
      const updates = noteIds.map((id, index) => ({
        id,
        position: index * 1000
      }));

      // Batch update positions
      for (const update of updates) {
        const { error: updateError } = await supabaseClient
          .from('book_notes')
          .update({ position: update.position })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      // Refresh to get updated data
      await fetchNotes();
    } catch (err) {
      console.error('Failed to reorder notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to reorder notes');
    }
  }, [enabled, fetchNotes]);

  // Initial fetch and setup
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return {
    notes: Object.values(drafts).sort((a, b) => a.position - b.position),
    isLoading,
    error,
    addNote,
    updateNote,
    deleteNote,
    reorderNotes,
    refresh: fetchNotes,
    // Draft state management
    updateDraft,
    cancelNote,
    saveNote,
    saveAllNotes,
    discardAllChanges,
    dirtyNoteIds,
    hasUnsavedChanges
  };
}
