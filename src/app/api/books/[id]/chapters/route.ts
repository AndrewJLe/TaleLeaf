import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseEnabled } from '../../../../../lib/supabase-enabled';
import { createServerSupabase } from '../../../../../lib/supabase-server';

async function ensureBookOwnership(supabase: any, bookId: string, userId: string) {
  const { data, error } = await supabase.from('books').select('id').eq('id', bookId).eq('user_id', userId).maybeSingle();
  if (error || !data) throw new Error('not found');
}

function normalizeTagName(t: string): string { return t.trim().toLowerCase(); }

// GET chapters with tags
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { id: bookId } = await context.params;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    // Actual schema columns: title, notes, summary, analysis, position
    let chaptersRes = await supabase.from('book_chapters').select('id,title,notes,summary,analysis,position,number,created_at,updated_at,deleted_at').eq('book_id', bookId).is('deleted_at', null).order('position', { ascending: true });
    if (chaptersRes.error) throw chaptersRes.error;
    const chapters = chaptersRes.data;
    let joinsRes: any = await supabase.from('book_chapter_tags').select('chapter_id, tag_id, color_override, book_id, created_at').eq('book_id', bookId);
    if (joinsRes.error && /created_at/.test(joinsRes.error.message || '')) {
      joinsRes = await supabase.from('book_chapter_tags').select('chapter_id, tag_id, color_override, book_id').eq('book_id', bookId);
    }
    if (joinsRes.error) throw joinsRes.error;
    const joins = joinsRes.data;
    const { data: tags, error: tErr } = await supabase.from('book_tags').select('id,name,color').eq('book_id', bookId);
    if (tErr) throw tErr;
    const tagMap = Object.fromEntries((tags || []).map(t => [t.id, t]));
    const byChapter: Record<string, { tags: string[]; tagColors: Record<string, string> }> = {};
    (joins || []).forEach((j: any) => {
      const tag = tagMap[j.tag_id];
      if (!tag) return;
      if (!byChapter[j.chapter_id]) byChapter[j.chapter_id] = { tags: [], tagColors: {} };
      byChapter[j.chapter_id].tags.push(tag.name);
      byChapter[j.chapter_id].tagColors[tag.name] = j.color_override || tag.color;
    });
    const result = (chapters || []).map(c => ({
      id: c.id,
      name: c.title,
      title: c.title,
      position: c.position,
      number: (c as any).number, // optional ordering number distinct from position
      notes: c.notes || '',            // canonical field used by UI
      content: c.notes || '',          // backward compatibility (older code paths)
      summary: c.summary || '',
      analysis: c.analysis || '',
      tags: byChapter[c.id]?.tags || [],
      tagColors: byChapter[c.id]?.tagColors || {},
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));
    return NextResponse.json({ chapters: result });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

interface UpsertChapterPayload { id?: string; title: string; position?: number; content?: string; summary?: string; analysis?: string; tags?: (string | { name: string; color?: string; overrideColor?: string })[] }

async function upsertTagsAndJoins(supabase: any, bookId: string, chapterId: string, tags: UpsertChapterPayload['tags']) {
  const tagInputs = (tags || []).map(t => typeof t === 'string' ? { name: t } : t).filter(t => t.name && t.name.trim() !== '');
  const normalized = tagInputs.map(t => ({ ...t, norm: normalizeTagName(t.name) }));
  for (const ti of normalized) {
    const { error: upErr } = await supabase.from('book_tags').upsert({ book_id: bookId, name: ti.norm, color: ti.color || '#888888' }, { onConflict: 'book_id,name' });
    if (upErr) {
      // Broad fallback: attempt manual existence check + insert; only rethrow if second insert fails non-duplicate
      const { data: existing } = await supabase.from('book_tags').select('id').eq('book_id', bookId).eq('name', ti.norm).maybeSingle();
      if (!existing) {
        const { error: insErr } = await supabase.from('book_tags').insert({ book_id: bookId, name: ti.norm, color: ti.color || '#888888' });
        if (insErr && !/duplicate|already exists/i.test(insErr.message || '')) throw insErr;
      }
    }
  }
  const { data: tagRows, error: tErr } = await supabase.from('book_tags').select('id,name,color').eq('book_id', bookId).in('name', normalized.map(n => n.norm));
  if (tErr) throw tErr;
  const wantedIds = new Set<string>();
  for (const tr of tagRows || []) {
    wantedIds.add(tr.id);
    const input = normalized.find(n => n.norm === tr.name);
    const overrideColor = input?.overrideColor && /^#[0-9A-Fa-f]{6}$/.test(input.overrideColor) ? input.overrideColor : null;
    const { error: joinErr } = await supabase.from('book_chapter_tags').upsert({ chapter_id: chapterId, tag_id: tr.id, color_override: overrideColor, book_id: bookId }, { onConflict: 'chapter_id,tag_id' });
    if (joinErr) throw joinErr;
  }
  const { data: existingJoins, error: exErr } = await supabase.from('book_chapter_tags').select('tag_id').eq('chapter_id', chapterId);
  if (exErr) throw exErr;
  for (const ej of (existingJoins || [])) {
    if (!wantedIds.has(ej.tag_id)) {
      const { error: delErr } = await supabase.from('book_chapter_tags').delete().eq('chapter_id', chapterId).eq('tag_id', ej.tag_id);
      if (delErr) throw delErr;
    }
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { id: bookId } = await context.params;
  const payload = await req.json() as UpsertChapterPayload;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    // Derive next chapter number if schema requires non-null number
    let nextNumber: number | undefined = undefined;
    try {
      const { data: maxRow } = await supabase.from('book_chapters').select('number').eq('book_id', bookId).order('number', { ascending: false }).limit(1).maybeSingle();
      if (maxRow && typeof (maxRow as any).number === 'number') nextNumber = (maxRow as any).number + 1;
      else nextNumber = 1;
    } catch { }
    const insertBody: any = { book_id: bookId, title: payload.title, notes: payload.content || '', summary: payload.summary || '', analysis: payload.analysis || '', position: payload.position, number: nextNumber };
    const { data: inserted, error: insErr } = await supabase.from('book_chapters').insert(insertBody).select('id,title,notes,summary,analysis,position,number,created_at,updated_at').single();
    if (insErr) throw insErr;
    if (payload.tags?.length) await upsertTagsAndJoins(supabase, bookId, inserted.id, payload.tags);
    return NextResponse.json({ chapter: { id: inserted.id, name: inserted.title, title: inserted.title, position: inserted.position, number: (inserted as any).number, notes: inserted.notes, content: inserted.notes, summary: inserted.summary, analysis: inserted.analysis, tags: (payload.tags || []).map(t => typeof t === 'string' ? normalizeTagName(t) : normalizeTagName(t.name)), createdAt: inserted.created_at, updatedAt: inserted.updated_at } });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { id: bookId } = await context.params;
  const payload = await req.json() as UpsertChapterPayload & { id: string };
  if (!payload.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const { data: existing, error: exErr } = await supabase.from('book_chapters').select('id').eq('id', payload.id).eq('book_id', bookId).maybeSingle();
    if (exErr) throw exErr;
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const updateBody: any = { title: payload.title, notes: payload.content || '', summary: payload.summary || '', analysis: payload.analysis || '', position: payload.position };
    const { data: updated, error: updErr } = await supabase.from('book_chapters').update(updateBody).eq('id', payload.id).select('id,title,notes,summary,analysis,position,number,created_at,updated_at').single();
    if (updErr) throw updErr;
    await upsertTagsAndJoins(supabase, bookId, updated.id, payload.tags || []);
    return NextResponse.json({ chapter: { id: updated.id, name: updated.title, title: updated.title, position: updated.position, number: (updated as any).number, notes: updated.notes, content: updated.notes, summary: updated.summary, analysis: updated.analysis, tags: (payload.tags || []).map(t => typeof t === 'string' ? normalizeTagName(t) : normalizeTagName(t.name)), createdAt: updated.created_at, updatedAt: updated.updated_at } });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const chapterId = searchParams.get('id');
  if (!chapterId) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { id: bookId } = await context.params;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const { data: row, error: selErr } = await supabase.from('book_chapters').select('id').eq('id', chapterId).eq('book_id', bookId).maybeSingle();
    if (selErr) throw selErr;
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { error: updErr } = await supabase.from('book_chapters').update({ deleted_at: new Date().toISOString() }).eq('id', chapterId);
    if (updErr) throw updErr;
    return NextResponse.json({ deleted: true, soft: true });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// PATCH: restore soft-deleted chapter (?restore=<id>)
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const restoreId = searchParams.get('restore');
  if (!restoreId) return NextResponse.json({ error: 'restore id required' }, { status: 400 });
  const { id: bookId } = await context.params;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const { data: row, error: selErr } = await supabase.from('book_chapters').select('id').eq('id', restoreId).eq('book_id', bookId).maybeSingle();
    if (selErr) throw selErr;
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { error: updErr } = await supabase.from('book_chapters').update({ deleted_at: null }).eq('id', restoreId);
    if (updErr) throw updErr;
    return NextResponse.json({ restored: true });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
