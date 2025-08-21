"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BookEditor } from '../../../components';

export default function BookPage() {
    const pathname = usePathname();
    const id = pathname?.split('/').pop() || '';
    const [book, setBook] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const raw = localStorage.getItem('taleleaf:books');
        if (!raw) {
            setLoading(false);
            return;
        }
        const books = JSON.parse(raw);
        const found = books.find((b: any) => b.id === id);
        setBook(found || null);
        setLoading(false);
    }, [id]);

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
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-emerald-25 to-amber-50/30 p-8">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-3">
                <div className="absolute top-20 right-20 w-40 h-40 bg-emerald-600 rounded-full blur-3xl"></div>
                <div className="absolute bottom-40 left-20 w-32 h-32 bg-amber-600 rounded-full blur-3xl"></div>
            </div>

            <div className="relative">
                <BookEditor
                    book={book}
                    onUpdate={(u: any) => {
                        const raw = localStorage.getItem('taleleaf:books');
                        if (!raw) return;
                        const books = JSON.parse(raw);
                        const updated = books.map((b: any) => b.id === u.id ? u : b);
                        localStorage.setItem('taleleaf:books', JSON.stringify(updated));
                        setBook(u);
                    }}
                />
            </div>
        </div>
    );
}
