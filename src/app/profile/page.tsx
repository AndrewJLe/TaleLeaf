"use client";

import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookList, ConfirmDeleteDialog, UploadForm } from '../../components';
import { AuthPanel } from '../../components/AuthPanel';
import { useBookPersistence } from '../../hooks/useBookPersistenceNew';
import { sanitizeBooksArrayForLocalStorage } from '../../lib/storage';
import { supabaseClient } from '../../lib/supabase-client';
import { isSupabaseEnabled } from '../../lib/supabase-enabled';

export default function ProfilePage() {
    const [books, setBooks] = useState<any[]>([]); // local books
    const [remoteBooks, setRemoteBooks] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
    const [showUploader, setShowUploader] = useState(false);
    const [session, setSession] = useState<Session | null>(null);
    const [sessionChecked, setSessionChecked] = useState(false);
    const [remoteError, setRemoteError] = useState<string | null>(null);

    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

    // Use persistence hook for database operations
    const { deleteBook: deleteBookFromDB, isLoading: isDeletingFromDB } = useBookPersistence();

    useEffect(() => {
        const raw = localStorage.getItem('taleleaf:books');
        if (raw) setBooks(JSON.parse(raw));
    }, []);
    // Load auth session & subscribe
    useEffect(() => {
        if (!isSupabaseEnabled || !supabaseClient) { setSessionChecked(true); return; }
        supabaseClient.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
            setSession(data.session);
            setSessionChecked(true);
        });
        const { data: sub } = supabaseClient.auth.onAuthStateChange((_e: any, s: Session | null) => {
            setSession(s);
        });
        return () => { sub.subscription.unsubscribe(); };
    }, []);

    // Fetch remote books when authenticated (direct Supabase query to avoid server auth header issues)
    useEffect(() => {
        let active = true;
        if (!isSupabaseEnabled || !supabaseClient) return;
        if (!session) { setRemoteBooks([]); return; }
        (async () => {
            setRemoteError(null);
            const { data, error } = await supabaseClient
                .from('books')
                .select('id,title,cover_url,window_start,window_end,created_at,updated_at')
                .order('updated_at', { ascending: false });
            if (error) {
                console.warn('Load books error', error);
                if (active) setRemoteError(error.message);
                return;
            }
            if (active) setRemoteBooks(data || []);
        })();
        return () => { active = false; };
    }, [session, session?.user?.id]);

    const remoteIds = new Set(remoteBooks.map(b => b.id));
    const unsyncedIds = new Set(books.filter(b => !remoteIds.has(b.id)).map(b => b.id));

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

    // Handle book deletion with confirmation
    const handleDeleteBook = async (id: string, title: string) => {
        setDeleteConfirm({ id, title });
    };

    const confirmDeleteBook = async () => {
        if (!deleteConfirm) return;

        try {
            // Remove from local storage first
            setBooks((prevBooks) => prevBooks.filter((b) => b.id !== deleteConfirm.id));

            // If Supabase is enabled and user is authenticated, delete from remote
            if (isSupabaseEnabled && session) {
                try {
                    await deleteBookFromDB(deleteConfirm.id);

                    // Refresh remote books list
                    const { data } = await supabaseClient
                        .from('books')
                        .select('id,title,cover_url,window_start,window_end,created_at,updated_at')
                        .order('updated_at', { ascending: false });
                    setRemoteBooks(data || []);
                } catch (dbError) {
                    console.error('Failed to delete from database:', dbError);
                    // Don't re-add to local storage since local deletion succeeded
                    // User will see it's gone locally but may still appear in remote
                }
            }
        } catch (error) {
            console.error('Failed to delete book:', error);
        } finally {
            setDeleteConfirm(null);
        }
    };

    const cancelDeleteBook = () => {
        setDeleteConfirm(null);
    };

    // Loading state while determining session
    if (isSupabaseEnabled && !sessionChecked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-emerald-25 to-amber-50/30">
                <div className="flex flex-col items-center gap-4 text-emerald-700">
                    <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium">Checking session…</span>
                </div>
            </div>
        );
    }

    // Gate the library behind sign-in when Supabase is enabled
    if (isSupabaseEnabled && sessionChecked && !session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-emerald-25 to-amber-50/30 p-6">
                <div className="max-w-md w-full space-y-6">
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white text-3xl">🍃</div>
                        <h1 className="text-2xl font-bold text-emerald-900">Sign in to your Library</h1>
                        <p className="text-sm text-emerald-700 leading-relaxed">Create or access your TaleLeaf library with a magic link. Your books and notes sync securely to the cloud.</p>
                    </div>
                    <AuthPanel />
                    <div className="text-center text-xs text-emerald-500">
                        By continuing you agree to basic usage of cookies/local storage for session & book data.
                    </div>
                </div>
            </div>
        );
    }

    // Merge local + remote (remote entries added only if not already in local)
    const mergedBooks = [
        ...books,
        ...remoteBooks
            .filter(r => !books.some(b => b.id === r.id))
            .map(r => ({
                id: r.id,
                title: r.title,
                pages: r.window_end || r.window_start || 0,
                createdAt: new Date(r.created_at || Date.now()).getTime(),
                cover: r.cover_url || undefined
            }))
    ];
    const mergedCount = mergedBooks.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-emerald-25 to-amber-50/30">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-3">
                <div className="absolute top-20 right-20 w-40 h-40 bg-emerald-600 rounded-full blur-3xl"></div>
                <div className="absolute bottom-40 left-20 w-32 h-32 bg-amber-600 rounded-full blur-3xl"></div>
            </div>

            <div className="relative max-w-6xl mx-auto p-8">
                {!isSupabaseEnabled && (
                    <div className="mb-6 p-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm flex items-start gap-3">
                        <span>⚠️</span>
                        <div>
                            <div className="font-medium mb-0.5">Cloud sync & sign-in are not configured</div>
                            <p>Set <code className="px-1 py-0.5 bg-white/60 rounded border border-amber-200">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="px-1 py-0.5 bg-white/60 rounded border border-amber-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in a <code>.env.local</code> file and restart the dev server to enable sign-in. Local-only mode is currently active.</p>
                        </div>
                    </div>
                )}
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
                            <p className="text-sm text-emerald-600">{mergedCount} book{mergedCount !== 1 ? 's' : ''} in your collection</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {isSupabaseEnabled && <AuthPanel />}
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
                        {isSupabaseEnabled && session && books.length > 0 && (
                            <button
                                onClick={async () => {
                                    setImporting(true);
                                    try {
                                        for (const b of books) {
                                            if (importedIds.has(b.id)) continue;
                                            try {
                                                // Upsert book
                                                const { error: bookErr } = await supabaseClient.from('books').upsert({
                                                    id: b.id,
                                                    user_id: session.user.id,
                                                    title: b.title,
                                                    window_start: b.window?.start || 1,
                                                    window_end: b.window?.end || Math.min(50, b.pages || 50),
                                                    pdf_path: b.pdfPath || null,
                                                    pdf_page_count: b.pdfPageCount || null
                                                });
                                                if (bookErr) throw bookErr;
                                                // Upsert sections
                                                const sectionMap = [
                                                    { type: 'characters', data: { items: b.sections?.characters || [] } },
                                                    { type: 'chapters', data: { items: b.sections?.chapters || [] } },
                                                    { type: 'locations', data: { items: b.sections?.locations || [] } },
                                                    { type: 'notes', data: { content: b.sections?.notes || '' } }
                                                ];
                                                for (const s of sectionMap) {
                                                    const { error: secErr } = await supabaseClient.from('sections').upsert({
                                                        book_id: b.id,
                                                        type: s.type,
                                                        data: s.data
                                                    }, { onConflict: 'book_id,type' as any });
                                                    if (secErr) throw secErr;
                                                }
                                                setImportedIds(prev => new Set(prev).add(b.id));
                                            } catch (e) {
                                                console.warn('Import failed for book', b.id, e);
                                            }
                                        }
                                        // Refresh remote
                                        const { data } = await supabaseClient.from('books').select('id,title,cover_url,window_start,window_end,created_at,updated_at').order('updated_at', { ascending: false });
                                        setRemoteBooks(data || []);
                                    } finally {
                                        setImporting(false);
                                    }
                                    setImporting(false);
                                }}
                                className="px-4 py-2 rounded-lg font-medium bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200 transition disabled:opacity-50"
                                disabled={importing}
                            >
                                {importing ? 'Importing...' : 'Import Local → Cloud'}
                            </button>
                        )}
                    </div>
                </header>

                {/* Debug Panel (temporary) */}
                {isSupabaseEnabled && session && (
                    <div className="mb-4 p-3 text-xs rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 font-mono flex flex-wrap gap-3">
                        <div>local:{books.length}</div>
                        <div>remote:{remoteBooks.length}</div>
                        <div>imported:{importedIds.size}</div>
                        {remoteError && <div className="text-red-600">remoteError:{remoteError}</div>}
                        <button
                            onClick={async () => {
                                const { data, error } = await supabaseClient
                                    .from('books')
                                    .select('id,title,created_at')
                                    .order('updated_at', { ascending: false });
                                if (error) setRemoteError(error.message); else setRemoteBooks(data || []);
                            }}
                            className="px-2 py-0.5 bg-emerald-600 text-white rounded"
                        >Refresh</button>
                    </div>
                )}

                {/* Mobile Header */}
                <div className="md:hidden mb-6 p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-emerald-200">
                    <h2 className="text-xl font-bold text-emerald-900 mb-1">Your Library</h2>
                    <p className="text-sm text-emerald-600">{mergedCount} book{mergedCount !== 1 ? 's' : ''} in your collection</p>
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
                        <UploadForm onAdd={async (b) => {
                            setBooks((s) => [b, ...s]);
                            setShowUploader(false);
                            if (isSupabaseEnabled && session) {
                                try {
                                    const { error: bookErr } = await supabaseClient.from('books').upsert({
                                        id: b.id,
                                        user_id: session.user.id,
                                        title: b.title,
                                        window_start: b.window?.start || 1,
                                        window_end: b.window?.end || Math.min(50, b.pages || 50),
                                        pdf_path: b.pdfPath || null,
                                        pdf_page_count: b.pdfPageCount || null
                                    });
                                    if (bookErr) throw bookErr;
                                    const sectionMap = [
                                        { type: 'characters', data: { items: b.sections?.characters || [] } },
                                        { type: 'chapters', data: { items: b.sections?.chapters || [] } },
                                        { type: 'locations', data: { items: b.sections?.locations || [] } },
                                        { type: 'notes', data: { content: b.sections?.notes || '' } }
                                    ];
                                    for (const s of sectionMap) {
                                        const { error: secErr } = await supabaseClient.from('sections').upsert({
                                            book_id: b.id,
                                            type: s.type,
                                            data: s.data
                                        }, { onConflict: 'book_id,type' as any });
                                        if (secErr) throw secErr;
                                    }
                                    setImportedIds(prev => new Set(prev).add(b.id));
                                    const { data } = await supabaseClient.from('books').select('id,title,cover_url,window_start,window_end,created_at,updated_at').order('updated_at', { ascending: false });
                                    setRemoteBooks(data || []);
                                } catch (e) {
                                    console.warn('Auto import failed', e);
                                }
                            }
                        }} />
                    </div>
                )}

                {/* Books Grid */}
                <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-emerald-200 shadow-lg p-6">
                    {mergedCount === 0 ? (
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
                            books={mergedBooks}
                            selectedId={null}
                            onSelect={() => { }}
                            onDelete={handleDeleteBook}
                            remoteIds={remoteIds}
                            unsyncedIds={unsyncedIds}
                        />
                    )}
                </div>

                {/* Delete Confirmation Dialog */}
                <ConfirmDeleteDialog
                    isOpen={!!deleteConfirm}
                    bookTitle={deleteConfirm?.title || ''}
                    onConfirm={confirmDeleteBook}
                    onCancel={cancelDeleteBook}
                    isDeleting={isDeletingFromDB}
                />
            </div>
        </div>
    );
}
