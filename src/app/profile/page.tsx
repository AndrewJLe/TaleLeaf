"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookList, UploadForm } from '../../components';
import { sanitizeBooksArrayForLocalStorage } from '../../lib/storage';

export default function ProfilePage() {
    const [books, setBooks] = useState<any[]>([]);
    const [showUploader, setShowUploader] = useState(false);

    useEffect(() => {
        const raw = localStorage.getItem('taleleaf:books');
        if (raw) setBooks(JSON.parse(raw));
    }, []);

    useEffect(() => {
        try {
            const sanitized = sanitizeBooksArrayForLocalStorage(books);
            localStorage.setItem('taleleaf:books', JSON.stringify(sanitized));
        } catch (e) {
            // Fallback: attempt to save raw books if sanitization unexpectedly fails
            try {
                localStorage.setItem('taleleaf:books', JSON.stringify(books));
            } catch (err) {
                // Ignore storage errors here; quota errors are warned elsewhere.
                console.warn('Failed to persist books to localStorage', err);
            }
        }
    }, [books]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-emerald-25 to-amber-50/30">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-3">
                <div className="absolute top-20 right-20 w-40 h-40 bg-emerald-600 rounded-full blur-3xl"></div>
                <div className="absolute bottom-40 left-20 w-32 h-32 bg-amber-600 rounded-full blur-3xl"></div>
            </div>

            <div className="relative max-w-6xl mx-auto p-8">
                {/* Header */}
                <header className="flex items-center justify-between mb-8 p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-emerald-200 shadow-lg">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-3 hover:scale-105 transition-transform duration-200">
                            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center">
                                <span className="text-white text-xl">🍃</span>
                            </div>
                            <div>
                                <div className="text-xl font-bold text-emerald-900">TaleLeaf</div>
                                <div className="text-xs text-emerald-600">Your reading garden</div>
                            </div>
                        </Link>
                        <div className="hidden md:block w-px h-8 bg-emerald-200 mx-4"></div>
                        <div className="hidden md:block">
                            <h2 className="text-2xl font-bold text-emerald-900">Your Library</h2>
                            <p className="text-sm text-emerald-600">{books.length} book{books.length !== 1 ? 's' : ''} in your collection</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 border ${showUploader
                                ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                                : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                } hover:scale-105 shadow-md hover:shadow-lg flex items-center gap-2`}
                            onClick={() => setShowUploader((s) => !s)}
                        >
                            <span className="text-lg">{showUploader ? '✖️' : '📚'}</span>
                            {showUploader ? 'Cancel' : 'Add Book'}
                        </button>
                    </div>
                </header>

                {/* Mobile Header */}
                <div className="md:hidden mb-6 p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-emerald-200">
                    <h2 className="text-xl font-bold text-emerald-900 mb-1">Your Library</h2>
                    <p className="text-sm text-emerald-600">{books.length} book{books.length !== 1 ? 's' : ''} in your collection</p>
                </div>

                {/* Upload Form */}
                {showUploader && (
                    <div className="mb-8 p-6 bg-white/90 backdrop-blur-sm rounded-xl border border-emerald-200 shadow-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                                <span className="text-white text-sm">📖</span>
                            </div>
                            <h3 className="text-lg font-semibold text-emerald-900">Add New Book</h3>
                        </div>
                        <UploadForm onAdd={(b) => { setBooks((s) => [b, ...s]); setShowUploader(false); }} />
                    </div>
                )}

                {/* Books Grid */}
                <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-emerald-200 shadow-lg p-6">
                    {books.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                                <span className="text-3xl">📚</span>
                            </div>
                            <h3 className="text-xl font-semibold text-emerald-900 mb-2">Your library is empty</h3>
                            <p className="text-emerald-600 mb-6 max-w-md mx-auto">
                                Start your reading journey by adding your first book. Upload a PDF and begin tracking characters, locations, and plot details.
                            </p>
                            <button
                                className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
                                onClick={() => setShowUploader(true)}
                            >
                                📖 Add Your First Book
                            </button>
                        </div>
                    ) : (
                        <BookList
                            books={books}
                            selectedId={null}
                            onSelect={() => { }}
                            onDelete={(id: string) => setBooks((s) => s.filter((b) => b.id !== id))}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
