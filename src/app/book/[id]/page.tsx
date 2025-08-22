"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import BookEditorRefactored from '../../../components/BookEditorRefactored';
import { ErrorBoundary } from '../../../components/ui/ErrorBoundary';
import { Book } from '../../../types/book';
import { STORAGE_KEYS } from '../../../constants';

export default function BookPage() {
    const pathname = usePathname();
    const id = pathname?.split('/').pop() || '';
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEYS.BOOKS);
        if (!raw) {
            setLoading(false);
            return;
        }

        try {
            const books: Book[] = JSON.parse(raw);
            const found = books.find((b) => b.id === id);
            setBook(found || null);
        } catch (error) {
            console.error('Error parsing books from localStorage:', error);
            setBook(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const handleBookUpdate = (updatedBook: Book) => {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.BOOKS);
            if (!raw) return;

            const books: Book[] = JSON.parse(raw);
            const updated = books.map((b) => b.id === updatedBook.id ? updatedBook : b);
            localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(updated));
            setBook(updatedBook);
        } catch (error) {
            console.error('Error updating book:', error);
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
                    <h2 className="text-2xl font-bold text-emerald-900 mb-4">Book not found</h2>
                    <p className="text-emerald-700 mb-6">
                        The book you're looking for doesn't exist or may have been removed from your library.
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
            <BookEditorRefactored book={book} onUpdate={handleBookUpdate} />
        </ErrorBoundary>
    );
}
