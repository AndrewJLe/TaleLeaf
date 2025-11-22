import type { SupabaseClient } from "@supabase/supabase-js";
import { aiService } from "../ai-service";
import type { SummaryJson } from "../context-window";

interface BookUploadPages {
  pages?: string[] | null;
}

interface BookRow {
  id: string;
  uploads: BookUploadPages[] | null;
}

export interface PreprocessResult {
  processedPages: number[];
  totalPages: number;
}

// TODO: wire this to a real embeddings provider (OpenAI, etc.). For now this
// returns null so retrieval falls back to heuristic scoring.
async function computeEmbedding(_text: string): Promise<number[] | null> {
  return null;
}

// Minimal page-level JSON summary using aiService and the schema from
// docs/context-window-prompts.md. This is a best-effort helper that keeps
// token usage small by truncating long pages.
async function summarizePageToJson(
  pageText: string,
  pageNumber: number,
): Promise<SummaryJson | null> {
  const trimmed = pageText.trim();
  if (!trimmed) return null;

  const maxChars = 4000; // ~1000 tokens rough
  const textSlice =
    trimmed.length > maxChars
      ? `${trimmed.slice(0, maxChars)}\n\n[truncated for summary]`
      : trimmed;

  const system =
    `You are TaleLeaf's assistant. You ONLY know the provided text from page ${pageNumber}. ` +
    "You must not speculate about future plot events or use any knowledge beyond the supplied text. " +
    "Return STRICT JSON following the schema: entities[], events[], relationships[], facts[], open_questions[].";

  const user =
    `Page ${pageNumber} text:\n"""${textSlice}"""\n\n` +
    "Requirements:\n" +
    "- Extract only what is explicitly supported by this page.\n" +
    "- Keep each field concise. Overall ≤ 120 tokens across all fields.\n" +
    "- Normalize entity names (lowercase) and include this page number in page_spans and evidence_pages.\n" +
    "- If a field is empty, use an empty array.\n" +
    "Return only JSON. No markdown.";

  try {
    const raw = await aiService.chat([{ role: "user", content: user }], "", {
      systemPromptOverride: system,
    });

    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      return null;
    }

    const jsonText = raw.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonText) as SummaryJson;
    return parsed;
  } catch (err) {
    console.warn("summarizePageToJson failed for page", pageNumber, err);
    return null;
  }
}

export async function preprocessBookContext(
  supabase: SupabaseClient,
  bookId: string,
  pagesFromClient?: string[],
): Promise<PreprocessResult> {
  // Prefer pages provided by the client (extracted in-browser). If not
  // provided, attempt to read legacy `books.uploads` (if present). If the
  // DB schema doesn't include that column, gracefully treat as no pages.
  let pages: string[] = [];

  if (Array.isArray(pagesFromClient) && pagesFromClient.length > 0) {
    pages = pagesFromClient;
  } else {
    try {
      const { data: book, error: bookErr } = await supabase
        .from("books")
        .select("id, uploads")
        .eq("id", bookId)
        .maybeSingle();

      if (bookErr) throw bookErr;
      if (!book) throw new Error("book-not-found");

      const typedBook = book as unknown as BookRow;
      const uploads = typedBook.uploads || [];
      const primaryUpload = uploads[0];
      pages = primaryUpload?.pages || [];
    } catch (err: any) {
      // If the DB schema doesn't include `books.uploads` (column missing),
      // avoid failing the whole preprocess call — treat as no pages and
      // return an empty result. Other errors should still bubble up.
      if (
        err?.code === "42703" ||
        (typeof err?.message === "string" &&
          err.message.includes("books.uploads"))
      ) {
        return { processedPages: [], totalPages: 0 };
      }
      throw err;
    }
  }

  const totalPages = pages.length;
  if (!totalPages) {
    return { processedPages: [], totalPages: 0 };
  }

  const processedPages: number[] = [];

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageNumber = pageIndex + 1;
    const rawText = pages[pageIndex] ?? "";

    // Skip if we already have at least one chunk for this page
    const { data: existingChunks, error: chunkErr } = await supabase
      .from("book_page_chunks")
      .select("id")
      .eq("book_id", bookId)
      .eq("page_number", pageNumber)
      .limit(1);

    if (chunkErr) throw chunkErr;
    if (existingChunks && existingChunks.length > 0) {
      processedPages.push(pageNumber);
      continue;
    }

    const trimmed = (rawText || "").trim();
    if (!trimmed) {
      continue;
    }

    // Simple single-chunk per page for now.
    const embedding = await computeEmbedding(trimmed);

    const { error: insertChunkErr } = await supabase
      .from("book_page_chunks")
      .insert({
        book_id: bookId,
        page_number: pageNumber,
        intra_index: 0,
        raw_text: trimmed,
        embedding,
      } as any);

    if (insertChunkErr) throw insertChunkErr;

    // Best-effort page-level JSON summary (currently stubbed). Failures
    // here should not abort the entire preprocessing run — log and continue.
    try {
      const summaryJson = await summarizePageToJson(trimmed, pageNumber);
      if (summaryJson) {
        const { error: pageSummaryErr } = await supabase
          .from("book_page_summaries")
          .upsert(
            {
              book_id: bookId,
              page_number: pageNumber,
              summary_json: summaryJson,
            } as any,
            { onConflict: "book_id,page_number" as any },
          );

        if (pageSummaryErr) {
          console.warn(
            "page summary upsert failed for page",
            pageNumber,
            pageSummaryErr,
          );
          // continue without throwing — chunk insert succeeded and is usable
        }
      }
    } catch (err) {
      console.warn(
        "page summary generation/upsert failed for page",
        pageNumber,
        err,
      );
      // Do not throw; treat summaries as optional
    }

    processedPages.push(pageNumber);
  }

  return { processedPages, totalPages };
}
