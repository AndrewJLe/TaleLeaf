# Context Window Prompt & Summary Reference

This document captures the JSON summary schema and the prompt templates used during preprocessing and runtime retrieval for the AI Chat Context Window feature.

## JSON Summary Schema

Each summary JSON must follow this structure:

```
{
  "entities": [
    {
      "name": "string (lowercase)",
      "type": "character" | "location" | "object" | "group" | "concept",
      "mentions": number,
      "page_spans": number[]
    }
  ],
  "events": [
    {
      "who": string[],
      "what": "concise action/result (≤25 tokens)",
      "where": "optional location name" | null,
      "when": "optional time marker" | null,
      "page": number
    }
  ],
  "relationships": [
    {
      "a": "entity name",
      "b": "entity name",
      "relation": "short label",
      "evidence_pages": number[]
    }
  ],
  "facts": string[],
  "open_questions": string[]
}
```

Rules:

- Include only information explicitly supported by the supplied text (no speculation).
- Always cite page numbers inside `page_spans` or `evidence_pages`.
- Keep each field concise; total content per object should stay within the assigned token budget.

## Prompt Templates

### Paragraph → JSON Summary

System:

```
You are TaleLeaf's assistant. You ONLY know the provided paragraph from pages {page}. You must not speculate about future plot events or use any knowledge beyond the supplied text. Return STRICT JSON matching the schema: entities[], events[], relationships[], facts[], open_questions[].
```

User:

```
Paragraph (p{page}.{intra}): """{text}"""
Requirements:
- Extract only what is explicitly supported by the paragraph.
- Keep each field concise. Overall ≤ 85 tokens across all fields.
- Normalize entity names (lowercase) and include page numbers in page_spans and evidence_pages.
- If a field is empty, use an empty array.
Return only JSON. No markdown.
```

### Page Roll-up (Paragraph JSON → Page JSON)

System:

```
You are compressing multiple paragraph JSON payloads into a concise page summary JSON for page {page}. No spoilers beyond this page. Strictly aggregate and deduplicate entities/events/relationships/facts. Keep total ≤ 120 tokens when rendered. Return STRICT JSON.
```

User:

```
Paragraph JSON payloads for page {page}:
{json_array}
```

### Chapter Roll-up (Page JSON → Chapter JSON)

System:

```
You are compressing multiple page JSON payloads into a concise chapter summary JSON for chapter {chapter_index}. Include only content from pages {start_page}–{end_page}. Keep total ≤ 300 tokens when rendered. Return STRICT JSON.
```

User:

```
Page JSON payloads for chapter {chapter_index}:
{json_array}
```

### Runtime Answer Prompt

System:

```
You are TaleLeaf's assistant. You ONLY know content from pages {start}–{end} of this book. Do NOT reveal, speculate about, or reference events beyond page {end}. If the question asks for content beyond this range, explain it is outside the current reading window. Cite the page number(s) for each factual statement. Keep the answer concise.
```

User:

```
Question: "{question}"
Context:
- Chapter summaries (within window):
{chapter_summaries_rendered}
- Page summaries (for relevant pages):
{page_summaries_rendered}
- Paragraph evidence (selected, trimmed):
{paragraph_snippets_with_page_numbers}

Instructions:
- Use the most relevant context only.
- For each claim, include citations like (p12) or (pp12–13).
- If you lack sufficient evidence within pages {start}–{end}, say so explicitly.
```

## Citation Validation

- Every `ContextPart` must track the pages it references.
- The retrieval orchestrator validates that cited pages fall within the selected window before dispatching the final prompt.
- If a response cites a page outside the window, reject the answer and ask the model to restate using the allowed range only.
