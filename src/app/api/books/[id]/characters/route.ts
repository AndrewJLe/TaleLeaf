import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "../../../../../lib/supabase-enabled";
import { createServerSupabase } from "../../../../../lib/supabase-server";

// Helper: ensure ownership
async function ensureBookOwnership(
  supabase: any,
  bookId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("books")
    .select("id")
    .eq("id", bookId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("not found");
}

function normalizeTagName(t: string): string {
  return t.trim().toLowerCase();
}

// GET: list characters with aggregated tags
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseEnabled)
    return NextResponse.json({ disabled: true }, { status: 400 });
  const { id: bookId } = await context.params;
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const supabase = createServerSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    let charsRes: any = await supabase
      .from("book_characters")
      .select("id,book_id,name,notes,position,created_at,updated_at,deleted_at")
      .eq("book_id", bookId)
      .is("deleted_at", null)
      .order("position", { ascending: true });
    if (charsRes.error && /notes/.test(charsRes.error.message || "")) {
      // Fallback if server hasn't applied notes column yet
      charsRes = await supabase
        .from("book_characters")
        .select("id,book_id,name,position,created_at,updated_at")
        .eq("book_id", bookId)
        .order("position", { ascending: true });
    }
    if (charsRes.error) throw charsRes.error;
    const chars = charsRes.data as any[];
    let joinsRes: any = await supabase
      .from("book_character_tags")
      .select("character_id, tag_id, color_override, created_at, book_id")
      .eq("book_id", bookId);
    if (joinsRes.error && /created_at/.test(joinsRes.error.message || "")) {
      // Fallback if older schema without created_at column
      joinsRes = await supabase
        .from("book_character_tags")
        .select("character_id, tag_id, color_override, book_id")
        .eq("book_id", bookId);
    }
    if (joinsRes.error) throw joinsRes.error;
    const joins = joinsRes.data;
    const { data: tags, error: tErr } = await supabase
      .from("book_tags")
      .select("id,name,color,book_id")
      .eq("book_id", bookId);
    if (tErr) throw tErr;
    const tagMap = Object.fromEntries((tags || []).map((t) => [t.id, t]));
    const byChar: Record<
      string,
      { tags: string[]; tagColors: Record<string, string> }
    > = {};
    ((joins as any[]) || []).forEach((j: any) => {
      const tag = tagMap[j.tag_id];
      if (!tag) return;
      if (!byChar[j.character_id])
        byChar[j.character_id] = { tags: [], tagColors: {} };
      byChar[j.character_id].tags.push(tag.name);
      byChar[j.character_id].tagColors[tag.name] =
        j.color_override || tag.color;
    });
    const result = (chars || []).map((c) => ({
      id: c.id,
      bookId: c.book_id,
      name: c.name,
      notes: c.notes || "",
      position: c.position,
      tags: byChar[c.id]?.tags || [],
      tagColors: byChar[c.id]?.tagColors || {},
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
    if (debug) {
      // Emit server log plus include raw debug payload in response for inspection.
      console.log("[characters GET debug]", {
        bookId,
        userId: user.id,
        rowCount: result.length,
        rawCharsCount: chars?.length,
        joins: joins?.length,
        tags: tags?.length,
      });
      return NextResponse.json({
        characters: result,
        _debug: { rawChars: chars, joins, tags },
      });
    }
    // Minimal log when zero rows returned to help diagnose silent filtering (e.g., RLS)
    if (result.length === 0) {
      console.log("[characters GET] no characters returned", {
        bookId,
        userId: user.id,
        rawCharsCount: chars?.length,
        charsResError: charsRes.error,
      });
    }
    return NextResponse.json({ characters: result });
  } catch (e: any) {
    const status = e.message === "not found" ? 404 : 500;
    console.error("[characters GET error]", {
      bookId,
      userId: user.id,
      error: e?.message,
      stack: e?.stack,
    });
    return NextResponse.json(
      { error: e.message, detail: e?.hint || e?.details || null },
      { status },
    );
  }
}

interface UpsertCharacterPayload {
  id?: string;
  name: string;
  notes?: string;
  position?: number;
  tags?: (string | { name: string; color?: string; overrideColor?: string })[];
}

async function upsertTagsAndJoins(
  supabase: any,
  bookId: string,
  characterId: string,
  tags: UpsertCharacterPayload["tags"],
) {
  const tagInputs = (tags || [])
    .map((t) => (typeof t === "string" ? { name: t } : t))
    .filter((t) => t.name && t.name.trim() !== "");
  const normalized = tagInputs.map((t) => ({
    ...t,
    norm: normalizeTagName(t.name),
  }));
  // Upsert base tags first
  for (const ti of normalized) {
    const { error: upErr } = await supabase
      .from("book_tags")
      .upsert(
        { book_id: bookId, name: ti.norm, color: ti.color || "#888888" },
        { onConflict: "book_id,name" },
      );
    if (upErr) {
      // Fallback path if unique constraint/index missing (older schema)
      if (/no unique|no\s+unique\s+or\s+exclusion/i.test(upErr.message || "")) {
        // Try manual select then insert
        const { data: existing, error: selErr } = await supabase
          .from("book_tags")
          .select("id")
          .eq("book_id", bookId)
          .eq("name", ti.norm)
          .maybeSingle();
        if (selErr) throw selErr;
        if (!existing) {
          const { error: insErr } = await supabase
            .from("book_tags")
            .insert({
              book_id: bookId,
              name: ti.norm,
              color: ti.color || "#888888",
            });
          if (insErr && !/duplicate/i.test(insErr.message || "")) throw insErr;
        }
      } else {
        throw upErr;
      }
    }
  }
  // Fetch tag ids
  const { data: tagRows, error: tErr } = await supabase
    .from("book_tags")
    .select("id,name,color")
    .eq("book_id", bookId)
    .in(
      "name",
      normalized.map((n) => n.norm),
    );
  if (tErr) throw tErr;
  const wantedIds = new Set<string>();
  for (const tr of tagRows || []) {
    wantedIds.add(tr.id);
    const input = normalized.find((n) => n.norm === tr.name);
    const overrideColor =
      input?.overrideColor && /^#[0-9A-Fa-f]{6}$/.test(input.overrideColor)
        ? input.overrideColor
        : null;
    const { error: joinErr } = await supabase
      .from("book_character_tags")
      .upsert(
        {
          character_id: characterId,
          tag_id: tr.id,
          color_override: overrideColor,
          book_id: bookId,
        },
        { onConflict: "character_id,tag_id" },
      );
    if (joinErr) throw joinErr;
  }
  // Remove stale joins
  const { data: existingJoins, error: exErr } = await supabase
    .from("book_character_tags")
    .select("tag_id")
    .eq("character_id", characterId);
  if (exErr) throw exErr;
  for (const ej of existingJoins || []) {
    if (!wantedIds.has(ej.tag_id)) {
      const { error: delErr } = await supabase
        .from("book_character_tags")
        .delete()
        .eq("character_id", characterId)
        .eq("tag_id", ej.tag_id);
      if (delErr) throw delErr;
    }
  }

  // Cleanup: remove orphaned tags (no associations across any entity type) for this book
  try {
    // Collect used tag ids from join tables (character, chapter, location) to avoid deleting still-referenced tags.
    const usedTagIds = new Set<string>();
    const tables = [
      { table: "book_character_tags", col: "tag_id" },
      { table: "book_chapter_tags", col: "tag_id" },
      { table: "book_location_tags", col: "tag_id" },
    ];
    for (const tbl of tables) {
      const { data: rows, error: rErr } = await supabase
        .from(tbl.table)
        .select(tbl.col)
        .eq("book_id", bookId);
      if (!rErr) {
        (rows || []).forEach((r: any) => {
          if (r[tbl.col]) usedTagIds.add(r[tbl.col]);
        });
      }
    }
    // Delete tags not in usedTagIds
    const { data: allTags, error: allErr } = await supabase
      .from("book_tags")
      .select("id")
      .eq("book_id", bookId);
    if (!allErr) {
      const orphanIds = (allTags || [])
        .map((t: any) => t.id)
        .filter((id: string) => !usedTagIds.has(id));
      if (orphanIds.length) {
        const { error: delTagsErr } = await supabase
          .from("book_tags")
          .delete()
          .in("id", orphanIds)
          .eq("book_id", bookId);
        if (delTagsErr) {
          // Log but don't throw; non-critical cleanup
          console.warn("[tag cleanup] failed", delTagsErr.message);
        }
      }
    }
  } catch (cleanupErr: any) {
    console.warn("[tag cleanup] exception", cleanupErr?.message);
  }
}

// POST: create character
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseEnabled)
    return NextResponse.json({ disabled: true }, { status: 400 });
  const { id: bookId } = await context.params;
  const payload = (await req.json()) as UpsertCharacterPayload;
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const supabase = createServerSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    let insertedRes = await supabase
      .from("book_characters")
      .insert({
        book_id: bookId,
        name: payload.name,
        notes: payload.notes || "",
        position: payload.position,
      })
      .select("id,book_id,name,notes,position,created_at,updated_at")
      .single();
    if (insertedRes.error && /notes/.test(insertedRes.error.message || "")) {
      insertedRes = await supabase
        .from("book_characters")
        .insert({
          book_id: bookId,
          name: payload.name,
          position: payload.position,
        })
        .select("id,book_id,name,position,created_at,updated_at")
        .single();
    }
    if (insertedRes.error) throw insertedRes.error;
    const inserted = insertedRes.data;
    if (payload.tags && payload.tags.length)
      await upsertTagsAndJoins(supabase, bookId, inserted.id, payload.tags);
    return NextResponse.json({
      character: {
        id: inserted.id,
        bookId: inserted.book_id,
        name: inserted.name,
        notes: inserted.notes,
        position: inserted.position,
        tags:
          payload.tags?.map((t) =>
            typeof t === "string"
              ? normalizeTagName(t)
              : normalizeTagName(t.name),
          ) || [],
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
      },
    });
  } catch (e: any) {
    const status = e.message === "not found" ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// PUT: update character (id required)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseEnabled)
    return NextResponse.json({ disabled: true }, { status: 400 });
  const { id: bookId } = await context.params;
  const payload = (await req.json()) as UpsertCharacterPayload & { id: string };
  if (!payload.id)
    return NextResponse.json({ error: "id required" }, { status: 400 });
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const supabase = createServerSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const { data: existing, error: exErr } = await supabase
      .from("book_characters")
      .select("id")
      .eq("id", payload.id)
      .eq("book_id", bookId)
      .maybeSingle();
    if (exErr) throw exErr;
    if (!existing)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    let updatedRes = await supabase
      .from("book_characters")
      .update({
        name: payload.name,
        notes: payload.notes || "",
        position: payload.position,
      })
      .eq("id", payload.id)
      .select("id,book_id,name,notes,position,created_at,updated_at")
      .single();
    if (updatedRes.error && /notes/.test(updatedRes.error.message || "")) {
      updatedRes = await supabase
        .from("book_characters")
        .update({ name: payload.name, position: payload.position })
        .eq("id", payload.id)
        .select("id,book_id,name,position,created_at,updated_at")
        .single();
    }
    if (updatedRes.error) throw updatedRes.error;
    const updated = updatedRes.data;
    await upsertTagsAndJoins(supabase, bookId, updated.id, payload.tags || []);
    return NextResponse.json({
      character: {
        id: updated.id,
        bookId: updated.book_id,
        name: updated.name,
        notes: updated.notes,
        position: updated.position,
        tags: (payload.tags || []).map((t) =>
          typeof t === "string"
            ? normalizeTagName(t)
            : normalizeTagName(t.name),
        ),
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (e: any) {
    const status = e.message === "not found" ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// DELETE: ?id=characterId
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseEnabled)
    return NextResponse.json({ disabled: true }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const charId = searchParams.get("id");
  if (!charId)
    return NextResponse.json({ error: "id required" }, { status: 400 });
  const { id: bookId } = await context.params;
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const supabase = createServerSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    // Optionally capture payload for audit (future: insert into book_entity_deletions)
    const { data: row, error: selErr } = await supabase
      .from("book_characters")
      .select("*")
      .eq("id", charId)
      .eq("book_id", bookId)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { error: updErr } = await supabase
      .from("book_characters")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", charId);
    if (updErr) throw updErr;
    return NextResponse.json({ deleted: true, soft: true });
  } catch (e: any) {
    const status = e.message === "not found" ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// Restore soft-deleted character (?restore=<id>)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseEnabled)
    return NextResponse.json({ disabled: true }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const restoreId = searchParams.get("restore");
  if (!restoreId)
    return NextResponse.json({ error: "restore id required" }, { status: 400 });
  const { id: bookId } = await context.params;
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const supabase = createServerSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const { data: row, error: selErr } = await supabase
      .from("book_characters")
      .select("id")
      .eq("id", restoreId)
      .eq("book_id", bookId)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { error: updErr } = await supabase
      .from("book_characters")
      .update({ deleted_at: null })
      .eq("id", restoreId);
    if (updErr) throw updErr;
    return NextResponse.json({ restored: true });
  } catch (e: any) {
    const status = e.message === "not found" ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
