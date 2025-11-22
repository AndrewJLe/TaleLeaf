import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ContextPart,
  RetrievalOptions,
  RetrievalResult,
  SummaryJson,
  WindowSelection,
} from "../context-window";

interface BuildContextParams extends RetrievalOptions {
  supabase: SupabaseClient;
}

interface ChapterBoundary {
  chapter_index: number;
  start_page: number;
  end_page: number;
}

interface ChapterSummaryRow {
  chapter_index: number;
  summary_json: SummaryJson | null;
}

interface PageSummaryRow {
  page_number: number;
  summary_json: SummaryJson | null;
}

interface ChunkRow {
  id: string;
  page_number: number;
  intra_index: number;
  raw_text: string | null;
}

const roughTokenEstimate = (text: string) =>
  Math.max(1, Math.ceil(text.trim().length / 4));

const summarizeEntities = (entities: SummaryJson["entities"] = []) => {
  if (!entities.length) return "";
  const limited = entities.slice(0, 5);
  return `Entities: ${limited.map((e) => `${e.name} (${e.type})`).join("; ")}`;
};

const summarizeEvents = (events: SummaryJson["events"] = []) => {
  if (!events.length) return "";
  const limited = events.slice(0, 4);
  return `Events: ${limited.map((evt) => `${evt.what}${evt.who.length ? ` [${evt.who.join(", ")}]` : ""}${evt.page ? ` (p${evt.page})` : ""}`).join(" | ")}`;
};

const summarizeFacts = (facts: SummaryJson["facts"] = []) => {
  if (!facts.length) return "";
  const limited = facts.slice(0, 4);
  return `Facts: ${limited.join(" | ")}`;
};

const summarizeOpenQuestions = (
  questions: SummaryJson["open_questions"] = [],
) => {
  if (!questions.length) return "";
  const limited = questions.slice(0, 2);
  return `Open questions: ${limited.join(" | ")}`;
};

const renderSummaryJson = (summary?: SummaryJson | null): string => {
  if (!summary) return "";
  const lines = [
    summarizeEntities(summary.entities),
    summarizeEvents(summary.events),
    summarizeFacts(summary.facts),
    summarizeOpenQuestions(summary.open_questions),
  ].filter(Boolean);
  return lines.join("\n");
};

const renderPartLabel = (part: ContextPart) => {
  if (part.label === "chapter-summary") {
    return `Chapter ${part.chapterIndex ?? "?"} summary`;
  }
  if (part.label === "page-summary") {
    return `Page ${part.page ?? "?"} summary`;
  }
  return `Paragraph (p${part.page ?? "?"}.${part.chapterIndex ?? ""})`;
};

const renderContextText = (parts: ContextPart[]) =>
  parts
    .map((part) => `### ${renderPartLabel(part)}\n${part.text.trim()}`)
    .join("\n\n");

const resolveWindowPages = (
  selection: WindowSelection,
  chapterMap: ChapterBoundary[],
): { start: number; end: number; chapterIndices: number[] } => {
  if (selection.type === "pages") {
    return {
      start: Math.max(1, selection.start),
      end: Math.max(selection.start, selection.end),
      chapterIndices: chapterMap
        .filter(
          (ch) =>
            ch.start_page <= selection.end && ch.end_page >= selection.start,
        )
        .map((ch) => ch.chapter_index),
    };
  }

  const selected = chapterMap.filter((ch) =>
    selection.chapterIndices.includes(ch.chapter_index),
  );
  if (!selected.length) {
    return {
      start: 1,
      end: 1,
      chapterIndices: [],
    };
  }
  return {
    start: Math.min(...selected.map((ch) => ch.start_page)),
    end: Math.max(...selected.map((ch) => ch.end_page)),
    chapterIndices: selected.map((ch) => ch.chapter_index),
  };
};

const scoreChunkForQuestion = (
  chunk: ChunkRow,
  queryTokens: string[],
): number => {
  const text = chunk.raw_text?.toLowerCase() || "";
  if (!text) return 0;
  return queryTokens.reduce(
    (score, token) => (text.includes(token) ? score + 1 : score),
    0,
  );
};

