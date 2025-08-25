import { useCallback } from 'react';
import { aiService } from '../lib/ai-service';
import { AIGenerationState, Book, Chapter, Character, Location, Note } from '../types/book';
import { useBookPersistence } from './useBookPersistenceNew';

export const useBookActions = (
    book: Book,
    onUpdate: (book: Book) => void,
    setGenerationLoading: (type: keyof AIGenerationState, loading: boolean) => void
) => {
    const { saveSections } = useBookPersistence();

    const updateBook = useCallback((updates: Partial<Book>) => {
        const updatedBook = { ...book, ...updates, updatedAt: new Date() };
        onUpdate(updatedBook);
    }, [book, onUpdate]);

    const updateSections = useCallback(async (sectionUpdates: Partial<Book['sections']>) => {
        const newSections = { ...book.sections, ...sectionUpdates };
        updateBook({
            sections: newSections
        });

        // Auto-save to database
        try {
            await saveSections(book.id, newSections, book.window);
        } catch (error) {
            console.error('Failed to save sections:', error);
            // Note: Errors are handled by individual save states in components
        }
    }, [book.sections, book.id, book.window, updateBook, saveSections]);

    // Character actions
    const addCharacter = useCallback((character: Omit<Character, 'id'>) => {
        const newCharacter: Character = {
            ...character,
            id: crypto.randomUUID()
        };
        const characters = [...book.sections.characters, newCharacter];
        updateSections({ characters });
    }, [book.sections.characters, updateSections]);

    const updateCharacter = useCallback((index: number, character: Character) => {
        const characters = [...book.sections.characters];
        characters[index] = character;
        updateSections({ characters });
    }, [book.sections.characters, updateSections]);

    const batchUpdateCharacters = useCallback(async (updatedCharacters: Character[]) => {
        updateSections({ characters: updatedCharacters });
    }, [updateSections]);

    const deleteCharacter = useCallback((index: number) => {
        const characters = [...book.sections.characters];
        characters.splice(index, 1);
        updateSections({ characters });
    }, [book.sections.characters, updateSections]);

    const moveCharacter = useCallback((index: number, direction: 'up' | 'down') => {
        const characters = [...book.sections.characters];
        const newIndex = direction === 'up' ? index - 1 : index + 1;

        if (newIndex < 0 || newIndex >= characters.length) return;

        const [item] = characters.splice(index, 1);
        characters.splice(newIndex, 0, item);
        updateSections({ characters });
    }, [book.sections.characters, updateSections]);

    // Chapter actions
    const addChapter = useCallback((chapter: Omit<Chapter, 'id'>) => {
        const newChapter: Chapter = {
            ...chapter,
            id: crypto.randomUUID()
        };
        const chapters = [...book.sections.chapters, newChapter];
        updateSections({ chapters });
    }, [book.sections.chapters, updateSections]);

    const updateChapter = useCallback((index: number, chapter: Chapter) => {
        const chapters = [...book.sections.chapters];
        chapters[index] = chapter;
        updateSections({ chapters });
    }, [book.sections.chapters, updateSections]);

    const batchUpdateChapters = useCallback(async (updatedChapters: Chapter[]) => {
        updateSections({ chapters: updatedChapters });
    }, [updateSections]);

    const deleteChapter = useCallback((index: number) => {
        const chapters = [...book.sections.chapters];
        chapters.splice(index, 1);
        updateSections({ chapters });
    }, [book.sections.chapters, updateSections]);

    const moveChapter = useCallback((index: number, direction: 'up' | 'down') => {
        const chapters = [...book.sections.chapters];
        const newIndex = direction === 'up' ? index - 1 : index + 1;

        if (newIndex < 0 || newIndex >= chapters.length) return;

        const [item] = chapters.splice(index, 1);
        chapters.splice(newIndex, 0, item);
        updateSections({ chapters });
    }, [book.sections.chapters, updateSections]);

    // Location actions
    const addLocation = useCallback((location: Omit<Location, 'id'>) => {
        const newLocation: Location = {
            ...location,
            id: crypto.randomUUID()
        };
        const locations = [...book.sections.locations, newLocation];
        updateSections({ locations });
    }, [book.sections.locations, updateSections]);

    const updateLocation = useCallback((index: number, location: Location) => {
        const locations = [...book.sections.locations];
        locations[index] = location;
        updateSections({ locations });
    }, [book.sections.locations, updateSections]);

    const batchUpdateLocations = useCallback(async (updatedLocations: Location[]) => {
        updateSections({ locations: updatedLocations });
    }, [updateSections]);

    const deleteLocation = useCallback((index: number) => {
        const locations = [...book.sections.locations];
        locations.splice(index, 1);
        updateSections({ locations });
    }, [book.sections.locations, updateSections]);

    const moveLocation = useCallback((index: number, direction: 'up' | 'down') => {
        const locations = [...book.sections.locations];
        const newIndex = direction === 'up' ? index - 1 : index + 1;

        if (newIndex < 0 || newIndex >= locations.length) return;

        const [item] = locations.splice(index, 1);
        locations.splice(newIndex, 0, item);
        updateSections({ locations });
    }, [book.sections.locations, updateSections]);

    // Notes actions
    const addNote = useCallback((note: Omit<Note, 'id'>) => {
        const newNote: Note = {
            ...note,
            id: crypto.randomUUID()
        };
        const notes = [...book.sections.notes, newNote];
        updateSections({ notes });
    }, [book.sections.notes, updateSections]);

    const updateNote = useCallback((index: number, note: Note) => {
        const notes = [...book.sections.notes];
        notes[index] = note;
        updateSections({ notes });
    }, [book.sections.notes, updateSections]);

    const batchUpdateNotes = useCallback(async (updatedNotes: Note[]) => {
        updateSections({ notes: updatedNotes });
    }, [updateSections]);

    const deleteNote = useCallback((index: number) => {
        const notes = [...book.sections.notes];
        notes.splice(index, 1);
        updateSections({ notes });
    }, [book.sections.notes, updateSections]);

    const moveNote = useCallback((index: number, direction: 'up' | 'down') => {
        const notes = [...book.sections.notes];
        const newIndex = direction === 'up' ? index - 1 : index + 1;

        if (newIndex < 0 || newIndex >= notes.length) return;

        const [item] = notes.splice(index, 1);
        notes.splice(newIndex, 0, item);
        updateSections({ notes });
    }, [book.sections.notes, updateSections]);

    // AI Generation actions
    const generateCharacters = useCallback(async () => {
        try {
            setGenerationLoading('characters', true);
            const aiCharacters = await aiService.generateCharactersFromBook(book, book.window.start, book.window.end);

            if (aiCharacters.length > 0) {
                const existingCharacters = book.sections.characters;
                // Add IDs to AI-generated characters
                const charactersWithIds: Character[] = aiCharacters.map(char => ({
                    ...char,
                    id: crypto.randomUUID()
                }));
                const newCharacters = [...existingCharacters, ...charactersWithIds];
                updateSections({ characters: newCharacters });
            }
        } catch (error) {
            console.error('Error generating characters:', error);
            throw error;
        } finally {
            setGenerationLoading('characters', false);
        }
    }, [book, setGenerationLoading, updateSections]);

    const enhanceCharacter = useCallback(async (index: number) => {
        try {
            setGenerationLoading('characters', true);
            const character = book.sections.characters[index];
            const contextText = aiService.extractContextText(book, book.window.start, book.window.end);
            const enhancedNotes = await aiService.enhanceCharacterProfile(
                character.name,
                contextText,
                character.notes
            );

            updateCharacter(index, { ...character, notes: enhancedNotes });
        } catch (error) {
            console.error('Error enhancing character:', error);
            throw error;
        } finally {
            setGenerationLoading('characters', false);
        }
    }, [book, setGenerationLoading, updateCharacter]);

    const generateChapterSummary = useCallback(async (index: number) => {
        try {
            setGenerationLoading('chapters', true);
            const chapter = book.sections.chapters[index];
            const contextText = aiService.extractContextText(book, book.window.start, book.window.end);
            const summary = await aiService.generateChapterSummary(contextText, chapter.name);

            const updatedNotes = chapter.notes
                ? `${chapter.notes}\n\n--- AI Generated Summary ---\n${summary}`
                : summary;

            updateChapter(index, { ...chapter, notes: updatedNotes });
        } catch (error) {
            console.error('Error generating chapter summary:', error);
            throw error;
        } finally {
            setGenerationLoading('chapters', false);
        }
    }, [book, setGenerationLoading, updateChapter]);

    const generateLocations = useCallback(async () => {
        try {
            setGenerationLoading('locations', true);
            const contextText = aiService.extractContextText(book, book.window.start, book.window.end);
            const aiLocations = await aiService.generateLocations(contextText);

            if (aiLocations.length > 0) {
                const existingLocations = book.sections.locations;
                // Add IDs to AI-generated locations
                const locationsWithIds: Location[] = aiLocations.map(loc => ({
                    ...loc,
                    id: crypto.randomUUID()
                }));
                const newLocations = [...existingLocations, ...locationsWithIds];
                updateSections({ locations: newLocations });
            }
        } catch (error) {
            console.error('Error generating locations:', error);
            throw error;
        } finally {
            setGenerationLoading('locations', false);
        }
    }, [book, setGenerationLoading, updateSections]);

    const generateNotes = useCallback(async () => {
        try {
            setGenerationLoading('notes', true);
            const contextText = aiService.extractContextText(book, book.window.start, book.window.end);
            const aiNotes = await aiService.generateNotes(contextText);

            // Create a new AI-generated note
            const aiNote: Note = {
                id: crypto.randomUUID(),
                name: 'AI Generated Notes',
                notes: aiNotes
            };

            addNote(aiNote);
        } catch (error) {
            console.error('Error generating notes:', error);
            throw error;
        } finally {
            setGenerationLoading('notes', false);
        }
    }, [book, setGenerationLoading, updateSections]);

    return {
        // Character actions
        addCharacter,
        updateCharacter,
        batchUpdateCharacters,
        deleteCharacter,
        moveCharacter,
        enhanceCharacter,
        generateCharacters,

        // Chapter actions
        addChapter,
        updateChapter,
        batchUpdateChapters,
        deleteChapter,
        moveChapter,
        generateChapterSummary,

        // Location actions
        addLocation,
        updateLocation,
        batchUpdateLocations,
        deleteLocation,
        moveLocation,
        generateLocations,

        // Notes actions
        addNote,
        updateNote,
        batchUpdateNotes,
        deleteNote,
        moveNote,
        generateNotes,

        // General
        updateBook
    };
};
