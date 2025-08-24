"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { featureFlags } from "../constants/featureFlags";
import { useAIGeneration } from "../hooks/useAIGeneration";
import { useBookActions } from "../hooks/useBookActions";
import { useBookNotes } from "../hooks/useBookNotes";
import { useBookPersistence } from "../hooks/useBookPersistenceNew";
import { AIMessage, aiService, TokenEstimate } from "../lib/ai-service";
import { BookEditorProps, TabType } from "../types/book";
// Replaced AISettingsModal with consolidated SettingsModal
import type { Session } from '@supabase/supabase-js';
import { supabaseClient } from "../lib/supabase-client";
import { isSupabaseEnabled } from "../lib/supabase-enabled";
import ContextWindow from "./ContextWindow";
import { ChaptersSection } from "./sections/ChaptersSection";
import { CharactersSection } from "./sections/CharactersSection";
import { LocationsSection } from "./sections/LocationsSection";
import { NotesList } from "./sections/NotesList";
import { NotesSection } from "./sections/NotesSection";
import { SettingsModal } from "./SettingsModal";
import { Button } from "./ui/Button";
import { DocumentViewer } from "./ui/DocumentViewer";
import { MessageSquareIcon, SettingsIcon } from "./ui/Icons";
// Rate limit display intentionally omitted for a minimal UI
import { RateLimitsModal } from "./ui/RateLimitsModal";
import { SplitLayout } from "./ui/SplitLayout";
import { TabNavigation } from "./ui/TabNavigation";
// Token budget display intentionally omitted from header for minimal UI
import { FeatureFlagDebug } from "./FeatureFlagDebug";
import { TokenConfirmDialog } from "./ui/TokenConfirmDialog";
import { Tooltip } from "./ui/Tooltip";