// Placeholder for future pgvector-based similarity. For now, we keep
// simple token overlap ranking and treat this as a customization point.
async function getRankedChunks(
  supabase: SupabaseClient,
  bookId: string,
  resolvedWindow: { start: number; end: number },
  queryTokens: string[],
): Promise<(ChunkRow & { score: number })[]> {
  const { data: chunkRows, error: chunkErr } = await supabase
    .from("book_page_chunks")
    .select("id,page_number,intra_index,raw_text")
    .eq("book_id", bookId)
    .gte("page_number", resolvedWindow.start)
    .lte("page_number", resolvedWindow.end)
    .order("page_number")
    .order("intra_index")
    .limit(200);

  if (chunkErr) throw chunkErr;

  const base = (chunkRows as ChunkRow[] | null) || [];

  const withScores = base.map((chunk) => ({
    ...chunk,
    score: scoreChunkForQuestion(chunk, queryTokens),
  }));

  withScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.page_number !== b.page_number) return a.page_number - b.page_number;
    return a.intra_index - b.intra_index;
  });

  return withScores;
}

// Best-effort extraction of an explicit page reference from the user's
// question, e.g. "what happens on page 334". Returns the page number if
// found, otherwise null.
export const extractExplicitPageFromQuestion = (
  question: string,
): number | null => {
  const match = question.toLowerCase().match(/page\s+(\d{1,5})/);
  if (!match) return null;
  const page = parseInt(match[1], 10);
  return Number.isFinite(page) && page > 0 ? page : null;
};

interface PageFocusedParams {
  supabase: SupabaseClient;
  bookId: string;
  page: number;
  question: string;
  maxContextTokens?: number;
}

// Build a minimal context focused on a single explicit page. This is used
// for queries like "what happens on page 15?" to keep token usage low by
// avoiding full-window summaries and unrelated paragraphs.
export async function buildPageFocusedContextWindowResult(
  params: PageFocusedParams,
): Promise<
  RetrievalResult & {
    contextText: string;
    resolvedWindow: { start: number; end: number; chapterIndices: number[] };
  }
> {
  const { supabase, bookId, page, question, maxContextTokens = 900 } = params;

  // Fetch any page summary we have for this page (and optionally neighbors
  // for light surrounding context).
  const { data: pageSummaries, error: pageErr } = await supabase
    .from("book_page_summaries")
    .select("page_number,summary_json")
    .eq("book_id", bookId)
    .in(
      "page_number",
      [page - 1, page, page + 1].filter((p) => p > 0),
    )
    .order("page_number");
  if (pageErr) throw pageErr;

  const pageParts: ContextPart[] = ((pageSummaries as PageSummaryRow[]) || [])
    .map((row) => {
      const text = renderSummaryJson(row.summary_json);
      return {
        label: "page-summary",
        page: row.page_number,
        text,
        citations: [{ page: row.page_number }],
        estimatedTokens: roughTokenEstimate(text),
      } as ContextPart;
    })
    .filter((part) => !!part.text);

  // Always try to include one or two raw paragraph chunks from the target page.
  const { data: chunks, error: chunkErr } = await supabase
    .from("book_page_chunks")
    .select("id,page_number,intra_index,raw_text")
    .eq("book_id", bookId)
    .eq("page_number", page)
    .order("intra_index")
    .limit(2);
  if (chunkErr) throw chunkErr;

  const paragraphParts: ContextPart[] = ((chunks as ChunkRow[] | null) || [])
    .map((chunk) => {
      const raw = chunk.raw_text?.trim() || "";
      const text = raw.length > 900 ? `${raw.slice(0, 900)}…` : raw;
      return {
        label: "paragraph",
        page: chunk.page_number,
        text,
        citations: [{ page: chunk.page_number, chunkId: chunk.id }],
        estimatedTokens: roughTokenEstimate(text),
      } as ContextPart;
    })
    .filter((part) => !!part.text);

  const orderedParts = [...pageParts, ...paragraphParts];
  if (!orderedParts.length) {
    throw new Error("context-window-data-missing");
  }

  const includedParts: ContextPart[] = [];
  let remainingTokens = maxContextTokens;
  for (const part of orderedParts) {
    if (part.estimatedTokens <= remainingTokens || includedParts.length === 0) {
      includedParts.push(part);
      remainingTokens = Math.max(0, remainingTokens - part.estimatedTokens);
    } else {
      break;
    }
  }

  const contextText = renderContextText(includedParts);
  const start = Math.max(1, page - 1);
  const end = page + 1;

  const systemPrompt = `You are TaleLeaf's assistant. The reader is asking specifically about page ${page}.
You ONLY know the content represented by the excerpts below (drawn from pages ${start}–${end}). Do NOT reveal or speculate about events beyond these excerpts.

Instructions:
- Focus your answer on what happens on page ${page}.
- If the excerpts are insufficient to answer, say you do not have enough information from page ${page}.
- Never say that the reader has not reached page ${page}.
- Cite page numbers for factual statements like (p${page}).

Context excerpts:
${contextText}`;

  const estimatedTokens = roughTokenEstimate(systemPrompt) + 200;

  return {
    systemPrompt,
    userPrompt: question,
    parts: includedParts,
    citations: includedParts.flatMap((part) => part.citations),
    estimatedTokens,
    tokenEstimate: {
      inputTokens: estimatedTokens,
      estimatedOutputTokens: 500,
      totalTokens: estimatedTokens + 500,
      estimatedCost: 0,
      provider: "context-window-page-focused",
    },
    contextText,
    resolvedWindow: { start, end, chapterIndices: [] },
  };
}

