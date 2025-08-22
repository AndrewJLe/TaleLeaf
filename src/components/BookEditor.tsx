"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAIGeneration } from "../hooks/useAIGeneration";
import { useBookActions } from "../hooks/useBookActions";
import { useExpandableFields } from "../hooks/useExpandableFields";
import { AIMessage, aiService, TokenEstimate } from "../lib/ai-service";
import { BookEditorProps, TabType } from "../types/book";
import AISettingsModal from "./AISettingsModal";
import ContextWindow from "./ContextWindow";
import { ChaptersSection } from "./sections/ChaptersSection";
import { CharactersSection } from "./sections/CharactersSection";
import { LocationsSection } from "./sections/LocationsSection";
import { NotesSection } from "./sections/NotesSection";
import { Button } from "./ui/Button";
import { DocumentViewer } from "./ui/DocumentViewer";
import { MessageSquareIcon, SettingsIcon } from "./ui/Icons";
// Rate limit display intentionally omitted for a minimal UI
import { RateLimitsModal } from "./ui/RateLimitsModal";
import { SplitLayout } from "./ui/SplitLayout";
import { TabNavigation } from "./ui/TabNavigation";
// Token budget display intentionally omitted from header for minimal UI
import { TokenConfirmDialog } from "./ui/TokenConfirmDialog";
import { Tooltip } from "./ui/Tooltip";

export default function BookEditor({ book, onUpdate }: BookEditorProps) {
    const [local, setLocal] = useState(book);
    const [message, setMessage] = useState("");
    const [chat, setChat] = useState<AIMessage[]>([]);
    const [tab, setTab] = useState<TabType>('characters');
    const [showAISettings, setShowAISettings] = useState(false);
    const [showContextWindow, setShowContextWindow] = useState(false);
    const [showRateLimits, setShowRateLimits] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
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

    // Custom hooks for state management
    const { isExpanded, toggleExpanded } = useExpandableFields();
    const {
        aiGenerationState,
        isAILoading,
        setIsAILoading,
        setGenerationLoading
    } = useAIGeneration();

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
        updateNotes,
        generateNotes,
        updateBook
    } = useBookActions(local, (updatedBook) => {
        setLocal(updatedBook);
        onUpdate(updatedBook);
    }, setGenerationLoading);

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="mb-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Link
                            href="/"
                            className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors font-medium shadow-sm"
                        >
                            ← Back to Library
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-gray-900">{local.title}</h1>
                            <p className="text-gray-600">Reading companion and notes</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Rate limit and token budget indicators removed to keep header minimal */}
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
                            <Tooltip text="AI Settings" id="settings-button">
                                <Button
                                    onClick={() => setShowAISettings(true)}
                                    variant="secondary"
                                    size="sm"
                                    className="p-2"
                                >
                                    <SettingsIcon size={20} />
                                </Button>
                            </Tooltip>
                        </div>
                    </div>
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
                                            characters={local.sections.characters.map((char, index) => ({
                                                id: index.toString(),
                                                name: char.name,
                                                description: char.notes
                                            }))}
                                            isGeneratingCharacter={aiGenerationState.characters}
                                            expandedCharacters={local.sections.characters.reduce((acc, char, index) => ({
                                                ...acc,
                                                [index.toString()]: isExpanded(index.toString())
                                            }), {})}
                                            toggleCharacterExpansion={(id) => toggleExpanded(id)}
                                            updateCharacter={(id, field, value) => {
                                                const index = parseInt(id);
                                                const character = local.sections.characters[index];
                                                if (field === 'name') {
                                                    updateCharacter(index, { ...character, name: value });
                                                } else if (field === 'description') {
                                                    updateCharacter(index, { ...character, notes: value });
                                                }
                                            }}
                                            deleteCharacter={(id) => deleteCharacter(parseInt(id))}
                                            addCharacter={() => addCharacter({ name: '', notes: '' })}
                                            generateCharacter={() => confirmAIAction(
                                                'generate characters',
                                                'Analyze the provided text and identify all characters mentioned',
                                                generateCharacters
                                            )}
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
                                        <NotesSection
                                            notes={local.sections.notes}
                                            onUpdateNotes={updateNotes}
                                            onGenerateNotes={() => confirmAIAction(
                                                'generate notes',
                                                'Create insightful reading notes for the provided text',
                                                generateNotes
                                            )}
                                            isGenerating={aiGenerationState.notes}
                                        />
                                    )}
                                </div>
                            </div>
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

            {/* AI Settings Modal */}
            <AISettingsModal
                isOpen={showAISettings}
                onClose={() => setShowAISettings(false)}
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
        </div>
    );
}