export default function BookEditor({ book, onUpdate }: BookEditorProps) {
    const [local, setLocal] = useState(() => {
        // Migrate old notes format (string) to new format (Note[])
        const migratedBook = { ...book };
        if (typeof migratedBook.sections.notes === 'string') {
            const oldNotes = migratedBook.sections.notes;
            migratedBook.sections.notes = oldNotes
                ? [{ name: 'General Notes', notes: oldNotes }]
                : [];
        }
        return migratedBook;
    });
    const [message, setMessage] = useState("");
    const [chat, setChat] = useState<AIMessage[]>([]);
    const [isEditingPageText, setIsEditingPageText] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const searchParams = useSearchParams();
    useEffect(() => {
        if (searchParams?.get('edit') === '1') setShowSettings(true);
    }, [searchParams]);
    const [showContextWindow, setShowContextWindow] = useState(false);
    const [showRateLimits, setShowRateLimits] = useState(false);
    const [tab, setTab] = useState<TabType>('characters');
    const [currentDocumentPage, setCurrentDocumentPage] = useState(1);
    const [tokenConfirm, setTokenConfirm] = useState<{
        isOpen: boolean;
        estimate: TokenEstimate | null;
        action: string;
        onConfirm: () => void | Promise<void>;
    }>({
        isOpen: false,
        estimate: null,
        action: '',
        onConfirm: () => { }
    });
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    // Custom hooks for state management
    const {
        aiGenerationState,
        isAILoading,
        setIsAILoading,
        setGenerationLoading
    } = useAIGeneration();

    // TODO N1: Multi-note system integration
    const {
        notes: bookNotes,
        isLoading: notesLoading,
        error: notesError,
        addNote,
        updateNote,
        deleteNote,
        reorderNotes
    } = useBookNotes(local.id, featureFlags.notesV2);

    // Database persistence
    const {
        isLoading: isPersisting,
        error: persistError,
        saveBook,
        deleteBook,
        lastSaved
    } = useBookPersistence();

    // Book actions hook
    const {
        addCharacter,
        updateCharacter,
        deleteCharacter,
        enhanceCharacter,
        generateCharacters,
        addChapter,
        updateChapter,
        deleteChapter,
        moveChapter,
        generateChapterSummary,
        addLocation,
        updateLocation,
        deleteLocation,
        generateLocations,
        addNote: addBookNote,
        updateNote: updateBookNote,
        deleteNote: deleteBookNote,
        generateNotes,
        updateBook
    } = useBookActions(local, (updatedBook) => {
        setLocal(updatedBook);
        onUpdate(updatedBook);
    }, setGenerationLoading);

    // Handle book deletion
    const handleDeleteBook = async () => {
        try {
            await deleteBook(local.id);
            // Redirect to library after successful deletion
            window.location.href = '/profile';
        } catch (error) {
            console.error('Failed to delete book:', error);
            // Error is already set in useBookPersistence
        }
    };

    // Auto-save book metadata when title or window changes
    useEffect(() => {
        const saveTimer = setTimeout(async () => {
            try {
                await saveBook(local);
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        }, 2000); // 2 second debounce

        return () => clearTimeout(saveTimer);
    }, [local.title, local.window.start, local.window.end, local.cover, saveBook]);

    // Context window management - use pageCount from upload for clean data flow
    const pageCount = (() => {
        const upload = local.uploads?.[0];
        if (upload?.pageCount) {
            return upload.pageCount; // Single source of truth
        }
        // Fallback for books without uploads
        return local.pages ?? 300;
    })();

    const handleContextWindowChange = (start: number, end: number) => {
        updateBook({ window: { start, end } });
    };

    // Keep document viewer and context window in sync: when the context window changes, jump
    // the document viewer to the window start so both reflect the same focus range.
    useEffect(() => {
        if (local.window && typeof local.window.start === 'number') {
            setCurrentDocumentPage(local.window.start);
        }
    }, [local.window?.start]);

    // Chat functionality
    const handleSendMessage = async () => {
        if (!message.trim() || isAILoading) return;

        const userMessage: AIMessage = { role: 'user', content: message.trim() };
        const newChat = [...chat, userMessage];
        setChat(newChat);
        setMessage('');
        setIsAILoading(true);

        try {
            const contextText = aiService.extractContextText(local, local.window.start, local.window.end);
            const response = await aiService.chat(newChat, contextText);
            const assistantMessage: AIMessage = { role: 'assistant', content: response };
            setChat([...newChat, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: AIMessage = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please check your AI settings and try again.'
            };
            setChat([...newChat, errorMessage]);
        } finally {
            setIsAILoading(false);
        }
    };

    // Token confirmation helper
    const confirmAIAction = (action: string, promptText: string, onConfirm: () => Promise<void>): Promise<void> => {
        return new Promise((resolve) => {
            // Use chunked context for estimation to match what will actually be sent
            const contextText = aiService.extractContextTextChunked(local, local.window.start, local.window.end, 8000);
            const estimate = aiService.estimateRequestCost(contextText, promptText);

            // Auto-proceed for small requests (under $0.01)
            if (estimate.estimatedCost < 0.01) {
                onConfirm().then(resolve);
                return;
            }

            setTokenConfirm({
                isOpen: true,
                estimate,
                action,
                onConfirm: async () => {
                    await onConfirm();
                    resolve();
                }
            });
        });
    };

    const currentUpload = local.uploads?.[0];
    const currentPageText = (() => {
        if (!currentUpload?.pages) return '';
        return currentUpload.pages[currentDocumentPage - 1] || '';
    })();

    const saveCurrentPageText = (value: string) => {
        if (!currentUpload?.pages) return;
        const updatedUpload = { ...currentUpload, pages: [...currentUpload.pages] };
        updatedUpload.pages[currentDocumentPage - 1] = value;
        updateBook({ uploads: [updatedUpload] });
    };

    // Debounced cloud sync of sections
    const syncTimer = useRef<any>(null);
    const sectionsSignature = JSON.stringify(local.sections);
    useEffect(() => {
        if (!isSupabaseEnabled || !supabaseClient) return;
        supabaseClient.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
            if (!data.session) return;
            if (syncTimer.current) clearTimeout(syncTimer.current);
            syncTimer.current = setTimeout(async () => {
                try {
                    await fetch(`/api/books/${local.id}/sections`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sections: local.sections, window: local.window })
                    });
                } catch (e) {
                    console.warn('Cloud sync failed', e);
                }
            }, 1500);
        });
        return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sectionsSignature, local.window.start, local.window.end]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4">
            <div className="mx-auto max-w-[1800px]">
                {/* Header (corrected) */}
                <header className="mb-4">
                    <div className="flex flex-wrap items-center gap-4 mb-3">
                        <Link
                            href="/profile"
                            className="px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors font-medium shadow-sm text-sm"
                        >
                            ← Library
                        </Link>
                        <Link
                            href="/"
                            className="px-3 py-2 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors font-medium shadow-sm text-sm"
                        >
                            Home
                        </Link>
                        <div className="flex-1 min-w-[260px]">
                            {isEditingTitle ? (
                                <input
                                    autoFocus
                                    value={local.title}
                                    onChange={(e) => updateBook({ title: e.target.value })}
                                    onBlur={() => setIsEditingTitle(false)}
                                    className="px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full"
                                />
                            ) : (
                                <h1
                                    className="text-2xl md:text-3xl font-bold text-gray-900 cursor-text"
                                    onClick={() => setIsEditingTitle(true)}
                                    title="Click to edit title"
                                >
                                    {local.title}
                                </h1>
                            )}
                            <p className="text-gray-600 text-sm">Reading companion and notes</p>
                        </div>
                        {local.cover && (
                            <img src={local.cover} alt="Cover" className="h-16 w-12 object-cover rounded shadow border" />
                        )}
                        <div className="flex items-center gap-2">
                            <Tooltip text="Chat with AI" id="chat-toggle">
                                <Button
                                    onClick={() => setShowContextWindow(!showContextWindow)}
                                    variant="secondary"
                                    size="sm"
                                    className="p-2"
                                >
                                    <MessageSquareIcon size={20} />
                                </Button>
                            </Tooltip>
                            <Tooltip text="Settings" id="settings-button">
                                <Button onClick={() => setShowSettings(true)} variant="secondary" size="sm" className="p-2">
                                    <SettingsIcon size={20} />
                                </Button>
                            </Tooltip>

                            {/* Database Status Indicator */}
                            {isPersisting && (
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                    Saving...
                                </div>
                            )}
                            {lastSaved && !isPersisting && (
                                <div className="text-xs text-gray-400">
                                    Saved {lastSaved.toLocaleTimeString()}
                                </div>
                            )}
                            {persistError && (
                                <div className="text-xs text-red-500" title={persistError}>
                                    Save failed
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Removed inline reupload/cover inputs: now in Settings modal */}
                </header>

                {/* Split Layout */}
                <SplitLayout
                    leftPanel={
                        <div className="space-y-6">
                            {/* Context Window (collapsible) */}
                            {showContextWindow && (
                                <div className="rounded-xl border border-amber-200 p-6 bg-amber-50 shadow-lg">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-amber-100 rounded-lg">
                                            <MessageSquareIcon size={20} className="text-amber-700" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-amber-900">AI Chat & Context</h3>
                                        {/* Token budget removed from chat header for minimal UI */}
                                    </div>
                                    <ContextWindow
                                        window={local.window}
                                        pageCount={pageCount}
                                        book={local}
                                        onChange={handleContextWindowChange}
                                    />

                                    {/* Chat Messages */}
                                    <div className="mt-6 space-y-4 mb-4 max-h-64 overflow-y-auto">
                                        {chat.length === 0 && (
                                            <div className="text-center py-6 text-amber-700">
                                                <div className="text-3xl mb-3">🤖</div>
                                                <p className="font-medium">Ask me anything about your book!</p>
                                                <p className="text-sm opacity-75">I can only see pages {local.window.start}-{local.window.end}</p>
                                            </div>
                                        )}
                                        {chat.map((msg, i) => (
                                            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-sm p-3 rounded-lg ${msg.role === 'user'
                                                    ? 'bg-emerald-700 text-white'
                                                    : 'bg-white border border-amber-200'
                                                    }`}>
                                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Chat Input */}
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Ask about characters, plot, themes..."
                                            className="flex-1 px-4 py-3 border border-amber-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                            disabled={isAILoading}
                                        />
                                        <Button
                                            onClick={handleSendMessage}
                                            disabled={!message.trim() || isAILoading}
                                            isLoading={isAILoading}
                                            variant="primary"
                                            className="bg-emerald-700 hover:bg-emerald-800"
                                        >
                                            Send
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Main Content */}
                            <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-lg">
                                <TabNavigation activeTab={tab} onTabChange={setTab} />

                                <div className="mt-6">
                                    {tab === 'characters' && (
                                        <CharactersSection
                                            characters={local.sections.characters}
                                            onAddCharacter={addCharacter}
                                            onUpdateCharacter={updateCharacter}
                                            onDeleteCharacter={deleteCharacter}
                                            onGenerateCharacters={() => confirmAIAction(
                                                'generate characters',
                                                'Analyze the provided text and identify all characters mentioned',
                                                generateCharacters
                                            )}
                                            isGenerating={aiGenerationState.characters}
                                            isSaving={isPersisting}
                                            lastSaved={lastSaved}
                                            saveError={persistError}
                                        />
                                    )}

                                    {tab === 'chapters' && (
                                        <ChaptersSection
                                            chapters={local.sections.chapters}
                                            onAddChapter={addChapter}
                                            onUpdateChapter={updateChapter}
                                            onDeleteChapter={deleteChapter}
                                            onMoveChapter={moveChapter}
                                            onGenerateSummary={(chapterIndex) => confirmAIAction(
                                                'generate chapter summary',
                                                'Create a concise chapter summary for the provided text',
                                                () => generateChapterSummary(chapterIndex)
                                            )}
                                            isGenerating={aiGenerationState.chapters}
                                        />
                                    )}

                                    {tab === 'locations' && (
                                        <LocationsSection
                                            locations={local.sections.locations}
                                            onAddLocation={addLocation}
                                            onUpdateLocation={updateLocation}
                                            onDeleteLocation={deleteLocation}
                                            onGenerateLocations={() => confirmAIAction(
                                                'generate locations',
                                                'Analyze the provided text and identify all locations, places, and settings mentioned',
                                                generateLocations
                                            )}
                                            isGenerating={aiGenerationState.locations}
                                        />
                                    )}

                                    {tab === 'notes' && (
                                        <>
                                            {featureFlags.notesV2 ? (
                                                <NotesList
                                                    notes={bookNotes}
                                                    currentWindowEnd={local.window.end}
                                                    onAddNote={async (noteData) => {
                                                        await addNote({
                                                            ...noteData,
                                                            bookId: local.id
                                                        });
                                                    }}
                                                    onUpdateNote={updateNote}
                                                    onDeleteNote={deleteNote}
                                                    onReorderNotes={reorderNotes}
                                                    isLoading={notesLoading}
                                                    error={notesError}
                                                />
                                            ) : (
                                                <NotesSection
                                                    notes={local.sections.notes}
                                                    onAddNote={addBookNote}
                                                    onUpdateNote={updateBookNote}
                                                    onDeleteNote={deleteBookNote}
                                                    onGenerateNotes={() => confirmAIAction(
                                                        'generate notes',
                                                        'Create insightful reading notes for the provided text',
                                                        generateNotes
                                                    )}
                                                    isGenerating={aiGenerationState.notes}
                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            {isEditingPageText && currentUpload?.pages && (
                                <div className="rounded-xl border border-emerald-200 p-4 bg-emerald-50 shadow-inner">
                                    <h3 className="text-sm font-semibold text-emerald-800 mb-2">Editing Page {currentDocumentPage}</h3>
                                    <textarea
                                        value={currentPageText}
                                        onChange={(e) => saveCurrentPageText(e.target.value)}
                                        className="w-full h-48 border border-emerald-300 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                                    />
                                    <p className="text-xs text-emerald-700 mt-2">Changes affect AI context immediately (not persisted to original file).</p>
                                </div>
                            )}
                        </div>
                    }
                    rightPanel={
                        <DocumentViewer
                            book={{
                                uploads: local.uploads || []
                            }}
                            currentPage={currentDocumentPage}
                            onPageChange={(page) => setCurrentDocumentPage(page)}
                        />
                    }
                />
            </div>

            {/* Settings Modal */}
            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                book={local as any}
                onUpdate={(partial) => updateBook(partial as any)}
                onReupload={async (f) => { /* reuse logic by triggering existing handler */
                    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
                        const [pdfModule, storageModule] = await Promise.all([
                            import('../lib/pdf-utils'),
                            import('../lib/pdf-storage')
                        ]);
                        const pdfInfo = await pdfModule.PDFUtils.getPDFInfo(f);
                        let pages: string[] | undefined;
                        try { pages = await pdfModule.PDFUtils.extractAllPageTexts(f, { maxPages: pdfInfo.pageCount }); } catch { }
                        let indexedDBKey: string | undefined;
                        const generatedId = crypto.randomUUID();
                        try { await storageModule.pdfStorage.storePDF(generatedId, f.name, f); indexedDBKey = generatedId; } catch { }
                        const newUpload = { id: crypto.randomUUID(), filename: f.name, type: 'pdf' as const, pageCount: pdfInfo.pageCount, pages, indexedDBKey, uploadedAt: new Date() };
                        updateBook({ uploads: [newUpload], pages: pdfInfo.pageCount });
                    } else {
                        const text = await f.text();
                        const pagesArr: string[] = []; for (let i = 0; i < text.length; i += 1800) pagesArr.push(text.slice(i, i + 1800));
                        const newUpload = { id: crypto.randomUUID(), filename: f.name, type: 'text' as const, pageCount: pagesArr.length, pages: pagesArr, text, uploadedAt: new Date() };
                        updateBook({ uploads: [newUpload], pages: pagesArr.length });
                    }
                }}
                isEditingPageText={isEditingPageText}
                toggleEditingPageText={() => setIsEditingPageText(p => !p)}
                currentPage={currentDocumentPage}
                onDeleteBook={handleDeleteBook}
                isDeletingBook={isPersisting}
            />

            {/* Rate Limits Modal */}
            <RateLimitsModal
                isOpen={showRateLimits}
                onClose={() => setShowRateLimits(false)}
            />

            {/* Token Confirmation Dialog */}
            <TokenConfirmDialog
                isOpen={tokenConfirm.isOpen}
                onConfirm={() => {
                    setTokenConfirm({ ...tokenConfirm, isOpen: false });
                    tokenConfirm.onConfirm();
                }}
                onCancel={() => setTokenConfirm({ ...tokenConfirm, isOpen: false })}
                estimate={tokenConfirm.estimate!}
                action={tokenConfirm.action}
            />

            {/* Feature Flag Debug (dev only) */}
            <FeatureFlagDebug />
        </div>
    );
}
