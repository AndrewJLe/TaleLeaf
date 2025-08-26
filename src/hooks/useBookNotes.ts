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
    a.minVisiblePage === b.minVisiblePage &&
    a.groupId === b.groupId
  );
};

export interface UseBookNotesResult {
  notes: BookNote[];
  isLoading: boolean;
  error: string | null;
  addNote: (note: Omit<BookNote, 'id' | 'createdAt' | 'updatedAt' | 'bookId'>) => Promise<void>;
  updateNote: (id: string, updates: Partial<BookNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  reorderNotes: (noteIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
  immediateUpdateNote: (id: string, updates: Partial<BookNote>) => Promise<void>; // bypass draft dirty phase (used for tag ops)
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
    groupId: row.group_id || null,
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
      // Acquire auth token for API route so server logic (including book_note_tags joins) executes
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;
      const effectiveBookId = draft.bookId || bookId;
      if (!effectiveBookId) {
        console.error('Cannot save note: missing bookId');
        return;
      }
      const baseUrl = `/api/books/${effectiveBookId}/notes`;
      if (isNewNote) {
        const resp = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            title: draft.title,
            body: draft.body,
            tags: draft.tags,
            position: draft.position,
            spoilerProtected: draft.spoilerProtected,
            minVisiblePage: draft.minVisiblePage,
            groupId: draft.groupId
          })
        });
        if (!resp.ok) {
          let serverMsg = '';
          try { serverMsg = (await resp.json()).error; } catch { /* ignore */ }
          throw new Error(`Create note failed (${resp.status})${serverMsg ? ': ' + serverMsg : ''}`);
        }
        const json = await resp.json();
        const newNote = json.note as BookNote;
        // Replace temp id in notes
        setNotes(prev => prev.map(n => n.id === id ? newNote : n).sort((a, b) => a.position - b.position));
        setDrafts(prev => {
          const next = { ...prev };
          delete next[id];
          next[newNote.id] = { ...newNote } as any;
          return next;
        });
        setBaselines(prev => ({ ...prev, [newNote.id]: { ...newNote } as any }));
      } else {
        const resp = await fetch(baseUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            id,
            title: draft.title,
            body: draft.body,
            tags: draft.tags,
            position: draft.position,
            spoilerProtected: draft.spoilerProtected,
            minVisiblePage: draft.minVisiblePage,
            groupId: draft.groupId
          })
        });
        if (!resp.ok) {
          let serverMsg = '';
          try { serverMsg = (await resp.json()).error; } catch { /* ignore */ }
          throw new Error(`Update note failed (${resp.status})${serverMsg ? ': ' + serverMsg : ''}`);
        }
        const json = await resp.json();
        const updatedNote = json.note as BookNote;
        setNotes(prev => prev.map(n => n.id === id ? updatedNote : n).sort((a, b) => a.position - b.position));
        setBaselines(prev => ({ ...prev, [id]: { ...updatedNote } as any }));
        setDrafts(prev => ({ ...prev, [id]: { ...updatedNote } as any }));
      }
    } catch (err) {
      console.error('Failed to save note:', err);
      setError(err instanceof Error ? err.message : 'Failed to save note');
    }
  }, [enabled, drafts, baselines]);

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
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;
      const resp = await fetch(`/api/books/${bookId}/notes`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!resp.ok) throw new Error(`Fetch notes failed (${resp.status})`);
      const json = await resp.json();
      const mappedNotes: BookNote[] = (json.notes || []).map((n: any) => ({
        id: n.id,
        bookId: n.bookId,
        title: n.title,
        body: n.body,
        tags: n.tags || [],
        position: n.position,
        spoilerProtected: n.spoilerProtected,
        minVisiblePage: n.minVisiblePage,
        groupId: n.groupId,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt
      }));
      setNotes(mappedNotes);
      const newBaselines: Record<string, BookNote> = {};
      const newDrafts: Record<string, BookNote> = {};
      mappedNotes.forEach(note => { newBaselines[note.id] = { ...note }; newDrafts[note.id] = { ...note }; });
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
  const addNote = useCallback(async (noteData: Omit<BookNote, 'id' | 'createdAt' | 'updatedAt' | 'bookId'>) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;
      const maxPosition = Math.max(...notes.map(n => n.position), -1);
      const position = maxPosition + 1000;
      const resp = await fetch(`/api/books/${bookId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          title: noteData.title,
          body: noteData.body,
          tags: noteData.tags,
          position,
          spoilerProtected: noteData.spoilerProtected,
          minVisiblePage: noteData.minVisiblePage,
          groupId: noteData.groupId
        })
      });
      if (!resp.ok) {
        let serverMsg = ''; try { serverMsg = (await resp.json()).error; } catch { }
        throw new Error(`Create note failed (${resp.status})${serverMsg ? ': ' + serverMsg : ''}`);
      }
      const json = await resp.json();
      const created = json.note as BookNote;
      setNotes(prev => [...prev, created].sort((a, b) => a.position - b.position));
      setBaselines(prev => ({ ...prev, [created.id]: { ...created } }));
      setDrafts(prev => ({ ...prev, [created.id]: { ...created } }));
    } catch (e: any) {
      console.error('Failed to create note immediately', e);
      setError(e instanceof Error ? e.message : 'Failed to create note');
    }
  }, [enabled, notes, supabaseClient, bookId]);

  const immediateUpdateNote = useCallback(async (id: string, updates: Partial<BookNote>) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;
    const current = drafts[id] || baselines[id];
    if (!current) return;
    try {
      const merged = { ...current, ...updates };
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;
      const resp = await fetch(`/api/books/${current.bookId || bookId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          id,
          title: merged.title,
          body: merged.body,
          tags: merged.tags,
          position: merged.position,
          spoilerProtected: merged.spoilerProtected,
          minVisiblePage: merged.minVisiblePage,
          groupId: merged.groupId
        })
      });
      if (!resp.ok) {
        let serverMsg = ''; try { serverMsg = (await resp.json()).error; } catch { }
        throw new Error(`Immediate update failed (${resp.status})${serverMsg ? ': ' + serverMsg : ''}`);
      }
      const json = await resp.json();
      const updated = json.note as BookNote;
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
      setBaselines(prev => ({ ...prev, [id]: { ...updated } }));
      setDrafts(prev => ({ ...prev, [id]: { ...updated } }));
    } catch (e: any) {
      console.error('Immediate update note failed', e);
      setError(e instanceof Error ? e.message : 'Failed to update note');
    }
  }, [enabled, drafts, baselines, supabaseClient, bookId]);

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
    immediateUpdateNote,
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
