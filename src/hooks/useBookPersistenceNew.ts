import { useCallback, useState } from 'react';
import { supabaseClient } from '../lib/supabase-client';
import { isSupabaseEnabled } from '../lib/supabase-enabled';
import { Book } from '../types/book';

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
  const [isSavingSections, setIsSavingSections] = useState(false);

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

      console.log('Saving book metadata for:', book.id, 'User:', session.user.id);

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

      if (bookError) {
        console.error('Failed to upsert book metadata:', bookError);
        console.error('Book data payload:', {
          id: book.id,
          user_id: session.user.id,
          title: book.title,
          window: book.window
        });
        throw new Error(`Failed to save book metadata: ${bookError.message || 'Unknown database error'}`);
      }

      // Note: Don't call saveSections here to avoid circular calls
      setLastSaved(new Date());
      console.log('Book metadata saved successfully');
    } catch (err) {
      console.error('Failed to save book:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save book';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save sections (characters, chapters, locations, notes) to database
  const saveSections = useCallback(async (bookId: string, sections: any, window: any) => {
    if (!isSupabaseEnabled || !supabaseClient) {
      console.warn('Supabase not enabled, skipping sections save');
      return;
    }

    // Prevent concurrent saves
    if (isSavingSections) {
      console.log('Already saving sections, skipping duplicate call');
      return;
    }

    setIsSavingSections(true);
    setIsLoading(true);
    setError(null);

    try {
      // Get current session
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('Saving sections for book:', bookId, 'User:', session.user.id);
      console.log('Sections data being saved:', {
        characters: sections.characters?.length || 0,
        chapters: sections.chapters?.length || 0,
        locations: sections.locations?.length || 0,
        notesLength: sections.notes?.length || 0
      });

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

      // Save all sections (check if exists first, then update or insert)
      for (const payload of sectionPayloads) {
        console.log(`Saving ${payload.type} section with ${JSON.stringify(payload.data).length} characters of data`);

        // Check if section already exists
        const { data: existingSection } = await supabaseClient
          .from('sections')
          .select('id')
          .eq('book_id', payload.book_id)
          .eq('type', payload.type)
          .single();

        let sectionError;
        if (existingSection) {
          // Update existing section
          const { error } = await supabaseClient
            .from('sections')
            .update({
              data: payload.data,
              updated_at: new Date().toISOString()
            })
            .eq('book_id', payload.book_id)
            .eq('type', payload.type);
          sectionError = error;
        } else {
          // Insert new section
          const { error } = await supabaseClient
            .from('sections')
            .insert({
              book_id: payload.book_id,
              type: payload.type,
              data: payload.data
            });
          sectionError = error;
        }

        if (sectionError) {
          console.error(`Failed to save ${payload.type} section:`, sectionError);
          console.error('Failed payload:', {
            book_id: payload.book_id,
            type: payload.type,
            dataKeys: Object.keys(payload.data),
            dataSize: JSON.stringify(payload.data).length
          });
          console.error('Error details:', {
            message: sectionError.message || 'No message',
            details: sectionError.details || 'No details',
            hint: sectionError.hint || 'No hint',
            code: sectionError.code || 'No code',
            errorString: String(sectionError),
            errorJSON: JSON.stringify(sectionError, null, 2)
          });

          // Create a meaningful error message
          const errorMsg = sectionError.message ||
            sectionError.details ||
            sectionError.hint ||
            `Database error (code: ${sectionError.code || 'unknown'})`;

          throw new Error(`Failed to save ${payload.type}: ${errorMsg}`);
        }

        console.log(`Successfully saved ${payload.type} section`);
      }

      // Update book window if provided
      if (window) {
        console.log('Updating book window:', window);
        const { error: windowError } = await supabaseClient
          .from('books')
          .update({
            window_start: window.start,
            window_end: window.end,
            updated_at: new Date().toISOString()
          })
          .eq('id', bookId)
          .eq('user_id', session.user.id); // Add user check for security

        if (windowError) {
          console.error('Failed to update book window:', windowError);
          throw new Error(`Failed to update window: ${windowError.message || 'Unknown database error'}`);
        }
        console.log('Book window updated successfully');
      }

      setLastSaved(new Date());
      console.log('All sections saved successfully');
    } catch (err) {
      console.error('Failed to save sections:', err);
      console.error('Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      const errorMessage = err instanceof Error ? err.message : 'Failed to save sections';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      setIsSavingSections(false);
    }
  }, [isSavingSections]);

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

      console.log('Deleting book:', bookId, 'User:', session.user.id);

      // Delete book (cascades to sections, notes, locations, uploads via FK constraints)
      const { error: deleteError } = await supabaseClient
        .from('books')
        .delete()
        .eq('id', bookId)
        .eq('user_id', session.user.id); // Extra safety check

      if (deleteError) {
        console.error('Failed to delete book:', deleteError);
        throw new Error(`Failed to delete book: ${deleteError.message || 'Unknown database error'}`);
      }

      console.log('Book deleted successfully');
      // Note: PDF files in storage should be cleaned up separately if needed
      // For now, we'll leave them as they might be referenced elsewhere

    } catch (err) {
      console.error('Failed to delete book:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete book';
      setError(errorMessage);
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
