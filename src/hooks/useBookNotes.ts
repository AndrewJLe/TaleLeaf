import { useCallback, useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabase-client';
import { isSupabaseEnabled } from '../lib/supabase-enabled';
import { BookNote } from '../types/book';

export interface UseBookNotesResult {
  notes: BookNote[];
  isLoading: boolean;
  error: string | null;
  addNote: (note: Omit<BookNote, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateNote: (id: string, updates: Partial<BookNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  reorderNotes: (noteIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

// Hook for managing book notes via normalized table (behind notesV2 flag)
export function useBookNotes(bookId: string, enabled: boolean = false): UseBookNotesResult {
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert DB row to BookNote interface
  const mapDbNote = (row: any): BookNote => ({
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
  });

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

      setNotes((data || []).map(mapDbNote));
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

    try {
      // Calculate next position (sparse, leave gaps for reordering)
      const maxPosition = Math.max(...notes.map(n => n.position), -1);
      const position = maxPosition + 1000;

      const { data, error: insertError } = await supabaseClient
        .from('book_notes')
        .insert({
          book_id: noteData.bookId,
          title: noteData.title || null,
          body: noteData.body,
          tags: noteData.tags,
          position,
          spoiler_protected: noteData.spoilerProtected,
          min_visible_page: noteData.minVisiblePage || null
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newNote = mapDbNote(data);
      setNotes(prev => [...prev, newNote].sort((a, b) => a.position - b.position));
    } catch (err) {
      console.error('Failed to add note:', err);
      setError(err instanceof Error ? err.message : 'Failed to add note');
    }
  }, [enabled, notes]);

  // Update existing note
  const updateNote = useCallback(async (id: string, updates: Partial<BookNote>) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;

    try {
      const updateData: any = {};
      if ('title' in updates) updateData.title = updates.title || null;
      if ('body' in updates) updateData.body = updates.body;
      if ('tags' in updates) updateData.tags = updates.tags;
      if ('position' in updates) updateData.position = updates.position;
      if ('spoilerProtected' in updates) updateData.spoiler_protected = updates.spoilerProtected;
      if ('minVisiblePage' in updates) updateData.min_visible_page = updates.minVisiblePage || null;

      const { data, error: updateError } = await supabaseClient
        .from('book_notes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedNote = mapDbNote(data);
      setNotes(prev => prev.map(n => n.id === id ? updatedNote : n).sort((a, b) => a.position - b.position));
    } catch (err) {
      console.error('Failed to update note:', err);
      setError(err instanceof Error ? err.message : 'Failed to update note');
    }
  }, [enabled]);

  // Delete note
  const deleteNote = useCallback(async (id: string) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;

    try {
      const { error: deleteError } = await supabaseClient
        .from('book_notes')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  }, [enabled]);

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
    notes,
    isLoading,
    error,
    addNote,
    updateNote,
    deleteNote,
    reorderNotes,
    refresh: fetchNotes
  };
}
