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
    const [aiGenerationState, setAiGenerationState] = useState({
        characters: false,
        chapters: false,
        locations: false,
        notes: false
    });

    // State for expandable text fields
    const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});
    const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

    // Helper functions for expandable fields
    const toggleExpanded = (fieldId: string) => {
        setExpandedFields(prev => ({ ...prev, [fieldId]: !prev[fieldId] }));
    };

    const isExpanded = (fieldId: string) => expandedFields[fieldId] || false;

    // Tooltip component
    const Tooltip = ({ text, children, id }: { text: string, children: React.ReactNode, id: string }) => (
        <div
            className="relative inline-block"
            onMouseEnter={() => setHoveredTooltip(id)}
            onMouseLeave={() => setHoveredTooltip(null)}
        >
            {children}
            {hoveredTooltip === id && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-50 whitespace-nowrap">
                    {text}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
            )}
        </div>
    );

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
        if (!message.trim() || isAILoading) return;

        setIsAILoading(true);
        try {
            const contextText = aiService.extractContextText(local, local.window?.start || 1, local.window?.end || 50);
            const newMessage = { role: 'user' as const, content: message };
            const updatedChat = [...chat, newMessage];
            setChat(updatedChat);
            setMessage("");

            const response = await aiService.chat(updatedChat, contextText);
            setChat([...updatedChat, { role: 'assistant', content: response }]);
        } catch (error: any) {
            console.error('AI Error:', error);
            setChat(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${error.message || 'Failed to get AI response'}`
            }]);
        } finally {
            setIsAILoading(false);
        }
    }

    // AI Generation Functions
    async function generateCharacters() {
        setAiGenerationState(prev => ({ ...prev, characters: true }));
        try {
            const contextText = aiService.extractContextText(local, local.window?.start || 1, local.window?.end || 50);
            const newCharacters = await aiService.generateCharacters(contextText);

            // Merge with existing characters (avoid duplicates)
            const existingNames = local.sections.characters.map((c: any) => c.name.toLowerCase());
            const uniqueNewCharacters = newCharacters.filter(nc =>
                !existingNames.includes(nc.name.toLowerCase())
            );

            if (uniqueNewCharacters.length > 0) {
                const sections = {
                    ...local.sections,
                    characters: [...local.sections.characters, ...uniqueNewCharacters]
                };
                const updated = { ...local, sections };
                setLocal(updated);
                onUpdate(updated);
            }
        } catch (error: any) {
            console.error('Character generation error:', error);
            alert(`Failed to generate characters: ${error.message}`);
        } finally {
            setAiGenerationState(prev => ({ ...prev, characters: false }));
        }
    }

    async function generateChapterSummary(chapterIndex: number) {
        setAiGenerationState(prev => ({ ...prev, chapters: true }));
        try {
            const contextText = aiService.extractContextText(local, local.window?.start || 1, local.window?.end || 50);
            const chapter = local.sections.chapters[chapterIndex];
            const summary = await aiService.generateChapterSummary(contextText, chapter.name);

            const chapters = [...local.sections.chapters];
            chapters[chapterIndex] = { ...chapter, notes: summary };
            const sections = { ...local.sections, chapters };
            const updated = { ...local, sections };
            setLocal(updated);
            onUpdate(updated);
        } catch (error: any) {
            console.error('Chapter summary generation error:', error);
            alert(`Failed to generate chapter summary: ${error.message}`);
        } finally {
            setAiGenerationState(prev => ({ ...prev, chapters: false }));
        }
    }

    async function generateLocations() {
        setAiGenerationState(prev => ({ ...prev, locations: true }));
        try {
            const contextText = aiService.extractContextText(local, local.window?.start || 1, local.window?.end || 50);
            const newLocations = await aiService.generateLocations(contextText);

            // Merge with existing locations (avoid duplicates)
            const existingNames = local.sections.locations.map((l: any) => l.name.toLowerCase());
            const uniqueNewLocations = newLocations.filter(nl =>
                !existingNames.includes(nl.name.toLowerCase())
            );

            if (uniqueNewLocations.length > 0) {
                const sections = {
                    ...local.sections,
                    locations: [...local.sections.locations, ...uniqueNewLocations]
                };
                const updated = { ...local, sections };
                setLocal(updated);
                onUpdate(updated);
            }
        } catch (error: any) {
            console.error('Location generation error:', error);
            alert(`Failed to generate locations: ${error.message}`);
        } finally {
            setAiGenerationState(prev => ({ ...prev, locations: false }));
        }
    }

    async function generateNotes(topic?: string) {
        setAiGenerationState(prev => ({ ...prev, notes: true }));
        try {
            const contextText = aiService.extractContextText(local, local.window?.start || 1, local.window?.end || 50);
            const newNotes = await aiService.generateNotes(contextText, topic);

            const currentNotes = local.sections.notes || '';
            const updatedNotes = currentNotes ? `${currentNotes}\n\n--- AI Generated Notes ---\n${newNotes}` : newNotes;

            const sections = { ...local.sections, notes: updatedNotes };
            const updated = { ...local, sections };
            setLocal(updated);
            onUpdate(updated);
        } catch (error: any) {
            console.error('Notes generation error:', error);
            alert(`Failed to generate notes: ${error.message}`);
        } finally {
            setAiGenerationState(prev => ({ ...prev, notes: false }));
        }
    }

    async function enhanceCharacter(characterIndex: number) {
        setAiGenerationState(prev => ({ ...prev, characters: true }));
        try {
            const contextText = aiService.extractContextText(local, local.window?.start || 1, local.window?.end || 50);
            const character = local.sections.characters[characterIndex];
            const enhancedNotes = await aiService.enhanceCharacterProfile(character.name, contextText, character.notes);

            const characters = [...local.sections.characters];
            characters[characterIndex] = { ...character, notes: enhancedNotes };
            const sections = { ...local.sections, characters };
            const updated = { ...local, sections };
            setLocal(updated);
            onUpdate(updated);
        } catch (error: any) {
            console.error('Character enhancement error:', error);
            alert(`Failed to enhance character: ${error.message}`);
        } finally {
            setAiGenerationState(prev => ({ ...prev, characters: false }));
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
                                    <Tooltip
                                        text="Automatically find and extract all characters mentioned in your selected page range"
                                        id="characters-ai-generate"
                                    >
                                        <button
                                            className={`px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 ${aiGenerationState.characters ? 'animate-pulse' : ''}`}
                                            onClick={generateCharacters}
                                            disabled={aiGenerationState.characters}
                                        >
                                            {aiGenerationState.characters ? '🤖 Generating...' : '🤖 AI Generate'}
                                        </button>
                                    </Tooltip>
                                    <input
                                        value={newCharacterName}
                                        onChange={(e) => setNewCharacterName(e.target.value)}
                                        placeholder="Character name..."
                                        className="px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                        onKeyPress={(e) => e.key === 'Enter' && addCharacter()}
                                    />

                                    <Tooltip
                                        text="Add a new character to your book structure"
                                        id="add-chapter-button"
                                    >
                                        <button
                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg"
                                            onClick={addCharacter}
                                        >
                                            ✨ Add Character
                                        </button>
                                    </Tooltip>
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
                                                    <div className="flex gap-2">
                                                        <Tooltip
                                                            text="Use AI to enhance this character's profile with more details from your selected text"
                                                            id={`enhance-character-${i}`}
                                                        >
                                                            <button
                                                                className={`px-3 py-1 text-purple-600 hover:bg-purple-50 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 ${aiGenerationState.characters ? 'animate-pulse' : ''}`}
                                                                onClick={() => enhanceCharacter(i)}
                                                                disabled={aiGenerationState.characters}
                                                            >
                                                                🤖 AI Enhance
                                                            </button>
                                                        </Tooltip>
                                                        <Tooltip
                                                            text="Remove this character from your list"
                                                            id={`delete-character-${i}`}
                                                        >
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
                                                        </Tooltip>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-emerald-600 font-medium">Character Notes</span>
                                                        <Tooltip
                                                            text={isExpanded(`character-notes-${i}`) ? "Collapse notes area" : "Expand notes area for better writing"}
                                                            id={`expand-character-${i}`}
                                                        >
                                                            <button
                                                                onClick={() => toggleExpanded(`character-notes-${i}`)}
                                                                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium hover:bg-emerald-50 px-2 py-1 rounded transition-all"
                                                            >
                                                                {isExpanded(`character-notes-${i}`) ? '📐 Collapse' : '📏 Expand'}
                                                            </button>
                                                        </Tooltip>
                                                    </div>
                                                    <textarea
                                                        value={c.notes}
                                                        onChange={(e) => updateCharacter(i, { notes: e.target.value })}
                                                        placeholder="Notes about this character..."
                                                        className="w-full p-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                                                        rows={isExpanded(`character-notes-${i}`) ? 8 : 3}
                                                    />
                                                </div>
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
                                    <Tooltip
                                        text="Add a new chapter to your book structure"
                                        id="add-chapter-button"
                                    >
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
                                    </Tooltip>
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
                                                <Tooltip
                                                    text="Generate an AI-powered summary of this chapter from your selected text"
                                                    id={`chapter-summary-${i}`}
                                                >
                                                    <button
                                                        className={`px-3 py-1 text-purple-600 hover:bg-purple-50 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 ${aiGenerationState.chapters ? 'animate-pulse' : ''}`}
                                                        onClick={() => generateChapterSummary(i)}
                                                        disabled={aiGenerationState.chapters}
                                                    >
                                                        🤖 AI Summary
                                                    </button>
                                                </Tooltip>
                                                <Tooltip
                                                    text="Move this chapter up in the order"
                                                    id={`chapter-up-${i}`}
                                                >
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
                                                </Tooltip>
                                                <Tooltip
                                                    text="Move this chapter down in the order"
                                                    id={`chapter-down-${i}`}
                                                >
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
                                                </Tooltip>
                                                <Tooltip
                                                    text="Delete this chapter permanently"
                                                    id={`chapter-delete-${i}`}
                                                >
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
                                                </Tooltip>
                                            </div>
                                        </div>
                                        {editingChapterIndex === i && (
                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-emerald-600 font-medium">Chapter Notes</span>
                                                    <Tooltip
                                                        text={isExpanded(`chapter-notes-${i}`) ? "Collapse notes area" : "Expand notes area for better writing"}
                                                        id={`expand-chapter-notes-${i}`}
                                                    >
                                                        <button
                                                            onClick={() => toggleExpanded(`chapter-notes-${i}`)}
                                                            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium hover:bg-emerald-50 px-2 py-1 rounded transition-all"
                                                        >
                                                            {isExpanded(`chapter-notes-${i}`) ? '📐 Collapse' : '📏 Expand'}
                                                        </button>
                                                    </Tooltip>
                                                </div>
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
                                                    rows={isExpanded(`chapter-notes-${i}`) ? 8 : 4}
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
                            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                <h4 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                                    🗺️ Locations ({local.sections.locations.length})
                                </h4>
                                <Tooltip
                                    text="Use AI to automatically find and extract locations mentioned in your selected text"
                                    id="locations-ai-generate"
                                >
                                    <button
                                        className={`px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 ${aiGenerationState.locations ? 'animate-pulse' : ''}`}
                                        onClick={generateLocations}
                                        disabled={aiGenerationState.locations}
                                    >
                                        🗺️ {aiGenerationState.locations ? 'Generating...' : 'AI Generate'}
                                    </button>
                                </Tooltip>
                            </div>
                            <div className="space-y-3">
                                {local.sections.locations.map((l: any, i: number) => (
                                    <div key={i} className="p-4 bg-white border border-emerald-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h5 className="font-semibold text-amber-900 text-lg mb-2">{l.name}</h5>
                                                <p className="text-emerald-700 text-sm">{l.notes}</p>
                                            </div>
                                            <button
                                                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105"
                                                onClick={() => {
                                                    const locations = [...local.sections.locations];
                                                    locations.splice(i, 1);
                                                    const sections = { ...local.sections, locations };
                                                    const updated = { ...local, sections };
                                                    setLocal(updated);
                                                    onUpdate(updated);
                                                }}
                                            >
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {local.sections.locations.length === 0 && (
                                    <div className="text-center py-12 text-emerald-600">
                                        <div className="text-6xl mb-4">🗺️</div>
                                        <p className="text-lg font-medium">No locations yet</p>
                                        <p className="text-sm opacity-75">Use AI Generate to find locations in your text</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'notes' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                <h4 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                                    📓 General Notes
                                </h4>
                                <Tooltip
                                    text="Use AI to generate insightful notes and analysis from your selected text"
                                    id="notes-ai-generate"
                                >
                                    <button
                                        className={`px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 ${aiGenerationState.notes ? 'animate-pulse' : ''}`}
                                        onClick={() => generateNotes()}
                                        disabled={aiGenerationState.notes}
                                    >
                                        📝 {aiGenerationState.notes ? 'Generating...' : 'AI Generate'}
                                    </button>
                                </Tooltip>
                            </div>
                            <div className="p-4 bg-white border border-emerald-200 rounded-lg shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-emerald-600 font-medium">General Notes</span>
                                    <Tooltip
                                        text={isExpanded('general-notes') ? "Collapse notes area" : "Expand notes area for better writing"}
                                        id="expand-general-notes"
                                    >
                                        <button
                                            onClick={() => toggleExpanded('general-notes')}
                                            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium hover:bg-emerald-50 px-2 py-1 rounded transition-all"
                                        >
                                            {isExpanded('general-notes') ? '📐 Collapse' : '📏 Expand'}
                                        </button>
                                    </Tooltip>
                                </div>
                                <textarea
                                    value={local.sections.notes || ''}
                                    onChange={(e) => {
                                        const sections = { ...local.sections, notes: e.target.value };
                                        const updated = { ...local, sections };
                                        setLocal(updated);
                                        onUpdate(updated);
                                    }}
                                    placeholder="Write your notes here, or use AI Generate to create insights about your selected text..."
                                    className="w-full p-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                                    rows={isExpanded('general-notes') ? 12 : 8}
                                />
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* Chat Island */}
            <div className="rounded-xl border border-amber-200 p-6 bg-gradient-to-br from-amber-50 to-orange-50/50 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
                        <span className="text-white text-sm font-bold"></span>
                    </div>
                    <h3 className="text-lg font-semibold text-amber-900">AI Assistant</h3>
                    <div className="flex-1"></div>
                    <Tooltip
                        text="Configure AI providers and API settings for content generation"
                        id="ai-settings-button"
                    >
                        <button
                            onClick={() => setShowAISettings(true)}
                            className="px-3 py-1.5 bg-amber-200 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-300 transition-colors"
                        >
                            ⚙️ Settings
                        </button>
                    </Tooltip>
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
