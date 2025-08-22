export interface Character {
    name: string;
    notes: string;
}

export interface Chapter {
    name: string;
    notes: string;
}

export interface Location {
    name: string;
    notes: string;
}

export interface BookSections {
    characters: Character[];
    chapters: Chapter[];
    locations: Location[];
    notes: string;
}

export interface PageData {
    content: string;
    pageNumber: number;
}

export interface BookUpload {
    id: string;
    filename: string;
    pages: string[];
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

export interface ExpandedFieldsState {
    [fieldId: string]: boolean;
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

export interface ExpandableTextAreaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    fieldId: string;
    label?: string;
    isExpanded: boolean;
    onToggleExpand: () => void;
    rows?: number;
    expandedRows?: number;
}
