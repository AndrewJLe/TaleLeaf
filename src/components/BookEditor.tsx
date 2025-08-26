"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAIGeneration } from "../hooks/useAIGeneration";
import { useBookActions } from "../hooks/useBookActions";
import { useBookNotes } from "../hooks/useBookNotes";
import { useBookPersistence } from "../hooks/useBookPersistenceNew";
import { useBookTagGroups } from "../hooks/useBookTagGroups";
import { useNormalizedChapters, useNormalizedCharacters, useNormalizedLocations } from "../hooks/useNormalizedEntities";
import { AIMessage, aiService, TokenEstimate } from "../lib/ai-service";
import { BookEditorProps, TabType } from "../types/book";
import ContextWindow from "./ContextWindow";
import { ChaptersSection } from "./sections/ChaptersSection";
import { CharactersSection } from "./sections/CharactersSection";
import { LocationsSection } from "./sections/LocationsSection";
import { NotesNormalizedSection } from "./sections/NotesNormalizedSection";
import { SettingsModal } from "./SettingsModal";
import { Button } from "./ui/Button";
import { DocumentViewer } from "./ui/DocumentViewer";
import { MessageSquareIcon, SettingsIcon } from "./ui/Icons";
import { RateLimitsModal } from "./ui/RateLimitsModal";
import { SplitLayout } from "./ui/SplitLayout";
import { TabNavigation } from "./ui/TabNavigation";
import { TokenConfirmDialog } from "./ui/TokenConfirmDialog";
import { Tooltip } from "./ui/Tooltip";

