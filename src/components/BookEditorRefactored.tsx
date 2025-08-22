"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookEditorProps, TabType } from "../types/book";
import { useExpandableFields } from "../hooks/useExpandableFields";
import { useAIGeneration } from "../hooks/useAIGeneration";
import { useBookActions } from "../hooks/useBookActions";
import { TabNavigation } from "./ui/TabNavigation";
import { CharactersSection } from "./sections/CharactersSection";
import { ChaptersSection } from "./sections/ChaptersSection";
import { LocationsSection } from "./sections/LocationsSection";
import { NotesSection } from "./sections/NotesSection";
import ContextWindow from "./ContextWindow";
import AISettingsModal from "./AISettingsModal";
import { Tooltip } from "./ui/Tooltip";
import { Button } from "./ui/Button";
import { aiService, AIMessage } from "../lib/ai-service";

export default function BookEditor({ book, onUpdate }: BookEditorProps) {
    const [local, setLocal] = useState(book);
    const [message, setMessage] = useState("");
    const [chat, setChat] = useState<AIMessage[]>([]);
    const [tab, setTab] = useState<TabType>('characters');
    const [showAISettings, setShowAISettings] = useState(false);

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

    // Context window management
    const pageCount = local.pages ?? (local.uploads?.[0]?.pages?.length ?? 300);

    const handleContextWindowChange = (start: number, end: number) => {
        updateBook({ window: { start, end } });
    };

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-amber-50/30 p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <Link
                            href="/"
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                        >
                            ← Back to Library
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-emerald-900">{local.title}</h1>
                            <p className="text-emerald-700">Reading companion and notes</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Context Window */}
                    <div className="lg:col-span-1">
                        <div className="rounded-xl border border-emerald-200 p-6 bg-gradient-to-br from-emerald-50 to-green-50/50 shadow-lg sticky top-4">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">📖</span>
                                </div>
                                <h3 className="text-lg font-semibold text-emerald-900">Reading Context</h3>
                            </div>
                            <ContextWindow
                                window={local.window}
                                pageCount={pageCount}
                                onChange={handleContextWindowChange}
                            />
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Book Analysis Island */}
                        <section className="rounded-xl border border-emerald-200 p-6 bg-gradient-to-br from-white to-emerald-50/30 shadow-lg">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">📚</span>
                                </div>
                                <h3 className="text-lg font-semibold text-emerald-900">Book Analysis</h3>
                            </div>

                            <TabNavigation activeTab={tab} onTabChange={setTab} />

                            {tab === 'characters' && (
                                <CharactersSection
                                    characters={local.sections.characters}
                                    onAddCharacter={addCharacter}
                                    onUpdateCharacter={updateCharacter}
                                    onDeleteCharacter={deleteCharacter}
                                    onEnhanceCharacter={enhanceCharacter}
                                    onGenerateCharacters={generateCharacters}
                                    isGenerating={aiGenerationState.characters}
                                />
                            )}

                            {tab === 'chapters' && (
                                <ChaptersSection
                                    chapters={local.sections.chapters}
                                    onAddChapter={addChapter}
                                    onUpdateChapter={updateChapter}
                                    onDeleteChapter={deleteChapter}
                                    onMoveChapter={moveChapter}
                                    onGenerateSummary={generateChapterSummary}
                                    isGenerating={aiGenerationState.chapters}
                                />
                            )}

                            {tab === 'locations' && (
                                <LocationsSection
                                    locations={local.sections.locations}
                                    onAddLocation={addLocation}
                                    onUpdateLocation={updateLocation}
                                    onDeleteLocation={deleteLocation}
                                    onGenerateLocations={generateLocations}
                                    isGenerating={aiGenerationState.locations}
                                />
                            )}

                            {tab === 'notes' && (
                                <NotesSection
                                    notes={local.sections.notes}
                                    onUpdateNotes={updateNotes}
                                    onGenerateNotes={generateNotes}
                                    isGenerating={aiGenerationState.notes}
                                />
                            )}
                        </section>

                        {/* Chat Island */}
                        <section className="rounded-xl border border-amber-200 p-6 bg-gradient-to-br from-amber-50 to-orange-50/50 shadow-lg">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">💬</span>
                                </div>
                                <h3 className="text-lg font-semibold text-amber-900">AI Assistant</h3>
                                <div className="flex-1"></div>
                                <Tooltip
                                    text="Configure AI providers and API settings for content generation"
                                    id="ai-settings-button"
                                >
                                    <Button
                                        onClick={() => setShowAISettings(true)}
                                        variant="secondary"
                                        size="sm"
                                    >
                                        ⚙️ Settings
                                    </Button>
                                </Tooltip>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-full">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs font-medium text-amber-700">Online</span>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                                {chat.length === 0 && (
                                    <div className="text-center py-8 text-amber-600">
                                        <div className="text-4xl mb-3">🤖</div>
                                        <p className="font-medium">Ask me anything about your book!</p>
                                        <p className="text-sm opacity-75">I can only see pages {local.window.start}-{local.window.end}</p>
                                    </div>
                                )}
                                {chat.map((msg, i) => (
                                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-sm p-3 rounded-lg ${msg.role === 'user'
                                            ? 'bg-amber-600 text-white'
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
                                    className="flex-1 px-4 py-3 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    disabled={isAILoading}
                                />
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={!message.trim() || isAILoading}
                                    isLoading={isAILoading}
                                    variant="primary"
                                >
                                    Send
                                </Button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            {/* AI Settings Modal */}
            <AISettingsModal
                isOpen={showAISettings}
                onClose={() => setShowAISettings(false)}
            />
        </div>
    );
}
