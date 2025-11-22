import { TokenEstimate } from './ai-service';

export type WindowSelection =
  | { type: 'pages'; start: number; end: number }
  | { type: 'chapters'; chapterIndices: number[] };

export interface RetrievalWindow {
  startPage: number;
  endPage: number;
  chapterIndices?: number[];
}

export interface RetrievalOptions {
  bookId: string;
  window: WindowSelection;
  question: string;
  maxContextTokens: number;
  desiredK?: { min: number; max: number };
  includeRawParagraphs?: boolean;
}

export interface Citation {
  page: number;
  chunkId?: string;
}

export interface ContextPart {
  label: 'chapter-summary' | 'page-summary' | 'paragraph';
  page?: number;
  chapterIndex?: number;
  text: string;
  citations: Citation[];
  estimatedTokens: number;
}

export interface RetrievalResult {
  systemPrompt: string;
  userPrompt: string;
  parts: ContextPart[];
  citations: Citation[];
  estimatedTokens: number;
  tokenEstimate: TokenEstimate;
}

export interface SummaryJson {
  entities: Array<{
    name: string;
    type: 'character' | 'location' | 'object' | 'group' | 'concept';
    mentions: number;
    page_spans: number[];
  }>;
  events: Array<{
    who: string[];
    what: string;
    where?: string | null;
    when?: string | null;
    page: number;
  }>;
  relationships: Array<{
    a: string;
    b: string;
    relation: string;
    evidence_pages: number[];
  }>;
  facts: string[];
  open_questions: string[];
}

export interface ContextWindowOrchestrator {
  resolveWindow(selection: WindowSelection): Promise<RetrievalWindow>;
  retrieveContext(options: RetrievalOptions): Promise<RetrievalResult>;
}
