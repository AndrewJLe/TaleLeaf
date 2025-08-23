import { useCallback, useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabase-client';
import { isSupabaseEnabled } from '../lib/supabase-enabled';
import { Book, Character, Chapter, Location } from '../types/book';

export interface UseBookPersistenceResult {
  isLoading: boolean;
  error: string | null;
  saveBook: (book: Book) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
  saveSections: (bookId: string, sections: any, window: any) => Promise<void>;
  lastSaved: Date | null;
}

// Hook for persisting all book data (metadata, sections, notes) to database
export function useBookPersistence(): UseBookPersistenceResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Save complete book metadata to database
  const saveBook = useCallback(async (book: Book) => {
    if (!isSupabaseEnabled || !supabaseClient) {
      console.warn('Supabase not enabled, skipping book save');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current session
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Upsert book metadata
      const { error: bookError } = await supabaseClient
        .from('books')
        .upsert({
          id: book.id,
          user_id: session.user.id,
          title: book.title,
          cover_url: book.cover || null,
          window_start: book.window.start,
          window_end: book.window.end,
          pdf_path: book.pdfPath || null,
          pdf_page_count: book.pdfPageCount || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (bookError) throw bookError;

      // Save sections data
      await saveSections(book.id, book.sections, book.window);
      
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save book:', err);
      setError(err instanceof Error ? err.message : 'Failed to save book');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save sections (characters, chapters, locations, notes) to database
  const saveSections = useCallback(async (bookId: string, sections: any, window: any) => {
    if (!isSupabaseEnabled || !supabaseClient) return;

    try {
      // Prepare section data payloads
      const sectionPayloads = [
        { 
          book_id: bookId,
          type: 'characters', 
          data: { items: sections.characters || [] }
        },
        { 
          book_id: bookId,
          type: 'chapters', 
          data: { items: sections.chapters || [] }
        },
        { 
          book_id: bookId,
          type: 'locations', 
          data: { items: sections.locations || [] }
        },
        { 
          book_id: bookId,
          type: 'notes', 
          data: { content: sections.notes || '' }
        }
      ];

      // Upsert all sections
      for (const payload of sectionPayloads) {
        const { error: sectionError } = await supabaseClient
          .from('sections')
          .upsert(payload, { 
            onConflict: 'book_id,type',
            ignoreDuplicates: false 
          });

        if (sectionError) throw sectionError;
      }

      // Update book window if provided
      if (window) {
        const { error: windowError } = await supabaseClient
          .from('books')
          .update({
            window_start: window.start,
            window_end: window.end,
            updated_at: new Date().toISOString()
          })
          .eq('id', bookId);

        if (windowError) throw windowError;
      }

    } catch (err) {
      console.error('Failed to save sections:', err);
      throw err;
    }
  }, []);

  // Delete book and all associated data
  const deleteBook = useCallback(async (bookId: string) => {
    if (!isSupabaseEnabled || !supabaseClient) {
      throw new Error('Database not available');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current session
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Delete book (cascades to sections, notes, locations, uploads via FK constraints)
      const { error: deleteError } = await supabaseClient
        .from('books')
        .delete()
        .eq('id', bookId)
        .eq('user_id', session.user.id); // Extra safety check

      if (deleteError) throw deleteError;

      // Note: PDF files in storage should be cleaned up separately if needed
      // For now, we'll leave them as they might be referenced elsewhere
      
    } catch (err) {
      console.error('Failed to delete book:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete book');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    saveBook,
    deleteBook,
    saveSections,
    lastSaved
  };
}
