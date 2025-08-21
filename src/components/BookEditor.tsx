"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import ContextWindow from "./ContextWindow";
import AISettingsModal from "./AISettingsModal";
import { aiService, AIMessage } from "../lib/ai-service";

export default function BookEditor({ book, onUpdate }: any) {
    const [local, setLocal] = useState(book);
    const [message, setMessage] = useState("");
    const [chat, setChat] = useState<AIMessage[]>([]);
    const [tab, setTab] = useState<'characters' | 'chapters' | 'locations' | 'notes'>('characters');
    const [showAISettings, setShowAISettings] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);

    // Determine page count from uploads if present
    const pageCount = local.pages ?? (local.uploads?.[0]?.pages?.length ?? 300);

    function updateWindow(start: number, end: number) {
        // clamp
        start = Math.max(1, Math.min(start, pageCount));
        end = Math.max(1, Math.min(end, pageCount));
        if (start > end) start = end;
        const updated = { ...local, window: { start, end } };
        setLocal(updated);
        onUpdate(updated);
    }

    // Characters management
    const [newCharacterName, setNewCharacterName] = useState("");
    const dragIndex = useRef<number | null>(null);

    function addCharacter() {
        if (!newCharacterName.trim()) return;
        const sections = { ...local.sections, characters: [...local.sections.characters, { name: newCharacterName.trim(), notes: "" }] };
        const updated = { ...local, sections };
        setLocal(updated);
        onUpdate(updated);
        setNewCharacterName("");
    }

    function updateCharacter(i: number, patch: Partial<any>) {
        const chars = [...local.sections.characters];
        chars[i] = { ...chars[i], ...patch };
        const sections = { ...local.sections, characters: chars };
        const updated = { ...local, sections };
        setLocal(updated);
        onUpdate(updated);
    }

    function onDragStart(i: number) {
        dragIndex.current = i;
    }

    function onDropTo(i: number) {
        const from = dragIndex.current;
        if (from === null || from === undefined) return;
        const chars = [...local.sections.characters];
        const [item] = chars.splice(from, 1);
        chars.splice(i, 0, item);
        dragIndex.current = null;
        const sections = { ...local.sections, characters: chars };
        const updated = { ...local, sections };
        setLocal(updated);
        onUpdate(updated);
    }

    // Chapters management
    const [newChapterName, setNewChapterName] = useState("");
    const [editingChapterIndex, setEditingChapterIndex] = useState<number | null>(null);

    async function handleAsk() {
        if (!message.trim()) return;

        const userMessage: AIMessage = { role: 'user', content: message.trim() };
        setChat(c => [...c, userMessage]);
        setMessage("");
        setIsAILoading(true);

        try {
            // Extract context text from the current window
            const contextText = aiService.extractContextText(local, local.window.start, local.window.end);

            // Get AI response
            const response = await aiService.chat([...chat, userMessage], contextText);

            const assistantMessage: AIMessage = { role: 'assistant', content: response };
            setChat(c => [...c, assistantMessage]);
        } catch (error) {
            console.error('AI Error:', error);
            const errorMessage: AIMessage = {
                role: 'assistant',
                content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.'
            };
            setChat(c => [...c, errorMessage]);
        } finally {
            setIsAILoading(false);
        }
    }
    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Navigation Header */}
            <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-emerald-200 shadow-sm">
                <Link href="/" className="flex items-center gap-3 hover:scale-105 transition-transform duration-200">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                            <span className="text-white text-lg">🍃</span>
                        </div>
                        <div>
                            <div className="text-lg font-bold text-emerald-900">TaleLeaf</div>
                            <div className="text-xs text-emerald-600">Your reading garden</div>
                        </div>
                    </div>
                </Link>

                <div className="flex items-center gap-3">
                    <Link
                        href="/profile"
                        className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg font-medium hover:bg-amber-200 hover:scale-105 transition-all duration-200 border border-amber-300"
                    >
                        📚 Library
                    </Link>
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-emerald-700">Reading {local.title}</span>
                    </div>
                </div>
            </div>

            {/* Book Header Island */}
            <div className="rounded-xl border border-emerald-200 p-6 bg-gradient-to-br from-white to-emerald-50/30 shadow-lg">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-6">
                        {local.cover && (
                            <div className="relative group">
                                <img src={local.cover} alt="cover" className="w-24 h-32 object-cover rounded-lg shadow-md transition-transform group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold text-amber-900 tracking-tight">{local.title}</h2>
                            <div className="flex items-center gap-4 text-sm text-amber-700">
                                <span className="flex items-center gap-1">
                                    📖 {local.pages} pages
                                </span>
                                <span className="w-1 h-1 bg-amber-400 rounded-full"></span>
                                <span>Created {new Date(local.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 rounded-full">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-emerald-700">Active</span>
                    </div>
                </div>
            </div>

            {/* Context Window Island */}
            <div className="rounded-xl border border-amber-200 p-6 bg-gradient-to-br from-amber-50 to-orange-50/50 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">📊</span>
                    </div>
                    <h3 className="text-lg font-semibold text-amber-900">Reading Context</h3>
                </div>
                <ContextWindow window={local.window} pageCount={pageCount} onChange={updateWindow} />
            </div>

            {/* Sections Island */}
            <div className="rounded-xl border border-emerald-200 p-6 bg-gradient-to-br from-white to-emerald-50/30 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">📝</span>
                    </div>
                    <h3 className="text-lg font-semibold text-emerald-900">Book Sections</h3>
                </div>

                <nav className="mb-6">
                    <div className="flex gap-2 p-1 bg-emerald-100/50 rounded-lg">
                        <button
                            className={`px-4 py-2.5 rounded-md font-medium transition-all duration-200 transform ${tab === 'characters'
                                ? 'bg-emerald-600 text-white shadow-md scale-105'
                                : 'text-emerald-700 hover:bg-emerald-200/50 hover:scale-102'
                                }`}
                            onClick={() => setTab('characters')}
                        >
                            👥 Characters
                        </button>
                        <button
                            className={`px-4 py-2.5 rounded-md font-medium transition-all duration-200 transform ${tab === 'chapters'
                                ? 'bg-emerald-600 text-white shadow-md scale-105'
                                : 'text-emerald-700 hover:bg-emerald-200/50 hover:scale-102'
                                }`}
                            onClick={() => setTab('chapters')}
                        >
                            📚 Chapters
                        </button>
                        <button
                            className={`px-4 py-2.5 rounded-md font-medium transition-all duration-200 transform ${tab === 'locations'
                                ? 'bg-emerald-600 text-white shadow-md scale-105'
                                : 'text-emerald-700 hover:bg-emerald-200/50 hover:scale-102'
                                }`}
                            onClick={() => setTab('locations')}
                        >
                            🗺️ Locations
                        </button>
                        <button
                            className={`px-4 py-2.5 rounded-md font-medium transition-all duration-200 transform ${tab === 'notes'
                                ? 'bg-emerald-600 text-white shadow-md scale-105'
                                : 'text-emerald-700 hover:bg-emerald-200/50 hover:scale-102'
                                }`}
                            onClick={() => setTab('notes')}
                        >
                            📓 Notes
                        </button>
                    </div>
                </nav>

                <section className="min-h-[400px]">
                    {tab === 'characters' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                <h4 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                                    👥 Characters ({local.sections.characters.length})
                                </h4>
                                <div className="flex gap-3">
                                    <input
                                        value={newCharacterName}
                                        onChange={(e) => setNewCharacterName(e.target.value)}
                                        placeholder="Character name..."
                                        className="px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                        onKeyPress={(e) => e.key === 'Enter' && addCharacter()}
                                    />
                                    <button
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg"
                                        onClick={addCharacter}
                                    >
                                        ✨ Add
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {local.sections.characters.map((c: any, i: number) => (
                                    <div
                                        key={i}
                                        draggable
                                        onDragStart={() => onDragStart(i)}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => onDropTo(i)}
                                        className="group p-4 bg-white border border-emerald-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-move hover:border-emerald-300"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                                                <span className="text-emerald-600 text-sm">⋮⋮</span>
                                            </div>
                                            <div className="flex-1 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <h5 className="font-semibold text-amber-900 text-lg">{c.name}</h5>
                                                    <button
                                                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105"
                                                        onClick={() => {
                                                            const chars = [...local.sections.characters];
                                                            chars.splice(i, 1);
                                                            const sections = { ...local.sections, characters: chars };
                                                            const updated = { ...local, sections };
                                                            setLocal(updated);
                                                            onUpdate(updated);
                                                        }}
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                                <textarea
                                                    value={c.notes}
                                                    onChange={(e) => updateCharacter(i, { notes: e.target.value })}
                                                    placeholder="Notes about this character..."
                                                    className="w-full p-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {local.sections.characters.length === 0 && (
                                    <div className="text-center py-12 text-emerald-600">
                                        <div className="text-6xl mb-4">👥</div>
                                        <p className="text-lg font-medium">No characters yet</p>
                                        <p className="text-sm opacity-75">Add your first character above</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'chapters' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                <h4 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                                    📚 Chapters ({local.sections.chapters.length})
                                </h4>
                                <div className="flex gap-3">
                                    <input
                                        value={newChapterName}
                                        onChange={(e) => setNewChapterName(e.target.value)}
                                        placeholder="Chapter title..."
                                        className="px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                        onKeyPress={(e) => e.key === 'Enter' && newChapterName.trim() && (() => {
                                            const chapters = [...local.sections.chapters, { name: newChapterName.trim(), notes: "" }];
                                            const sections = { ...local.sections, chapters };
                                            const updated = { ...local, sections };
                                            setLocal(updated);
                                            onUpdate(updated);
                                            setNewChapterName("");
                                        })()}
                                    />
                                    <button
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg"
                                        onClick={() => {
                                            if (!newChapterName.trim()) return;
                                            const chapters = [...local.sections.chapters, { name: newChapterName.trim(), notes: "" }];
                                            const sections = { ...local.sections, chapters };
                                            const updated = { ...local, sections };
                                            setLocal(updated);
                                            onUpdate(updated);
                                            setNewChapterName("");
                                        }}
                                    >
                                        ✨ Add Chapter
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {local.sections.chapters.map((ch: any, i: number) => (
                                    <div key={i} className="p-4 bg-white border border-emerald-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                                                    {i + 1}
                                                </div>
                                                <h5
                                                    className="font-semibold text-amber-900 text-lg cursor-pointer hover:text-amber-700 transition-colors"
                                                    onClick={() => setEditingChapterIndex(editingChapterIndex === i ? null : i)}
                                                >
                                                    {ch.name}
                                                </h5>
                                                {editingChapterIndex !== i && (
                                                    <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                                                        Click to edit notes
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-md transition-all duration-200 hover:scale-110 disabled:opacity-50"
                                                    onClick={() => {
                                                        if (i === 0) return;
                                                        const chapters = [...local.sections.chapters];
                                                        const [item] = chapters.splice(i, 1);
                                                        chapters.splice(i - 1, 0, item);
                                                        const sections = { ...local.sections, chapters };
                                                        const updated = { ...local, sections };
                                                        setLocal(updated);
                                                        onUpdate(updated);
                                                    }}
                                                    disabled={i === 0}
                                                >
                                                    ⬆️
                                                </button>
                                                <button
                                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-md transition-all duration-200 hover:scale-110 disabled:opacity-50"
                                                    onClick={() => {
                                                        if (i === local.sections.chapters.length - 1) return;
                                                        const chapters = [...local.sections.chapters];
                                                        const [item] = chapters.splice(i, 1);
                                                        chapters.splice(i + 1, 0, item);
                                                        const sections = { ...local.sections, chapters };
                                                        const updated = { ...local, sections };
                                                        setLocal(updated);
                                                        onUpdate(updated);
                                                    }}
                                                    disabled={i === local.sections.chapters.length - 1}
                                                >
                                                    ⬇️
                                                </button>
                                                <button
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-all duration-200 hover:scale-110"
                                                    onClick={() => {
                                                        const chapters = [...local.sections.chapters];
                                                        chapters.splice(i, 1);
                                                        const sections = { ...local.sections, chapters };
                                                        const updated = { ...local, sections };
                                                        setLocal(updated);
                                                        onUpdate(updated);
                                                    }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                        {editingChapterIndex === i && (
                                            <div className="mt-4">
                                                <textarea
                                                    value={ch.notes}
                                                    onChange={(e) => {
                                                        const chapters = [...local.sections.chapters];
                                                        chapters[i] = { ...chapters[i], notes: e.target.value };
                                                        const sections = { ...local.sections, chapters };
                                                        const updated = { ...local, sections };
                                                        setLocal(updated);
                                                        onUpdate(updated);
                                                    }}
                                                    className="w-full p-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                                                    placeholder="Chapter summary and notes..."
                                                    rows={4}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {local.sections.chapters.length === 0 && (
                                    <div className="text-center py-12 text-emerald-600">
                                        <div className="text-6xl mb-4">📚</div>
                                        <p className="text-lg font-medium">No chapters yet</p>
                                        <p className="text-sm opacity-75">Add your first chapter above</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'locations' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                <h4 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                                    🗺️ Locations ({local.sections.locations.length})
                                </h4>
                            </div>
                            <div className="space-y-3">
                                {local.sections.locations.map((l: any, i: number) => (
                                    <div key={i} className="p-4 bg-white border border-emerald-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                                        {l}
                                    </div>
                                ))}
                                {local.sections.locations.length === 0 && (
                                    <div className="text-center py-12 text-emerald-600">
                                        <div className="text-6xl mb-4">🗺️</div>
                                        <p className="text-lg font-medium">No locations yet</p>
                                        <p className="text-sm opacity-75">Locations will appear here as you add them</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'notes' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                <h4 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                                    📓 General Notes
                                </h4>
                            </div>
                            <div className="text-center py-12 text-emerald-600">
                                <div className="text-6xl mb-4">📓</div>
                                <p className="text-lg font-medium">Notes section coming soon</p>
                                <p className="text-sm opacity-75">This will be a space for general book notes</p>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* Chat Island */}
            <div className="rounded-xl border border-amber-200 p-6 bg-gradient-to-br from-amber-50 to-orange-50/50 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">🤖</span>
                    </div>
                    <h3 className="text-lg font-semibold text-amber-900">AI Assistant</h3>
                    <div className="flex-1"></div>
                    <button
                        onClick={() => setShowAISettings(true)}
                        className="px-3 py-1.5 bg-amber-200 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-300 transition-colors"
                        title="AI Settings"
                    >
                        ⚙️ Settings
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-amber-700">Online</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="h-64 overflow-auto p-4 bg-white/50 rounded-lg border border-amber-200 backdrop-blur-sm">
                        {chat.length === 0 && (
                            <div className="text-center py-8 text-amber-600">
                                <div className="text-4xl mb-4">💬</div>
                                <p className="font-medium">Ready to help!</p>
                                <p className="text-sm opacity-75">Ask me anything about pages {local.window.start}-{local.window.end}</p>
                            </div>
                        )}
                        {chat.map((m, i) => (
                            <div key={i} className={`mb-4 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-lg ${m.role === 'user'
                                        ? 'bg-emerald-600 text-white rounded-br-sm'
                                        : 'bg-white border border-amber-200 text-amber-900 rounded-bl-sm'
                                    }`}>
                                    <div className="text-xs opacity-75 mb-1">
                                        {m.role === 'user' ? 'You' : 'AI Assistant'}
                                    </div>
                                    <div>{m.content}</div>
                                </div>
                            </div>
                        ))}
                        {isAILoading && (
                            <div className="mb-4 flex justify-start">
                                <div className="max-w-[80%] p-3 rounded-lg bg-white border border-amber-200 text-amber-900 rounded-bl-sm">
                                    <div className="text-xs opacity-75 mb-1">AI Assistant</div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        <span className="text-sm">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="flex-1 px-4 py-3 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                            placeholder={`Ask about pages ${local.window.start}-${local.window.end}...`}
                            onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
                        />
                        <button
                            className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50"
                            onClick={handleAsk}
                            disabled={isAILoading}
                        >
                            💫 Ask
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Settings Modal */}
            <AISettingsModal isOpen={showAISettings} onClose={() => setShowAISettings(false)} />
        </div>
    );
}
