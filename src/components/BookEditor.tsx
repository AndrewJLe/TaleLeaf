"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAIGeneration } from "../hooks/useAIGeneration";
import { useBookActions } from "../hooks/useBookActions";
import { useBookPersistence } from "../hooks/useBookPersistenceNew";
import { useBookTagGroups } from "../hooks/useBookTagGroups";
import { useNormalizedChapters, useNormalizedCharacters, useNormalizedLocations, useNormalizedNotes } from "../hooks/useNormalizedEntities";
import { AIMessage, aiService } from "../lib/ai-service";
import { supabaseClient } from "../lib/supabase-client";
import { BookEditorProps, TabType } from "../types/book";
import ContextWindow from "./ContextWindow";
import { FeatureFlagDebug } from "./FeatureFlagDebug";
import { AllNotesSection } from "./sections/AllNotesSection";
import { BaseEntityCard } from "./sections/BaseEntityCard";
import { ChaptersSection } from "./sections/ChaptersSection";
import { CharactersSection } from "./sections/CharactersSection";
import { LocationsSection } from "./sections/LocationsSection";
import { SettingsModal } from "./SettingsModal";
import { Button } from "./ui/Button";
import { DocumentViewer } from "./ui/DocumentViewer";
import { MessageSquareIcon, NotebookIcon, PlusIcon, SaveIcon, SettingsIcon, SparklesIcon, UndoIcon } from "./ui/Icons";
import { RateLimitsModal } from "./ui/RateLimitsModal";
import { SaveStatus } from "./ui/SaveStatus";
import { SplitLayout } from "./ui/SplitLayout";
import { TabNavigation } from "./ui/TabNavigation";
import { Toast, useToast } from "./ui/Toast";
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
    const [showRateLimits, setShowRateLimits] = useState(false);
    const [tab, setTab] = useState<TabType>('characters');
    const [currentDocumentPage, setCurrentDocumentPage] = useState(1);
    const [newNoteName, setNewNoteName] = useState('');
    // All Notes tab state
    const [allNotesUnsaved, setAllNotesUnsaved] = useState({ hasChanges: false, count: 0 });
    const allNotesSaveAllRef = useRef<(() => Promise<void>) | null>(null);
    const allNotesDiscardAllRef = useRef<(() => void) | null>(null);

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
    const contextWindowV2Enabled = !!supabaseClient;
    const [contextPrepStatus, setContextPrepStatus] = useState<'idle' | 'indexing' | 'ready' | 'error'>('idle');
    const [contextProgress, setContextProgress] = useState<{ processed: number; total: number } | null>(null);
    const [hasReadinessChecked, setHasReadinessChecked] = useState(!contextWindowV2Enabled);
    const isCheckingReadiness = contextWindowV2Enabled && !hasReadinessChecked;
    const isGateVisible = contextWindowV2Enabled && hasReadinessChecked && contextPrepStatus !== 'ready';
    const showChatContent = !contextWindowV2Enabled || (hasReadinessChecked && contextPrepStatus === 'ready');

    // Normalized entities
    const normalizedCharacters = useNormalizedCharacters(local.id, true);
    const normalizedChapters = useNormalizedChapters(local.id, true);
    const normalizedLocations = useNormalizedLocations(local.id, true);
    const normalizedNotes = useNormalizedNotes(local.id, true);

    const { tags: tagMetadata, groups: noteGroups, upsertTag, upsertGroup } = useBookTagGroups(local.id, true);
    const tagColorMap = React.useMemo(() => { const m: Record<string, string> = {}; tagMetadata.forEach(t => { m[t.name.toLowerCase()] = t.color; }); return m; }, [tagMetadata]);

    const { isLoading: isPersisting, error: persistError, saveBook, deleteBook, lastSaved } = useBookPersistence();

    const { addCharacter, updateCharacter, batchUpdateCharacters, deleteCharacter, moveCharacter, enhanceCharacter, generateCharacters, addChapter, updateChapter, batchUpdateChapters, deleteChapter, moveChapter, generateChapterSummary, addLocation, updateLocation, batchUpdateLocations, deleteLocation, moveLocation, generateLocations, addNote: addBookNote, updateNote: updateBookNote, batchUpdateNotes, deleteNote: deleteBookNote, moveNote, generateNotes, updateBook } = useBookActions(local, (updatedBook) => { setLocal(updatedBook); onUpdate(updatedBook); }, setGenerationLoading);

    const handleDeleteBook = async () => { try { await deleteBook(local.id); window.location.href = '/profile'; } catch (e) { console.error(e); } };

    useEffect(() => { const t = setTimeout(() => { saveBook(local).catch(e => console.error('Auto-save failed', e)); }, 2000); return () => clearTimeout(t); }, [local.title, local.window.start, local.window.end, local.cover, saveBook, local]);

    const pageCount = (() => { const upload = local.uploads?.[0]; return upload?.pageCount || local.pages || 300; })();
    const handleContextWindowChange = (start: number, end: number) => { updateBook({ window: { start, end } }); };
    useEffect(() => { if (local.window && typeof local.window.start === 'number') setCurrentDocumentPage(local.window.start); }, [local.window?.start]);

    const currentUpload = local.uploads?.[0];
    const currentPageText = currentUpload?.pages ? (currentUpload.pages[currentDocumentPage - 1] || '') : '';

    const fetchContextWindowPayload = useCallback(async (question: string) => {
        if (!contextWindowV2Enabled || !supabaseClient) return null;
        try {
            const session = await supabaseClient.auth.getSession();
            const token = session.data.session?.access_token;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`/api/books/${local.id}/context-window`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    question,
                    window: { type: 'pages', start: local.window.start, end: local.window.end },
                    maxContextTokens: 1800
                })
            });

            if (response.status === 202) {
                setContextPrepStatus('indexing');
                return null; // data still processing, fallback to legacy context
            }

            if (!response.ok) {
                console.warn('Context window request failed', await response.json().catch(() => null));
                setContextPrepStatus('error');
                return null;
            }

            const payload = await response.json();
            if (!payload?.ready || !payload.result?.systemPrompt) return null;
            setContextPrepStatus('ready');
            return payload;
        } catch (error) {
            console.warn('Context window fetch error', error);
            return null;
        }
    }, [contextWindowV2Enabled, local.id, local.window.start, local.window.end]);

    const triggerContextPreprocess = useCallback(async () => {
        if (!contextWindowV2Enabled || !supabaseClient) return;
        try {
            setContextPrepStatus('indexing');
            const session = await supabaseClient.auth.getSession();
            const token = session.data.session?.access_token;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`/api/books/${local.id}/context-preprocess`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ pages: currentUpload?.pages })
            });

            if (!response.ok) {
                console.warn('Context preprocess request failed', await response.json().catch(() => null));
                setContextPrepStatus('error');
                setContextProgress(null);
                setHasReadinessChecked(true);
                return;
            }

            const result = await response.json();
            if (result.status === 'done') {
                setContextPrepStatus('ready');
                if (typeof result.processedPages === 'number' && typeof result.totalPages === 'number') {
                    setContextProgress({ processed: result.processedPages, total: result.totalPages });
                } else {
                    setContextProgress(null);
                }
                setHasReadinessChecked(true);
            } else {
                setContextPrepStatus('error');
                setContextProgress(null);
                setHasReadinessChecked(true);
            }
        } catch (error) {
            console.warn('Context preprocess error', error);
            setContextPrepStatus('error');
            setContextProgress(null);
            setHasReadinessChecked(true);
        }
    }, [contextWindowV2Enabled, local.id, currentUpload?.pages]);

    useEffect(() => {
        if (!contextWindowV2Enabled || !supabaseClient) {
            setHasReadinessChecked(true);
            return;
        }

        let cancelled = false;
        setHasReadinessChecked(false);

        (async () => {
            try {
                const { count, error } = await supabaseClient
                    .from('book_page_chunks')
                    .select('id', { head: true, count: 'exact' })
                    .eq('book_id', local.id);

                if (cancelled) return;

                if (error) {
                    console.warn('Readiness check failed', error);
                    setContextPrepStatus('idle');
                    return;
                }

                if (typeof count === 'number' && count > 0) {
                    setContextPrepStatus('ready');
                } else {
                    setContextPrepStatus('idle');
                }
            } catch (err) {
                console.warn('Readiness check error', err);
                if (!cancelled) {
                    setContextPrepStatus('idle');
                }
            } finally {
                if (!cancelled) {
                    setHasReadinessChecked(true);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [contextWindowV2Enabled, supabaseClient, local.id]);

    const handleSendMessage = async () => {
        if (!message.trim() || isAILoading) return;
        const trimmed = message.trim();
        const userMessage: AIMessage = { role: 'user', content: trimmed };
        const newChat = [...chat, userMessage];
        setChat(newChat); setMessage(''); setIsAILoading(true);
        try {
            let systemPromptOverride: string | undefined;
            let contextText = '';
            if (contextWindowV2Enabled) {
                const payload = await fetchContextWindowPayload(trimmed);
                if (payload?.result?.systemPrompt) {
                    systemPromptOverride = payload.result.systemPrompt;
                } else {
                    contextText = aiService.extractContextText(local, local.window.start, local.window.end);
                }
            } else {
                contextText = aiService.extractContextText(local, local.window.start, local.window.end);
            }

            const response = await aiService.chat(newChat, contextText, { systemPromptOverride });
            setChat([...newChat, { role: 'assistant', content: response }]);
        } catch (error) {
            console.error('AI chat error', error);
            setChat([...newChat, { role: 'assistant', content: 'Sorry, I encountered an error. Please check your AI settings and try again.' }]);
        } finally {
            setIsAILoading(false);
        }
    };


    const saveCurrentPageText = (value: string) => { if (!currentUpload?.pages) return; const updatedUpload = { ...currentUpload, pages: [...currentUpload.pages] }; updatedUpload.pages[currentDocumentPage - 1] = value; updateBook({ uploads: [updatedUpload] }); };

    const handleCharactersUnsavedUpdate = useCallback((has: boolean, count: number) => setCharactersUnsaved({ hasChanges: has, count }), []);
    const handleChaptersUnsavedUpdate = useCallback((has: boolean, count: number) => setChaptersUnsaved({ hasChanges: has, count }), []);
    const handleLocationsUnsavedUpdate = useCallback((has: boolean, count: number) => setLocationsUnsaved({ hasChanges: has, count }), []);
    const handleAllNotesUnsavedUpdate = useCallback((has: boolean, count: number) => setAllNotesUnsaved({ hasChanges: has, count }), []);

    const [isEditingTitle, setIsEditingTitle] = useState(false);

    // Note editing state (similar to CharactersSection)
    const [editingNoteName, setEditingNoteName] = useState<Record<string, boolean>>({});
    const [noteNameDrafts, setNoteNameDrafts] = useState<Record<string, string>>({});
    const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
    const [dirtyNotes, setDirtyNotes] = useState<Record<string, boolean>>({});
    const [savingNotesStates, setSavingNotesStates] = useState<Record<string, boolean>>({});
    const [showSavedNotesStates, setShowSavedNotesStates] = useState<Record<string, boolean>>({});

    // Note editing handlers
    const handleNoteNotesChange = (note: any, notes: string) => {
        setNoteDrafts(prev => ({ ...prev, [note.id]: notes }));
        setDirtyNotes(prev => ({
            ...prev,
            [note.id]: notes !== note.body
        }));
    };

    const getDisplayValue = (note: any): string => {
        return noteDrafts[note.id] ?? note.body ?? '';
    };

    // Save individual note
    const handleSaveNote = async (note: any) => {
        if (!dirtyNotes[note.id]) return;

        setSavingNotesStates(prev => ({ ...prev, [note.id]: true }));
        setShowSavedNotesStates(prev => ({ ...prev, [note.id]: false }));

        try {
            // Ensure minimum 800ms for better UX perception
            await Promise.all([
                normalizedNotes.update(note.id, {
                    body: noteDrafts[note.id]
                }),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);

            // Clear draft and mark as clean
            setNoteDrafts(prev => {
                const { [note.id]: _, ...rest } = prev;
                return rest;
            });
            setDirtyNotes(prev => ({ ...prev, [note.id]: false }));
            setShowSavedNotesStates(prev => ({ ...prev, [note.id]: true }));

            // Hide the "saved" indicator after 2 seconds
            setTimeout(() => {
                setShowSavedNotesStates(prev => ({ ...prev, [note.id]: false }));
            }, 2000);
        } catch (error) {
            console.error('Failed to save note:', error);
        } finally {
            setSavingNotesStates(prev => ({ ...prev, [note.id]: false }));
        }
    };

    // Clean up drafts when notes are removed
    useEffect(() => {
        const currentIds = new Set(normalizedNotes.items.map(n => n.id));
        setNoteDrafts(prev => {
            const cleaned = { ...prev };
            Object.keys(cleaned).forEach(id => {
                if (!currentIds.has(id)) {
                    delete cleaned[id];
                }
            });
            return cleaned;
        });
        setDirtyNotes(prev => {
            const cleaned = { ...prev };
            Object.keys(cleaned).forEach(id => {
                if (!currentIds.has(id)) {
                    delete cleaned[id];
                }
            });
            return cleaned;
        });
    }, [normalizedNotes.items]);

    // Track dirty notes count for tab indicator
    const dirtyNotesCount = Object.values(dirtyNotes).filter(Boolean).length;

    // Save all dirty notes
    const handleSaveAllNotes = async () => {
        const dirtyIds = Object.keys(dirtyNotes).filter(id => dirtyNotes[id]);
        if (dirtyIds.length === 0) return;

        // Set all dirty notes to saving state
        setSavingNotesStates(prev => {
            const newStates = { ...prev };
            dirtyIds.forEach(id => { newStates[id] = true; });
            return newStates;
        });

        try {
            // Save all dirty notes
            for (const id of dirtyIds) {
                const draftText = noteDrafts[id];
                if (draftText !== undefined) {
                    await normalizedNotes.update(id, { body: draftText });
                }
            }

            // Wait a bit for save to complete
            await new Promise(resolve => setTimeout(resolve, 800));

            // Clear all drafts and mark as clean
            setNoteDrafts(prev => {
                const newDrafts = { ...prev };
                dirtyIds.forEach(id => { delete newDrafts[id]; });
                return newDrafts;
            });
            setDirtyNotes(prev => {
                const newDirty = { ...prev };
                dirtyIds.forEach(id => { newDirty[id] = false; });
                return newDirty;
            });
            setShowSavedNotesStates(prev => {
                const newStates = { ...prev };
                dirtyIds.forEach(id => { newStates[id] = true; });
                return newStates;
            });

            // Hide saved indicators after 2 seconds
            setTimeout(() => {
                setShowSavedNotesStates(prev => {
                    const newStates = { ...prev };
                    dirtyIds.forEach(id => { newStates[id] = false; });
                    return newStates;
                });
            }, 2000);

        } catch (error) {
            console.error('Failed to save notes:', error);
        } finally {
            setSavingNotesStates(prev => {
                const newStates = { ...prev };
                dirtyIds.forEach(id => { newStates[id] = false; });
                return newStates;
            });
        }
    };

    // Discard all note changes
    const handleDiscardAllNotes = () => {
        const dirtyIds = Object.keys(dirtyNotes).filter(id => dirtyNotes[id]);

        // Clear all drafts and mark as clean
        setNoteDrafts(prev => {
            const newDrafts = { ...prev };
            dirtyIds.forEach(id => { delete newDrafts[id]; });
            return newDrafts;
        });
        setDirtyNotes(prev => {
            const newDirty = { ...prev };
            dirtyIds.forEach(id => { newDirty[id] = false; });
            return newDirty;
        });
    };

    // Tab save/discard handlers (after state variables are defined)
    const handleTabSaveChanges = useCallback(async (t: TabType) => {
        if (t === 'characters' && charactersSaveAllRef.current) return charactersSaveAllRef.current();
        if (t === 'chapters' && chaptersSaveAllRef.current) return chaptersSaveAllRef.current();
        if (t === 'locations' && locationsSaveAllRef.current) return locationsSaveAllRef.current();
        if (t === 'notes') return handleSaveAllNotes();
        if (t === 'all-notes' && allNotesSaveAllRef.current) return allNotesSaveAllRef.current();
    }, [handleSaveAllNotes]);

    const handleTabDiscardChanges = useCallback((t: TabType) => {
        if (t === 'characters') charactersDiscardAllRef.current?.();
        if (t === 'chapters') chaptersDiscardAllRef.current?.();
        if (t === 'locations') locationsDiscardAllRef.current?.();
        if (t === 'notes') handleDiscardAllNotes();
        if (t === 'all-notes') allNotesDiscardAllRef.current?.();
    }, [handleDiscardAllNotes]);

    // Undo toast integration for soft-deleted entities
    const { toast, showToast, hideToast } = useToast();
    useEffect(() => {
        const sources: { label: string; lastRemoved?: any; undo?: () => Promise<boolean> }[] = [
            { label: 'Character', lastRemoved: normalizedCharacters.lastRemoved, undo: normalizedCharacters.undoRemove },
            { label: 'Chapter', lastRemoved: normalizedChapters.lastRemoved, undo: normalizedChapters.undoRemove },
            { label: 'Location', lastRemoved: normalizedLocations.lastRemoved, undo: normalizedLocations.undoRemove },
            { label: 'Note', lastRemoved: normalizedNotes.lastRemoved, undo: normalizedNotes.undoRemove }
        ];
        for (const src of sources) {
            if (src.lastRemoved) {
                showToast({
                    message: `${src.label} deleted.`,
                    type: 'info',
                    actionLabel: 'Undo',
                    duration: 8000,
                    onAction: async () => { await src.undo?.(); }
                });
                break; // show only one at a time
            }
        }
    }, [normalizedCharacters.lastRemoved, normalizedChapters.lastRemoved, normalizedLocations.lastRemoved, normalizedNotes.lastRemoved]);

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
                            <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-lg">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-emerald-50 rounded-lg"><MessageSquareIcon size={20} className="text-emerald-700" /></div>
                                    <h3 className="text-lg font-semibold text-gray-900">AI Chat & Context</h3>
                                </div>
                                {contextWindowV2Enabled ? (
                                    <div className="mt-4 text-xs flex flex-col gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-4">
                                        {isCheckingReadiness && (
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <span className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
                                                <span>Checking whether TaleLeaf has already read this book…</span>
                                            </div>
                                        )}
                                        {isGateVisible && (
                                            <>
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-medium text-slate-800">Let TaleLeaf read this book first.</p>
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        className="text-xs px-3"
                                                        disabled={contextPrepStatus === 'indexing'}
                                                        onClick={() => {
                                                            setContextProgress(null);
                                                            void triggerContextPreprocess();
                                                        }}
                                                    >
                                                        {contextPrepStatus === 'indexing' ? 'Reading…' : 'Read this book'}
                                                    </Button>
                                                </div>
                                                {contextPrepStatus === 'indexing' && (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                                                            <span className="text-[11px] text-slate-600">TaleLeaf is reading your selected pages so answers stay in-window.</span>
                                                        </div>
                                                        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden shadow-inner">
                                                            <div
                                                                className="h-full bg-emerald-500 transition-all duration-500"
                                                                style={{ width: contextProgress && contextProgress.total > 0 ? `${Math.min(100, Math.max(0, (contextProgress.processed / contextProgress.total) * 100))}%` : '20%' }}
                                                            />
                                                        </div>
                                                        {contextProgress && contextProgress.total > 0 && (
                                                            <p className="text-[11px] text-slate-500">{contextProgress.processed}/{contextProgress.total} batches processed.</p>
                                                        )}
                                                    </div>
                                                )}
                                                {contextPrepStatus === 'idle' && (
                                                    <p className="text-[11px] text-slate-600">Once TaleLeaf reads this range, answers will stay within your selected pages.</p>
                                                )}
                                                {contextPrepStatus === 'error' && (
                                                    <p className="text-[11px] text-rose-700">There was a problem reading the book. Try again in a moment.</p>
                                                )}
                                            </>
                                        )}
                                        {!isCheckingReadiness && contextPrepStatus === 'ready' && (
                                            <div className="flex items-center gap-2 text-emerald-700">
                                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">✓</span>
                                                <span>TaleLeaf has finished reading this book and is ready for questions.</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                                        Connect Supabase to enable richer retrieval. We will still use your selected pages locally.
                                    </div>
                                )}
                                {showChatContent && (
                                    <>
                                        <div className="mt-4">
                                            <ContextWindow window={local.window} pageCount={pageCount} onChange={handleContextWindowChange} />
                                        </div>
                                        <div className="mt-6 space-y-4 mb-4 max-h-64 overflow-y-auto bg-white/60 rounded-lg">
                                            {chat.length === 0 && (
                                                <div className="text-center py-6 text-slate-600">
                                                    <div className="text-3xl mb-3">🤖</div>
                                                    <p className="text-sm font-medium">Ask me anything about your book.</p>
                                                    <p className="text-xs text-slate-500 mt-1">I can only see pages {local.window.start}-{local.window.end}</p>
                                                </div>
                                            )}
                                            {chat.map((msg, i) => (
                                                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-sm p-3 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200'}`}>
                                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-3 mt-2">
                                            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask about characters, plot, themes..." className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white" onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} disabled={isAILoading} />
                                            <Button onClick={handleSendMessage} disabled={!message.trim() || isAILoading} isLoading={isAILoading} variant="primary" className="bg-emerald-700 hover:bg-emerald-800">Send</Button>
                                        </div>
                                    </>
                                )}
                            </div>


                            <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-lg">
                                <TabNavigation
                                    activeTab={tab}
                                    onTabChange={setTab}
                                    unsavedChanges={{
                                        characters: charactersUnsaved,
                                        chapters: chaptersUnsaved,
                                        locations: locationsUnsaved,
                                        notes: { hasChanges: dirtyNotesCount > 0, count: dirtyNotesCount },
                                        'all-notes': allNotesUnsaved
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
                                            onMoveCharacter={async (index, direction) => {
                                                const ordered = [...normalizedCharacters.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                                                const item = normalizedCharacters.items[index];
                                                const sortedIndex = ordered.findIndex(c => c.id === item.id);
                                                const swapIndex = direction === 'up' ? sortedIndex - 1 : sortedIndex + 1;
                                                if (swapIndex < 0 || swapIndex >= ordered.length) return;
                                                // Create reordered list using fast reorder method
                                                const reorderedIds = [...ordered];
                                                [reorderedIds[sortedIndex], reorderedIds[swapIndex]] = [reorderedIds[swapIndex], reorderedIds[sortedIndex]];
                                                await normalizedCharacters.reorder(reorderedIds.map(item => item.id));
                                            }}
                                            onGenerateCharacters={() => generateCharacters()}
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
                                            onMoveChapter={async (index, direction) => {
                                                const ordered = [...normalizedChapters.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                                                const item = normalizedChapters.items[index];
                                                const sortedIndex = ordered.findIndex(c => c.id === item.id);
                                                const swapIndex = direction === 'up' ? sortedIndex - 1 : sortedIndex + 1;
                                                if (swapIndex < 0 || swapIndex >= ordered.length) return;
                                                // Create reordered list using fast reorder method
                                                const reorderedIds = [...ordered];
                                                [reorderedIds[sortedIndex], reorderedIds[swapIndex]] = [reorderedIds[swapIndex], reorderedIds[sortedIndex]];
                                                await normalizedChapters.reorder(reorderedIds.map(item => item.id));
                                            }}
                                            onGenerateSummary={(chapterIndex) => generateChapterSummary(chapterIndex)}
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
                                            onMoveLocation={async (index, direction) => {
                                                const ordered = [...normalizedLocations.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                                                const item = normalizedLocations.items[index];
                                                const sortedIndex = ordered.findIndex(c => c.id === item.id);
                                                const swapIndex = direction === 'up' ? sortedIndex - 1 : sortedIndex + 1;
                                                if (swapIndex < 0 || swapIndex >= ordered.length) return;
                                                // Create reordered list using fast reorder method
                                                const reorderedIds = [...ordered];
                                                [reorderedIds[sortedIndex], reorderedIds[swapIndex]] = [reorderedIds[swapIndex], reorderedIds[sortedIndex]];
                                                await normalizedLocations.reorder(reorderedIds.map(item => item.id));
                                            }}
                                            onGenerateLocations={() => generateLocations()}
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
                                        <div className="space-y-6">
                                            <div className="p-4 sm:p-6 bg-gray-50 rounded-xl border border-gray-200">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
                                                            <NotebookIcon size={20} className="text-orange-600" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-lg font-semibold text-gray-900">Notes ({normalizedNotes.items.length})</h4>
                                                            <SaveStatus isSaving={isPersisting} lastSaved={lastSaved} error={persistError} className="mt-0.5" />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {dirtyNotesCount > 0 && (
                                                            <>
                                                                <Button
                                                                    onClick={handleSaveAllNotes}
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                                                >
                                                                    <SaveIcon size={14} />
                                                                    Save All ({dirtyNotesCount})
                                                                </Button>
                                                                <Button
                                                                    onClick={handleDiscardAllNotes}
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    className="bg-gray-600 text-white hover:bg-gray-700"
                                                                >
                                                                    <UndoIcon size={14} />
                                                                    Discard All
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Tooltip
                                                            text="Use AI to automatically generate notes from your selected text"
                                                            id="notes-ai-generate"
                                                        >
                                                            <Button
                                                                onClick={() => generateNotes()}
                                                                isLoading={aiGenerationState.notes}
                                                                variant="primary"
                                                                className="w-full sm:w-auto"
                                                            >
                                                                <SparklesIcon size={16} />
                                                                {aiGenerationState.notes ? 'Generating...' : 'AI Generate'}
                                                            </Button>
                                                        </Tooltip>
                                                    </div>
                                                </div>

                                                {/* Manual Add Note */}
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <input
                                                        type="text"
                                                        value={newNoteName}
                                                        onChange={(e) => setNewNoteName(e.target.value)}
                                                        placeholder="Note title..."
                                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                                                        onKeyPress={(e) => {
                                                            if (e.key === 'Enter') {
                                                                normalizedNotes.create({
                                                                    title: newNoteName.trim() || `Note ${normalizedNotes.items.length + 1}`,
                                                                    body: '',
                                                                    tags: [],
                                                                    position: normalizedNotes.items.length * 1000,
                                                                    spoilerProtected: false,
                                                                    minVisiblePage: undefined,
                                                                    groupId: null
                                                                });
                                                                setNewNoteName('');
                                                            }
                                                        }}
                                                    />
                                                    <Tooltip
                                                        text="Add a new note to your book"
                                                        id="add-note-button"
                                                    >
                                                        <Button
                                                            onClick={() => {
                                                                normalizedNotes.create({
                                                                    title: newNoteName.trim() || `Note ${normalizedNotes.items.length + 1}`,
                                                                    body: '',
                                                                    tags: [],
                                                                    position: normalizedNotes.items.length * 1000,
                                                                    spoilerProtected: false,
                                                                    minVisiblePage: undefined,
                                                                    groupId: null
                                                                });
                                                                setNewNoteName('');
                                                            }}
                                                            variant="primary"
                                                            className="w-full sm:w-auto"
                                                        >
                                                            <PlusIcon size={16} />
                                                            Add Note
                                                        </Button>
                                                    </Tooltip>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {normalizedNotes.items.map((note, index) => {
                                                    // Convert BookNote to BaseEntity format
                                                    const noteEntity = {
                                                        id: note.id,
                                                        name: note.title || `Note ${index + 1}`,
                                                        notes: note.body || '',
                                                        tags: note.tags || []
                                                    };

                                                    return (
                                                        <BaseEntityCard
                                                            key={note.id}
                                                            entity={noteEntity}
                                                            index={index}
                                                            totalCount={normalizedNotes.items.length}
                                                            config={{
                                                                entityType: 'note',
                                                                icon: NotebookIcon,
                                                                iconColor: 'orange',
                                                                gradientFrom: 'orange',
                                                                nameEditMode: 'pencil',
                                                                placeholder: 'Write your note content here...'
                                                            }}
                                                            displayValue={getDisplayValue(note)}
                                                            isDirty={dirtyNotes[note.id] || false}
                                                            isSaving={savingNotesStates[note.id] || false}
                                                            showSaved={showSavedNotesStates[note.id] || false}
                                                            onUpdateEntity={(_, updated: any) => {
                                                                normalizedNotes.update(note.id, {
                                                                    title: updated.name,
                                                                    body: updated.notes,
                                                                    tags: updated.tags
                                                                });
                                                            }}
                                                            onNotesChange={handleNoteNotesChange}
                                                            onSave={handleSaveNote}
                                                            onCancel={(note) => {
                                                                setNoteDrafts(prev => {
                                                                    const { [note.id]: _, ...rest } = prev;
                                                                    return rest;
                                                                });
                                                                setDirtyNotes(prev => ({ ...prev, [note.id]: false }));
                                                            }}
                                                            onDelete={() => normalizedNotes.remove(note.id)}
                                                            onMove={async (index: number, direction: 'up' | 'down') => {
                                                                const ordered = [...normalizedNotes.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                                                                const item = normalizedNotes.items[index];
                                                                const sortedIndex = ordered.findIndex(c => c.id === item.id);
                                                                const swapIndex = direction === 'up' ? sortedIndex - 1 : sortedIndex + 1;
                                                                if (swapIndex < 0 || swapIndex >= ordered.length) return;
                                                                const reorderedIds = [...ordered];
                                                                [reorderedIds[sortedIndex], reorderedIds[swapIndex]] = [reorderedIds[swapIndex], reorderedIds[sortedIndex]];
                                                                await normalizedNotes.reorder(reorderedIds.map(item => item.id));
                                                            }}
                                                            editingName={editingNoteName[note.id] || false}
                                                            nameDraft={noteNameDrafts[note.id] ?? (note.title || `Note ${index + 1}`)}
                                                            onStartNameEdit={() => {
                                                                setNoteNameDrafts(prev => ({ ...prev, [note.id]: note.title || `Note ${index + 1}` }));
                                                                setEditingNoteName(prev => ({ ...prev, [note.id]: true }));
                                                            }}
                                                            onNameChange={(name) => setNoteNameDrafts(prev => ({ ...prev, [note.id]: name }))}
                                                            onFinishNameEdit={(save) => {
                                                                if (save) {
                                                                    const newName = noteNameDrafts[note.id];
                                                                    if (newName !== undefined && newName !== note.title) {
                                                                        normalizedNotes.update(note.id, { title: newName });
                                                                    }
                                                                }
                                                                setEditingNoteName(prev => ({ ...prev, [note.id]: false }));
                                                                setNoteNameDrafts(prev => { const copy = { ...prev }; delete copy[note.id]; return copy; });
                                                            }}
                                                            tagColorMap={tagColorMap}
                                                            onPersistTagColor={upsertTag}
                                                        />
                                                    );
                                                })}

                                                {normalizedNotes.items.length === 0 && (
                                                    <div className="text-center py-12 text-gray-500">
                                                        <div className="mb-4 flex justify-center">
                                                            <NotebookIcon size={64} strokeWidth={1} className="text-gray-300" />
                                                        </div>
                                                        <p className="text-lg font-medium text-gray-700">No notes yet</p>
                                                        <p className="text-sm text-gray-500">Add your first note above or use AI Generate</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {tab === 'all-notes' && (
                                        <AllNotesSection
                                            headerSaving={isPersisting}
                                            lastSaved={lastSaved}
                                            saveError={persistError}
                                            characters={normalizedCharacters as any}
                                            chapters={normalizedChapters as any}
                                            locations={normalizedLocations as any}
                                            notes={normalizedNotes as any}
                                            tagColorMap={tagColorMap}
                                            onPersistTagColor={upsertTag}
                                            onUnsavedChangesUpdate={handleAllNotesUnsavedUpdate}
                                            onSaveAllRef={allNotesSaveAllRef}
                                            onDiscardAllRef={allNotesDiscardAllRef}
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
            <Toast
                message={toast.message}
                isVisible={toast.isVisible}
                onHide={hideToast}
                type={toast.type}
                duration={toast.duration}
                actionLabel={toast.actionLabel}
                onAction={toast.onAction}
            />
            <FeatureFlagDebug />
        </div>
    );
}