export async function buildContextWindowResult(
  params: BuildContextParams,
): Promise<
  RetrievalResult & {
    contextText: string;
    resolvedWindow: { start: number; end: number; chapterIndices: number[] };
  }
> {
  const {
    supabase,
    bookId,
    window,
    question,
    maxContextTokens = 9999,
    desiredK = { min: 4, max: 12 },
  } = params;

  const { data: chapterMapRows, error: chapterErr } = await supabase
    .from("book_chapter_map")
    .select("chapter_index,start_page,end_page")
    .eq("book_id", bookId)
    .order("chapter_index");
  if (chapterErr) throw chapterErr;
  const chapterMap = (chapterMapRows as ChapterBoundary[]) || [];
  const resolvedWindow = resolveWindowPages(window, chapterMap);

  const chapterIndices = resolvedWindow.chapterIndices.length
    ? resolvedWindow.chapterIndices
    : chapterMap
        .filter(
          (ch) =>
            ch.start_page <= resolvedWindow.end &&
            ch.end_page >= resolvedWindow.start,
        )
        .map((ch) => ch.chapter_index);

  const [{ data: chapterSummaries }, { data: pageSummaries }] =
    await Promise.all([
      supabase
        .from("book_chapter_summaries")
        .select("chapter_index,summary_json")
        .eq("book_id", bookId)
        .in("chapter_index", chapterIndices.length ? chapterIndices : [-1])
        .order("chapter_index"),
      supabase
        .from("book_page_summaries")
        .select("page_number,summary_json")
        .eq("book_id", bookId)
        .gte("page_number", resolvedWindow.start)
        .lte("page_number", resolvedWindow.end)
        .order("page_number"),
    ]);

  const queryTokens = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

  const chapterParts: ContextPart[] = (
    (chapterSummaries as ChapterSummaryRow[]) || []
  )
    .map((row) => {
      const text = renderSummaryJson(row.summary_json);
      return {
        label: "chapter-summary",
        chapterIndex: row.chapter_index,
        text,
        citations: [],
        estimatedTokens: roughTokenEstimate(text),
      } as ContextPart;
    })
    .filter((part) => !!part.text);

  const pageParts: ContextPart[] = ((pageSummaries as PageSummaryRow[]) || [])
    .map((row) => {
      const text = renderSummaryJson(row.summary_json);
      return {
        label: "page-summary",
        page: row.page_number,
        text,
        citations: [{ page: row.page_number }],
        estimatedTokens: roughTokenEstimate(text),
      } as ContextPart;
    })
    .filter((part) => !!part.text);

  const chunkCandidates = await getRankedChunks(
    supabase,
    bookId,
    resolvedWindow,
    queryTokens,
  );

  const maxParagraphs = Math.max(desiredK.min, Math.min(desiredK.max, 8));
  const paragraphParts: ContextPart[] = chunkCandidates
    .slice(0, maxParagraphs)
    .map((chunk) => {
      const raw = chunk.raw_text?.trim() || "";
      const text = raw.length > 900 ? `${raw.slice(0, 900)}…` : raw;
      return {
        label: "paragraph",
        page: chunk.page_number,
        text,
        citations: [{ page: chunk.page_number, chunkId: chunk.id }],
        estimatedTokens: roughTokenEstimate(text),
      } as ContextPart;
    })
    .filter((part) => !!part.text);

  // If the user explicitly asks about a specific page (e.g., "page 334")
  // and that page is within the resolved window, ensure we include at least
  // one paragraph snippet from that page even if its lexical score is low.
  const explicitPage = extractExplicitPageFromQuestion(question);
  let explicitPagePart: ContextPart | null = null;
  if (
    explicitPage &&
    explicitPage >= resolvedWindow.start &&
    explicitPage <= resolvedWindow.end
  ) {
    // Force-fetch at least one chunk for the explicit page directly from DB,
    // independent of the heuristic ranking.
    const { data: explicitChunks, error: explicitErr } = await supabase
      .from("book_page_chunks")
      .select("id,page_number,intra_index,raw_text")
      .eq("book_id", bookId)
      .eq("page_number", explicitPage)
      .order("intra_index")
      .limit(1);

    if (!explicitErr && explicitChunks && explicitChunks.length > 0) {
      const targetChunk = explicitChunks[0] as ChunkRow;
      const raw = targetChunk.raw_text?.trim() || "";
      const text = raw.length > 900 ? `${raw.slice(0, 900)}…` : raw;
      if (text) {
        explicitPagePart = {
          label: "paragraph",
          page: targetChunk.page_number,
          text,
          citations: [
            { page: targetChunk.page_number, chunkId: targetChunk.id },
          ],
          estimatedTokens: roughTokenEstimate(text),
        } as ContextPart;
      }
    }
  }

  const orderedParts = [
    ...chapterParts,
    ...pageParts,
    ...(explicitPagePart ? [explicitPagePart] : []),
    ...paragraphParts,
  ];
  if (!orderedParts.length) {
    throw new Error("context-window-data-missing");
  }

  const includedParts: ContextPart[] = [];
  let remainingTokens = maxContextTokens;
  for (const part of orderedParts) {
    if (part.estimatedTokens <= remainingTokens || includedParts.length === 0) {
      includedParts.push(part);
      remainingTokens = Math.max(0, remainingTokens - part.estimatedTokens);
    } else {
      break;
    }
  }

  const contextText = renderContextText(includedParts);
  const systemPrompt = `You are TaleLeaf's assistant. You ONLY know content from pages ${resolvedWindow.start}–${resolvedWindow.end} of this book, as represented by the excerpts below. Do NOT reveal, speculate about, or reference events beyond page ${resolvedWindow.end}.

If the user asks about a page number that is:
- Outside ${resolvedWindow.start}–${resolvedWindow.end}: say clearly that the reader has not reached that page yet and you cannot answer.
- Inside ${resolvedWindow.start}–${resolvedWindow.end}: the reader has already reached that page, so NEVER say they have not reached it. Avoid any wording such as "you have not reached page X yet" when referring to pages within the window. Instead:
  - If the page is covered by the provided excerpts, answer using the excerpted text.
  - If the page is not covered, say it is within the current reading window but that the provided excerpts do not include that page, so you cannot describe it in detail.

Always stay within the provided context and cite the relevant page number(s) for every factual statement.

Context excerpts (ordered most general to most specific):
${contextText}

Instructions:
- Stay within the provided context.
- Use concise sentences. Reference pages like (p12) or (pp12–13).
- If multiple interpretations exist, mention them briefly.
- If the answer cannot be derived from the context, state that explicitly.`;

  const estimatedTokens = roughTokenEstimate(systemPrompt) + 200; // buffer for user question + answer

  return {
    systemPrompt,
    userPrompt: question,
    parts: includedParts,
    citations: includedParts.flatMap((part) => part.citations),
    estimatedTokens,
    tokenEstimate: {
      inputTokens: estimatedTokens,
      estimatedOutputTokens: 500,
      totalTokens: estimatedTokens + 500,
      estimatedCost: 0,
      provider: "context-window",
    },
    contextText,
    resolvedWindow,
  };
}
