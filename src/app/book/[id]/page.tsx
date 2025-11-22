"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BookEditor from "../../../components/BookEditor";
import { ErrorBoundary } from "../../../components/ui/ErrorBoundary";
import { STORAGE_KEYS } from "../../../constants";
import { pdfStorage } from "../../../lib/pdf-storage";
import { sanitizeBooksArrayForLocalStorage } from "../../../lib/storage";
import { supabaseClient } from "../../../lib/supabase-client";
import { isSupabaseEnabled } from "../../../lib/supabase-enabled";
import { downloadPDF, getSignedPDFUrl } from "../../../lib/supabase-storage";
import { Book } from "../../../types/book";

export default function BookPage() {
  const pathname = usePathname();
  const id = pathname?.split("/").pop() || "";
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = localStorage.getItem(STORAGE_KEYS.BOOKS);
      if (raw) {
        try {
          const books: Book[] = JSON.parse(raw);
          const found = books.find((b) => b.id === id);
          if (found) {
            if (!cancelled) {
              setBook(found);
              setLoading(false);
            }
            return; // already have it locally
          }
        } catch (e) {
          console.warn("Failed to parse local books", e);
        }
      }
      // Not found locally: attempt remote fetch if Supabase enabled
      if (isSupabaseEnabled && supabaseClient) {
        try {
          const {
            data: { session },
          } = await supabaseClient.auth.getSession();
          if (!session) {
            if (!cancelled) setLoading(false);
            return;
          }
          const { data: bookRow, error: bookErr } = await supabaseClient
            .from("books")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (bookErr) throw bookErr;
          if (!bookRow) {
            if (!cancelled) setLoading(false);
            return;
          }
          // Fetch normalized entities
          const [
            { data: characters, error: charErr },
            { data: chapters, error: chapErr },
            { data: locations, error: locErr },
            { data: notes, error: notesErr },
          ] = await Promise.all([
            supabaseClient
              .from("book_characters")
              .select("*")
              .eq("book_id", id),
            supabaseClient.from("book_chapters").select("*").eq("book_id", id),
            supabaseClient.from("book_locations").select("*").eq("book_id", id),
            supabaseClient.from("book_notes").select("*").eq("book_id", id),
          ]);

          if (charErr) throw charErr;
          if (chapErr) throw chapErr;
          if (locErr) throw locErr;
          if (notesErr) throw notesErr;

          const sectionsMap: {
            characters: any[];
            chapters: any[];
            locations: any[];
            notes: any[];
          } = {
            characters: characters || [],
            chapters: chapters || [],
            locations: locations || [],
            notes: notes || [],
          };
          const uploads: any[] = [];
          if (bookRow.pdf_path) {
            try {
              await getSignedPDFUrl(bookRow.pdf_path, 60); // ensure path is valid
              const pdfBlob = await downloadPDF(bookRow.pdf_path);
              const uploadId = crypto.randomUUID();
              await pdfStorage.storePDF(
                uploadId,
                (bookRow.title || "Book") + ".pdf",
                pdfBlob,
              );
              uploads.push({
                id: uploadId,
                filename: (bookRow.title || "Book") + ".pdf",
                type: "pdf" as const,
                pageCount:
                  bookRow.pdf_page_count ||
                  bookRow.window_end ||
                  bookRow.window_start ||
                  0,
                indexedDBKey: uploadId,
                uploadedAt: new Date(),
              });
            } catch (e) {
              console.warn(
                "Failed to download remote PDF, using placeholder",
                e,
              );
            }
          }
          if (uploads.length === 0) {
            uploads.push({
              id: crypto.randomUUID(),
              filename: "Cloud Placeholder",
              type: "text" as const,
              pageCount: 1,
              pages: [
                "This cloud book has no stored PDF. Re-upload locally to enable full viewing.",
              ],
              uploadedAt: new Date(),
            });
          }
          const remoteBook: Book = {
            id: bookRow.id,
            title: bookRow.title || "Untitled",
            sections: sectionsMap as any,
            window: {
              start: bookRow.window_start || 1,
              end: bookRow.window_end || bookRow.window_start || 1,
            },
            uploads,
            pages: bookRow.window_end || bookRow.window_start || 0,
            cover: bookRow.cover_url || null,
            pdfPath: bookRow.pdf_path || undefined,
            pdfPageCount: bookRow.pdf_page_count || undefined,
            createdAt: new Date(bookRow.created_at || Date.now()),
            updatedAt: new Date(bookRow.updated_at || Date.now()),
          };
          if (!cancelled) {
            setBook(remoteBook);
            // Persist into local storage so future loads are instant
            try {
              const current: Book[] = raw ? JSON.parse(raw) : [];
              const updated = sanitizeBooksArrayForLocalStorage([
                ...current,
                remoteBook,
              ]);
              localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(updated));
            } catch (e) {
              console.warn("Failed to persist remote book locally", e);
            }
          }
        } catch (e) {
          console.warn("Remote fetch failed", e);
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleBookUpdate = (updatedBook: Book) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BOOKS);
      if (!raw) return;

      const books: Book[] = JSON.parse(raw);
      const updated = books.map((b) =>
        b.id === updatedBook.id ? updatedBook : b,
      );
      // sanitize large fields (PDF base64) before persisting
      const sanitized = sanitizeBooksArrayForLocalStorage(updated);
      localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(sanitized));
      setBook(updatedBook);
    } catch (error) {
      console.error("Error updating book:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-emerald-25 to-amber-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl">🍃</span>
          </div>
          <p className="text-emerald-700 font-medium">Loading your book...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-emerald-25 to-amber-50/30 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">📚</span>
          </div>
          <h2 className="text-2xl font-bold text-emerald-900 mb-4">
            Book not found
          </h2>
          <p className="text-emerald-700 mb-6">
            The book you&rsquo;re looking for doesn&rsquo;t exist or may have been removed
            from your library.
          </p>
          <a
            href="/profile"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <span>🏠</span>
            Return to Library
          </a>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BookEditor book={book} onUpdate={handleBookUpdate} />
    </ErrorBoundary>
  );
}
