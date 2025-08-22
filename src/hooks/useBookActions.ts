import { useCallback } from 'react';
import { Book, Character, Chapter, Location, AIGenerationState } from '../types/book';
import { aiService } from '../lib/ai-service';

export const useBookActions = (
    book: Book,
    onUpdate: (book: Book) => void,
    setGenerationLoading: (type: keyof AIGenerationState, loading: boolean) => void
) => {

    const updateBook = useCallback((updates: Partial<Book>) => {
        const updatedBook = { ...book, ...updates, updatedAt: new Date() };
        onUpdate(updatedBook);
    }, [book, onUpdate]);

    const updateSections = useCallback((sectionUpdates: Partial<Book['sections']>) => {
        updateBook({
            sections: { ...book.sections, ...sectionUpdates }
        });
    }, [book.sections, updateBook]);

    // Character actions
    const addCharacter = useCallback((character: Character) => {
        const characters = [...book.sections.characters, character];
        updateSections({ characters });
    }, [book.sections.characters, updateSections]);

    const updateCharacter = useCallback((index: number, character: Character) => {
        const characters = [...book.sections.characters];
        characters[index] = character;
        updateSections({ characters });
    }, [book.sections.characters, updateSections]);

    const deleteCharacter = useCallback((index: number) => {
        const characters = [...book.sections.characters];
        characters.splice(index, 1);
        updateSections({ characters });
    }, [book.sections.characters, updateSections]);

    // Chapter actions
    const addChapter = useCallback((chapter: Chapter) => {
        const chapters = [...book.sections.chapters, chapter];
        updateSections({ chapters });
    }, [book.sections.chapters, updateSections]);

    const updateChapter = useCallback((index: number, chapter: Chapter) => {
        const chapters = [...book.sections.chapters];
        chapters[index] = chapter;
        updateSections({ chapters });
    }, [book.sections.chapters, updateSections]);

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
    const addLocation = useCallback((location: Location) => {
        const locations = [...book.sections.locations, location];
        updateSections({ locations });
    }, [book.sections.locations, updateSections]);

    const updateLocation = useCallback((index: number, location: Location) => {
        const locations = [...book.sections.locations];
        locations[index] = location;
        updateSections({ locations });
    }, [book.sections.locations, updateSections]);

    const deleteLocation = useCallback((index: number) => {
        const locations = [...book.sections.locations];
        locations.splice(index, 1);
        updateSections({ locations });
    }, [book.sections.locations, updateSections]);

    // Notes actions
    const updateNotes = useCallback((notes: string) => {
        updateSections({ notes });
    }, [updateSections]);

    // AI Generation actions
    const generateCharacters = useCallback(async () => {
        try {
            setGenerationLoading('characters', true);
            const contextText = aiService.extractContextText(book, book.window.start, book.window.end);
            const aiCharacters = await aiService.generateCharacters(contextText);

            if (aiCharacters.length > 0) {
                const existingCharacters = book.sections.characters;
                const newCharacters = [...existingCharacters, ...aiCharacters];
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
                const newLocations = [...existingLocations, ...aiLocations];
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

            const currentNotes = book.sections.notes;
            const updatedNotes = currentNotes
                ? `${currentNotes}\n\n--- AI Generated Notes ---\n${aiNotes}`
                : aiNotes;

            updateSections({ notes: updatedNotes });
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
        deleteCharacter,
        enhanceCharacter,
        generateCharacters,

        // Chapter actions
        addChapter,
        updateChapter,
        deleteChapter,
        moveChapter,
        generateChapterSummary,

        // Location actions
        addLocation,
        updateLocation,
        deleteLocation,
        generateLocations,

        // Notes actions
        updateNotes,
        generateNotes,

        // General
        updateBook
    };
};
