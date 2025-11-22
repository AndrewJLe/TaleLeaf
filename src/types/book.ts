export interface Character {
  id: string;
  bookId?: string; // normalized table book_id
  name: string;
  notes: string;
  position?: number;
  tags: string[]; // tag names (lowercase)
  tagColors?: Record<string, string>; // resolved colors per tag (after override resolution)
  createdAt?: string;
  updatedAt?: string;
}

export interface Chapter {
  id: string;
  bookId?: string;
  title?: string; // normalized title (renamed from name)
  name: string; // legacy alias
  notes: string;
  summary?: string;
  analysis?: string;
  position?: number;
  tags: string[];
  tagColors?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Location {
  id: string;
  bookId?: string;
  parentId?: string | null;
  name: string;
  notes: string;
  position?: number;
  depth?: number;
  tags: string[];
  tagColors?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
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
  groupId?: string | null; // optional grouping
  createdAt: string;
  updatedAt: string;
}

export interface BookTag {
  id: string;
  bookId: string;
  name: string; // original case
  color: string; // #RRGGBB
  createdAt: string;
  updatedAt: string;
}

export interface BookNoteGroup {
  id: string;
  bookId: string;
  name: string;
  color: string; // #RRGGBB
  position: number | null;
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
  type: "pdf" | "text";
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

export type TabType =
  | "characters"
  | "chapters"
  | "locations"
  | "notes"
  | "all-notes";

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

export interface BookTagAssign {
  entityType: "character" | "chapter" | "location" | "note";
  entityId: string;
  tagId: string;
  tagName: string;
  color: string; // resolved color
  overrideColor?: string | null;
  taggedAt: string;
}