export default function BookEditor({ book, onUpdate }: BookEditorProps) {
    const [local, setLocal] = useState(() => {
        const migratedBook = { ...book };
        if (typeof migratedBook.sections.notes === 'string') {
            const oldNotes = migratedBook.sections.notes;
            migratedBook.sections.notes = oldNotes
                ? [{ id: crypto.randomUUID(), name: 'General Notes', notes: oldNotes, tags: [] }]
                : [];
        }
        migratedBook.sections.characters = migratedBook.sections.characters.map(c => ({ ...c, id: c.id || crypto.randomUUID() }));
        migratedBook.sections.chapters = migratedBook.sections.chapters.map(c => ({ ...c, id: c.id || crypto.randomUUID() }));
        migratedBook.sections.locations = migratedBook.sections.locations.map(c => ({ ...c, id: c.id || crypto.randomUUID() }));
        migratedBook.sections.notes = migratedBook.sections.notes.map(n => ({ ...n, id: n.id || crypto.randomUUID() }));
        return migratedBook;
    });

    const [message, setMessage] = useState("");
    const [chat, setChat] = useState<AIMessage[]>([]);
    const [isEditingPageText, setIsEditingPageText] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const searchParams = useSearchParams();
    useEffect(() => { if (searchParams?.get('edit') === '1') setShowSettings(true); }, [searchParams]);
    const [showContextWindow, setShowContextWindow] = useState(false);
    const [showRateLimits, setShowRateLimits] = useState(false);
    const [tab, setTab] = useState<TabType>('characters');
    const [currentDocumentPage, setCurrentDocumentPage] = useState(1);

    // Unsaved state tracking
    // With normalized immediate persistence, treat unsaved as always clean (legacy draft system retained only for notes V1)
    const [charactersUnsaved, setCharactersUnsaved] = useState({ hasChanges: false, count: 0 });
    const [chaptersUnsaved, setChaptersUnsaved] = useState({ hasChanges: false, count: 0 });
    const [locationsUnsaved, setLocationsUnsaved] = useState({ hasChanges: false, count: 0 });
    // Notes unsaved state comes from normalized hook

    // Save/Discard refs now no-ops for normalized entities
    const charactersSaveAllRef = useRef<(() => Promise<void>) | null>(null);
    const charactersDiscardAllRef = useRef<(() => void) | null>(null);
    const chaptersSaveAllRef = useRef<(() => Promise<void>) | null>(null);
    const chaptersDiscardAllRef = useRef<(() => void) | null>(null);
    const locationsSaveAllRef = useRef<(() => Promise<void>) | null>(null);
    const locationsDiscardAllRef = useRef<(() => void) | null>(null);
    const notesSaveAllRef = useRef<(() => Promise<void>) | null>(null);
    const notesDiscardAllRef = useRef<(() => void) | null>(null);

    const { aiGenerationState, isAILoading, setIsAILoading, setGenerationLoading } = useAIGeneration();

    // Normalized notes
    const { notes: bookNotes, isLoading: notesLoading, error: notesError, addNote, updateNote, deleteNote, reorderNotes, updateDraft, cancelNote, saveNote, saveAllNotes, discardAllChanges, dirtyNoteIds, hasUnsavedChanges, immediateUpdateNote } = useBookNotes(local.id, true);

    const { tags: tagMetadata, groups: noteGroups, upsertTag, upsertGroup } = useBookTagGroups(local.id, true);
    const tagColorMap = React.useMemo(() => { const m: Record<string, string> = {}; tagMetadata.forEach(t => { m[t.name.toLowerCase()] = t.color; }); return m; }, [tagMetadata]);

    // Normalized mode always on
    const normalizedCharacters = useNormalizedCharacters(local.id, true);
    const normalizedChapters = useNormalizedChapters(local.id, true);
    const normalizedLocations = useNormalizedLocations(local.id, true);

    const { isLoading: isPersisting, error: persistError, saveBook, deleteBook, lastSaved } = useBookPersistence();

    const { addCharacter, updateCharacter, batchUpdateCharacters, deleteCharacter, moveCharacter, enhanceCharacter, generateCharacters, addChapter, updateChapter, batchUpdateChapters, deleteChapter, moveChapter, generateChapterSummary, addLocation, updateLocation, batchUpdateLocations, deleteLocation, moveLocation, generateLocations, addNote: addBookNote, updateNote: updateBookNote, batchUpdateNotes, deleteNote: deleteBookNote, moveNote, generateNotes, updateBook } = useBookActions(local, (updatedBook) => { setLocal(updatedBook); onUpdate(updatedBook); }, setGenerationLoading);

    const handleDeleteBook = async () => { try { await deleteBook(local.id); window.location.href = '/profile'; } catch (e) { console.error(e); } };

    useEffect(() => { const t = setTimeout(() => { saveBook(local).catch(e => console.error('Auto-save failed', e)); }, 2000); return () => clearTimeout(t); }, [local.title, local.window.start, local.window.end, local.cover, saveBook, local]);

    const pageCount = (() => { const upload = local.uploads?.[0]; return upload?.pageCount || local.pages || 300; })();
    const handleContextWindowChange = (start: number, end: number) => { updateBook({ window: { start, end } }); };
    useEffect(() => { if (local.window && typeof local.window.start === 'number') setCurrentDocumentPage(local.window.start); }, [local.window?.start]);

    const handleSendMessage = async () => {
        if (!message.trim() || isAILoading) return;
        const userMessage: AIMessage = { role: 'user', content: message.trim() };
        const newChat = [...chat, userMessage];
        setChat(newChat); setMessage(''); setIsAILoading(true);
        try { const contextText = aiService.extractContextText(local, local.window.start, local.window.end); const response = await aiService.chat(newChat, contextText); setChat([...newChat, { role: 'assistant', content: response }]); } catch { setChat([...newChat, { role: 'assistant', content: 'Sorry, I encountered an error. Please check your AI settings and try again.' }]); } finally { setIsAILoading(false); }
    };

    const confirmAIAction = (action: string, promptText: string, onConfirm: () => Promise<void>): Promise<void> => new Promise(resolve => {
        const contextText = aiService.extractContextTextChunked(local, local.window.start, local.window.end, 8000);
        const estimate = aiService.estimateRequestCost(contextText, promptText);
        if (estimate.estimatedCost < 0.01) { onConfirm().then(resolve); return; }
        setTokenConfirm({ isOpen: true, estimate, action, onConfirm: async () => { await onConfirm(); resolve(); } });
    });

    const currentUpload = local.uploads?.[0];
    const currentPageText = currentUpload?.pages ? (currentUpload.pages[currentDocumentPage - 1] || '') : '';
    const saveCurrentPageText = (value: string) => { if (!currentUpload?.pages) return; const updatedUpload = { ...currentUpload, pages: [...currentUpload.pages] }; updatedUpload.pages[currentDocumentPage - 1] = value; updateBook({ uploads: [updatedUpload] }); };

    // Removed legacy sections sync (fully normalized)

    const handleTabSaveChanges = useCallback(async (t: TabType) => {
        if (t === 'characters' && charactersSaveAllRef.current) return charactersSaveAllRef.current();
        if (t === 'chapters' && chaptersSaveAllRef.current) return chaptersSaveAllRef.current();
        if (t === 'locations' && locationsSaveAllRef.current) return locationsSaveAllRef.current();
        if (t === 'notes') return saveAllNotes();
    }, [saveAllNotes]);
    const handleTabDiscardChanges = useCallback((t: TabType) => {
        if (t === 'characters') charactersDiscardAllRef.current?.();
        if (t === 'chapters') chaptersDiscardAllRef.current?.();
        if (t === 'locations') locationsDiscardAllRef.current?.();
        if (t === 'notes') discardAllChanges();
    }, [discardAllChanges]);

    const handleCharactersUnsavedUpdate = useCallback((has: boolean, count: number) => setCharactersUnsaved({ hasChanges: has, count }), []);
    const handleChaptersUnsavedUpdate = useCallback((has: boolean, count: number) => setChaptersUnsaved({ hasChanges: has, count }), []);
    const handleLocationsUnsavedUpdate = useCallback((has: boolean, count: number) => setLocationsUnsaved({ hasChanges: has, count }), []);
    // Legacy notes unsaved updates handled inline in NotesSection usage

    const [tokenConfirm, setTokenConfirm] = useState<{ isOpen: boolean; estimate: TokenEstimate | null; action: string; onConfirm: () => void | Promise<void>; }>({ isOpen: false, estimate: null, action: '', onConfirm: () => { } });
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4">
            <div className="mx-auto max-w-[1800px]">
                <header className="mb-4">
                    <div className="flex flex-wrap items-center gap-4 mb-3">
                        <Link href="/profile" className="px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors font-medium shadow-sm text-sm">← Library</Link>
                        <Link href="/" className="px-3 py-2 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors font-medium shadow-sm text-sm">Home</Link>
                        <div className="flex-1 min-w-[260px]">
                            {isEditingTitle ? (
                                <input autoFocus value={local.title} onChange={(e) => updateBook({ title: e.target.value })} onBlur={() => setIsEditingTitle(false)} className="px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full" />
                            ) : (
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 cursor-text" onClick={() => setIsEditingTitle(true)} title="Click to edit title">{local.title}</h1>
                            )}
                            <p className="text-gray-600 text-sm">Reading companion and notes</p>
                        </div>
                        {local.cover && <img src={local.cover} alt="Cover" className="h-16 w-12 object-cover rounded shadow border" />}
                        <div className="flex items-center gap-2">
                            <Tooltip text="Chat with AI" id="chat-toggle"><Button onClick={() => setShowContextWindow(!showContextWindow)} variant="secondary" size="sm" className="p-2"><MessageSquareIcon size={20} /></Button></Tooltip>
                            <Tooltip text="Settings" id="settings-button"><Button onClick={() => setShowSettings(true)} variant="secondary" size="sm" className="p-2"><SettingsIcon size={20} /></Button></Tooltip>
                            {isPersisting && <div className="text-xs text-gray-500 flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>Saving...</div>}
                            {lastSaved && !isPersisting && <div className="text-xs text-gray-400">Saved {lastSaved.toLocaleTimeString()}</div>}
                            {persistError && <div className="text-xs text-red-500" title={persistError}>Save failed</div>}
                        </div>
                    </div>
                </header>

                <SplitLayout
                    leftPanel={
                        <div className="space-y-6">
                            {showContextWindow && (
                                <div className="rounded-xl border border-amber-200 p-6 bg-amber-50 shadow-lg">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-amber-100 rounded-lg"><MessageSquareIcon size={20} className="text-amber-700" /></div>
                                        <h3 className="text-lg font-semibold text-amber-900">AI Chat & Context</h3>
                                    </div>
                                    <ContextWindow window={local.window} pageCount={pageCount} book={local} onChange={handleContextWindowChange} />
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
                                                <div className={`max-w-sm p-3 rounded-lg ${msg.role === 'user' ? 'bg-emerald-700 text-white' : 'bg-white border border-amber-200'}`}>
                                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-3">
                                        <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask about characters, plot, themes..." className="flex-1 px-4 py-3 border border-amber-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent" onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} disabled={isAILoading} />
                                        <Button onClick={handleSendMessage} disabled={!message.trim() || isAILoading} isLoading={isAILoading} variant="primary" className="bg-emerald-700 hover:bg-emerald-800">Send</Button>
                                    </div>
                                </div>
                            )}

                            <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-lg">
                                <TabNavigation
                                    activeTab={tab}
                                    onTabChange={setTab}
                                    unsavedChanges={{
                                        characters: charactersUnsaved,
                                        chapters: chaptersUnsaved,
                                        locations: locationsUnsaved,
                                        notes: { hasChanges: hasUnsavedChanges, count: dirtyNoteIds.length }
                                    }}
                                    onSaveChanges={handleTabSaveChanges}
                                    onDiscardChanges={handleTabDiscardChanges}
                                />
                                <div className="mt-6">
                                    {tab === 'characters' && (
                                        <CharactersSection
                                            characters={normalizedCharacters.items as any}
                                            onAddCharacter={(c) => { normalizedCharacters.create(c as any); }}
                                            onUpdateCharacter={(_, updated) => { normalizedCharacters.update(updated.id, updated as any); }}
                                            onBatchUpdateCharacters={async (chars) => { await Promise.all(chars.map(c => normalizedCharacters.update(c.id, c as any))); }}
                                            onDeleteCharacter={(index) => { const target = normalizedCharacters.items[index]; if (target) normalizedCharacters.remove(target.id); }}
                                            onMoveCharacter={() => { /* TODO: implement position reorder for normalized characters */ }}
                                            onGenerateCharacters={() => confirmAIAction('generate characters', 'Analyze the provided text and identified all characters mentioned', generateCharacters)}
                                            onUnsavedChangesUpdate={handleCharactersUnsavedUpdate}
                                            onSaveAllRef={charactersSaveAllRef}
                                            onDiscardAllRef={charactersDiscardAllRef}
                                            isGenerating={aiGenerationState.characters}
                                            isSaving={isPersisting}
                                            lastSaved={lastSaved}
                                            saveError={persistError}
                                            tagColorMap={tagColorMap}
                                            onPersistTagColor={upsertTag}
                                        />
                                    )}
                                    {tab === 'chapters' && (
                                        <ChaptersSection
                                            chapters={normalizedChapters.items as any}
                                            onAddChapter={(c) => { normalizedChapters.create(c as any); }}
                                            onUpdateChapter={(_, updated) => { normalizedChapters.update((updated as any).id, updated as any); }}
                                            onDeleteChapter={(index) => { const target = normalizedChapters.items[index]; if (target) normalizedChapters.remove(target.id); }}
                                            onMoveChapter={() => { /* TODO: implement position reorder for chapters */ }}
                                            onGenerateSummary={(chapterIndex) => confirmAIAction('generate chapter summary', 'Create a concise chapter summary for the provided text', () => generateChapterSummary(chapterIndex))}
                                            onBatchUpdateChapters={async (chapters) => { await Promise.all(chapters.map(ch => normalizedChapters.update((ch as any).id, ch as any))); }}
                                            onUnsavedChangesUpdate={handleChaptersUnsavedUpdate}
                                            onSaveAllRef={chaptersSaveAllRef}
                                            onDiscardAllRef={chaptersDiscardAllRef}
                                            isGenerating={aiGenerationState.chapters}
                                            isSaving={isPersisting}
                                            lastSaved={lastSaved}
                                            saveError={persistError}
                                            tagColorMap={tagColorMap}
                                            onPersistTagColor={upsertTag}
                                        />
                                    )}
                                    {tab === 'locations' && (
                                        <LocationsSection
                                            locations={normalizedLocations.items as any}
                                            onAddLocation={(c) => { normalizedLocations.create(c as any); }}
                                            onUpdateLocation={(_, updated) => { normalizedLocations.update(updated.id, updated as any); }}
                                            onDeleteLocation={(index) => { const target = normalizedLocations.items[index]; if (target) normalizedLocations.remove(target.id); }}
                                            onMoveLocation={() => { /* TODO: implement position reorder for locations */ }}
                                            onGenerateLocations={() => confirmAIAction('generate locations', 'Analyze the provided text and identify all locations, places, and settings mentioned', generateLocations)}
                                            onBatchUpdateLocations={async (locs) => { await Promise.all(locs.map(l => normalizedLocations.update(l.id, l as any))); }}
                                            onUnsavedChangesUpdate={handleLocationsUnsavedUpdate}
                                            onSaveAllRef={locationsSaveAllRef}
                                            onDiscardAllRef={locationsDiscardAllRef}
                                            isGenerating={aiGenerationState.locations}
                                            isSaving={isPersisting}
                                            lastSaved={lastSaved}
                                            saveError={persistError}
                                            tagColorMap={tagColorMap}
                                            onPersistTagColor={upsertTag}
                                        />
                                    )}
                                    {tab === 'notes' && (
                                        <NotesNormalizedSection
                                            notes={bookNotes}
                                            currentWindowEnd={local.window.end}
                                            addNote={addNote}
                                            updateDraft={updateDraft}
                                            saveNote={saveNote}
                                            cancelNote={cancelNote}
                                            deleteNote={deleteNote}
                                            reorderNotes={reorderNotes}
                                            saveAllNotes={saveAllNotes}
                                            discardAllChanges={discardAllChanges}
                                            dirtyNoteIds={dirtyNoteIds}
                                            hasUnsavedChanges={hasUnsavedChanges}
                                            isLoading={notesLoading}
                                            error={notesError}
                                            tagColorMap={tagColorMap}
                                            onPersistTagColor={upsertTag}
                                            immediateUpdateNote={immediateUpdateNote}
                                            onUnsavedChangesUpdate={() => { /* hook already supplies counts */ }}
                                            onSaveAllRef={notesSaveAllRef}
                                            onDiscardAllRef={notesDiscardAllRef}
                                        />
                                    )}
                                </div>
                            </div>

                            {isEditingPageText && currentUpload?.pages && (
                                <div className="rounded-xl border border-emerald-200 p-4 bg-emerald-50 shadow-inner">
                                    <h3 className="text-sm font-semibold text-emerald-800 mb-2">Editing Page {currentDocumentPage}</h3>
                                    <textarea value={currentPageText} onChange={(e) => saveCurrentPageText(e.target.value)} className="w-full h-48 border border-emerald-300 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white" />
                                    <p className="text-xs text-emerald-700 mt-2">Changes affect AI context immediately (not persisted to original file).</p>
                                </div>
                            )}
                        </div>
                    }
                    rightPanel={
                        <DocumentViewer
                            book={{ uploads: local.uploads || [] }}
                            currentPage={currentDocumentPage}
                            onPageChange={(page) => setCurrentDocumentPage(page)}
                        />
                    }
                />
            </div>

            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                book={local as any}
                onUpdate={(partial) => updateBook(partial as any)}
                onReupload={async (f) => {
                    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
                        const [pdfModule, storageModule] = await Promise.all([
                            import('../lib/pdf-utils'),
                            import('../lib/pdf-storage')
                        ]);
                        const pdfInfo = await pdfModule.PDFUtils.getPDFInfo(f);
                        let pages: string[] | undefined; try { pages = await pdfModule.PDFUtils.extractAllPageTexts(f, { maxPages: pdfInfo.pageCount }); } catch { }
                        let indexedDBKey: string | undefined; const generatedId = crypto.randomUUID();
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

            <RateLimitsModal isOpen={showRateLimits} onClose={() => setShowRateLimits(false)} />
            <TokenConfirmDialog
                isOpen={tokenConfirm.isOpen}
                onConfirm={() => { setTokenConfirm({ ...tokenConfirm, isOpen: false }); tokenConfirm.onConfirm(); }}
                onCancel={() => setTokenConfirm({ ...tokenConfirm, isOpen: false })}
                estimate={tokenConfirm.estimate!}
                action={tokenConfirm.action}
            />
            {/* FeatureFlagDebug removed */}
        </div>
    );
}
