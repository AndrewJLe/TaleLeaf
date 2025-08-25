export interface Character {
    id: string;
    name: string;
    notes: string;
    tags: string[];
}

export interface Chapter {
    id: string;
    name: string;
    notes: string;
    tags: string[];
}

export interface Location {
    id: string;
    name: string;
    notes: string;
    tags: string[];
}

export interface Note {
    id: string;
    name: string;
    notes: string;
    tags: string[];
}

// TODO N1: Multi-note normalized model
export interface BookNote {
    id: string;
    bookId: string;
    title?: string;
    body: string;
    tags: string[];
    position: number;
    spoilerProtected: boolean;
    minVisiblePage?: number;
    createdAt: string;
    updatedAt: string;
}

// TODO H1: Hierarchical locations model
export interface BookLocation {
    id: string;
    bookId: string;
    parentId?: string | null;
    name: string;
    notes: string;
    position: number;
    depth: number;
    createdAt: string;
    updatedAt: string;
}

export interface BookSections {
    characters: Character[];
    chapters: Chapter[];
    locations: Location[];
    notes: Note[];
}

export interface PageData {
    content: string;
    pageNumber: number;
}

export interface BookUpload {
    id: string;
    filename: string;
    type: 'pdf' | 'text';
    pageCount: number;
    indexedDBKey?: string; // For PDF storage in IndexedDB
    pages?: string[]; // Only for text content (chunked pages)
    text?: string; // For pasted text content
    uploadedAt: Date;
}

export interface ContextWindow {
    start: number;
    end: number;
}

export interface Book {
    id: string;
    title: string;
    sections: BookSections;
    window: ContextWindow;
    uploads: BookUpload[];
    pages?: number;
    cover?: string | null; // Base64 data URL or external URL
    // Remote PDF sync metadata (optional)
    pdfPath?: string; // storage path for the original PDF if uploaded to cloud
    pdfPageCount?: number; // authoritative page count from stored PDF
    createdAt: Date;
    updatedAt: Date;
}

export type TabType = 'characters' | 'chapters' | 'locations' | 'notes';

export interface AIGenerationState {
    characters: boolean;
    chapters: boolean;
    locations: boolean;
    notes: boolean;
}

// Props interfaces
export interface BookEditorProps {
    book: Book;
    onUpdate: (book: Book) => void;
}

export interface TooltipProps {
    text: string;
    children: React.ReactNode;
    id: string;
}
