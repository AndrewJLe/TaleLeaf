import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseEnabled } from '../../../../../lib/supabase-enabled';
import { createServerSupabase } from '../../../../../lib/supabase-server';

async function ensureBookOwnership(supabase: any, bookId: string, userId: string) {
  const { data, error } = await supabase.from('books').select('id').eq('id', bookId).eq('user_id', userId).maybeSingle();
  if (error || !data) throw new Error('not found');
}

// GET list notes (normalized book_notes table)
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
    const { data, error } = await supabase.from('book_notes').select('id,book_id,title,body,position,spoiler_protected,min_visible_page,group_id,created_at,updated_at,deleted_at').eq('book_id', bookId).is('deleted_at', null).order('position', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw error;
    const noteIds = (data || []).map(n => n.id);
    let tagMap: Record<string, string[]> = {};
    if (noteIds.length) {
      const { data: joinRows } = await supabase.from('book_note_tags')
        .select('note_id, tag:book_tags(name)')
        .in('note_id', noteIds);
      (joinRows || []).forEach((r: any) => {
        const name = r.tag?.name;
        if (!name) return;
        if (!tagMap[r.note_id]) tagMap[r.note_id] = [];
        if (!tagMap[r.note_id].includes(name)) tagMap[r.note_id].push(name);
      });
    }
    const notes = (data || []).map((n, index) => {
      // Generate a stable default title based on position or ID if title is null
      const defaultTitle = n.position !== null && n.position !== undefined
        ? `Note ${(n.position / 1000) + 1}`
        : `Note ${n.id.slice(-4)}`;

      return {
        id: n.id,
        bookId: n.book_id,
        // Generate default title if null/undefined in database
        title: n.title || defaultTitle,
        body: n.body || '',
        tags: tagMap[n.id] || [],
        position: n.position || 0,
        spoilerProtected: n.spoiler_protected || false,
        minVisiblePage: n.min_visible_page ?? undefined,
        groupId: n.group_id ?? null,
        createdAt: n.created_at,
        updatedAt: n.updated_at
      };
    });
    return NextResponse.json({ notes });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

interface UpsertNotePayload { id?: string; title?: string; body: string; tags?: string[]; position?: number; spoilerProtected?: boolean; minVisiblePage?: number; groupId?: string | null }

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { id: bookId } = await context.params;
  const payload = await req.json() as UpsertNotePayload;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const insertBody: any = {
      book_id: bookId,
      // Ensure title is never null - use default if not provided
      title: payload.title || `Note ${(payload.position || 0) / 1000 + 1}`,
      body: payload.body || '',
      position: payload.position,
      spoiler_protected: payload.spoilerProtected || false,
      min_visible_page: payload.minVisiblePage ?? null,
      group_id: payload.groupId ?? null
    };
    const { data: inserted, error: insErr } = await supabase.from('book_notes').insert(insertBody).select('id,book_id,title,body,position,spoiler_protected,min_visible_page,group_id,created_at,updated_at').single();
    if (insErr) throw insErr;

    // Ensure tag metadata + join rows (book_note_tags) are persisted
    if ((payload.tags || []).length) {
      const tagNames = (payload.tags || []).map(t => t.toLowerCase()).filter(t => !!t);
      if (tagNames.length) {
        // Upsert tags metadata (ignore conflicts)
        for (const name of tagNames) {
          try {
            const { error: tagErr } = await supabase.from('book_tags').upsert({ book_id: bookId, name }).select('id').single();
            if (tagErr && tagErr.code !== '23505') console.warn('tag upsert issue', tagErr);
          } catch { /* ignore */ }
        }
        // Fetch tag ids
        const { data: tagRows } = await supabase.from('book_tags').select('id,name').eq('book_id', bookId).in('name', tagNames);
        const tagIdMap: Record<string, string> = {};
        (tagRows || []).forEach(r => { tagIdMap[r.name] = r.id; });
        for (const name of tagNames) {
          const tagId = tagIdMap[name];
          if (!tagId) continue;
          try { await supabase.from('book_note_tags').upsert({ note_id: inserted.id, tag_id: tagId }); } catch { /* ignore */ }
        }
      }
    }
    // Get the tags for the response
    const { data: insertedJoins } = await supabase.from('book_note_tags')
      .select('tag:book_tags(name)')
      .eq('note_id', inserted.id);
    const insertedTagNames = (insertedJoins || []).map((j: any) => j.tag?.name).filter((n: string) => !!n);

    return NextResponse.json({
      note: {
        id: inserted.id,
        bookId: inserted.book_id,
        title: inserted.title ?? undefined,
        body: inserted.body || '',
        tags: insertedTagNames,
        position: inserted.position || 0,
        spoilerProtected: inserted.spoiler_protected || false,
        minVisiblePage: inserted.min_visible_page ?? undefined,
        groupId: inserted.group_id ?? null,
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at
      }
    });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { id: bookId } = await context.params;
  const payload = await req.json() as UpsertNotePayload & { id: string };
  if (!payload.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const { data: existing, error: exErr } = await supabase.from('book_notes').select('id').eq('id', payload.id).eq('book_id', bookId).maybeSingle();
    if (exErr) throw exErr;
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const updateBody: any = {
      position: payload.position
    };

    // Only include fields that are explicitly provided
    if (payload.title !== undefined) updateBody.title = payload.title;
    if (payload.body !== undefined) updateBody.body = payload.body;
    if (payload.spoilerProtected !== undefined) updateBody.spoiler_protected = payload.spoilerProtected;
    if (payload.minVisiblePage !== undefined) updateBody.min_visible_page = payload.minVisiblePage;
    if (payload.groupId !== undefined) updateBody.group_id = payload.groupId;
    const { data: updated, error: updErr } = await supabase.from('book_notes').update(updateBody).eq('id', payload.id).select('id,book_id,title,body,position,spoiler_protected,min_visible_page,group_id,created_at,updated_at').single();
    if (updErr) throw updErr;

    // Sync note tag joins only if tags were explicitly provided
    if (payload.tags !== undefined) {
      const newTagNames = (payload.tags || []).map(t => t.toLowerCase()).filter(t => !!t);
      // Upsert tag metadata
      for (const name of newTagNames) {
        try { await supabase.from('book_tags').upsert({ book_id: bookId, name }).select('id').single(); } catch { /* ignore */ }
      }
      // Existing join tag names
      const { data: existingJoins } = await supabase.from('book_note_tags')
        .select('tag_id, tag:book_tags(name)')
        .eq('note_id', payload.id);
      const existingNames = (existingJoins || []).map((j: any) => j.tag?.name).filter((n: string) => !!n);
      const toAdd = newTagNames.filter(n => !existingNames.includes(n));
      const toRemove = existingNames.filter(n => !newTagNames.includes(n));
      if (toAdd.length || toRemove.length) {
        // Fetch tag ids for all involved names
        const involved = Array.from(new Set([...toAdd, ...toRemove]));
        const { data: involvedTags } = await supabase.from('book_tags').select('id,name').eq('book_id', bookId).in('name', involved);
        const idByName: Record<string, string> = {};
        (involvedTags || []).forEach(r => { idByName[r.name] = r.id; });
        for (const name of toAdd) {
          const tagId = idByName[name];
          if (tagId) { try { await supabase.from('book_note_tags').upsert({ note_id: payload.id, tag_id: tagId }); } catch { /* ignore */ } }
        }
        if (toRemove.length) {
          const removeIds = toRemove.map(n => idByName[n]).filter(Boolean);
          if (removeIds.length) await Promise.all(removeIds.map(id => supabase.from('book_note_tags').delete().eq('note_id', payload.id).eq('tag_id', id)));
        }
      }
    }
    // Get the updated tags for the response
    const { data: updatedJoins } = await supabase.from('book_note_tags')
      .select('tag:book_tags(name)')
      .eq('note_id', updated.id);
    const updatedTagNames = (updatedJoins || []).map((j: any) => j.tag?.name).filter((n: string) => !!n);

    return NextResponse.json({
      note: {
        id: updated.id,
        bookId: updated.book_id,
        title: updated.title || `Note ${(updated.position || 0) / 1000 + 1}`,
        body: updated.body || '',
        tags: updatedTagNames,
        position: updated.position || 0,
        spoilerProtected: updated.spoiler_protected || false,
        minVisiblePage: updated.min_visible_page ?? undefined,
        groupId: updated.group_id ?? null,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
      }
    });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const noteId = searchParams.get('id');
  if (!noteId) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { id: bookId } = await context.params;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const { data: row, error: selErr } = await supabase.from('book_notes').select('id').eq('id', noteId).eq('book_id', bookId).maybeSingle();
    if (selErr) throw selErr;
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { error: updErr } = await supabase.from('book_notes').update({ deleted_at: new Date().toISOString() }).eq('id', noteId);
    if (updErr) throw updErr;
    return NextResponse.json({ deleted: true, soft: true });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// PATCH: restore soft-deleted note (?restore=<id>)
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
    const { data: row, error: selErr } = await supabase.from('book_notes').select('id').eq('id', restoreId).eq('book_id', bookId).maybeSingle();
    if (selErr) throw selErr;
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { error: updErr } = await supabase.from('book_notes').update({ deleted_at: null }).eq('id', restoreId);
    if (updErr) throw updErr;
    return NextResponse.json({ restored: true });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
