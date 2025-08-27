import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseEnabled } from '../../../../../lib/supabase-enabled';
import { createServerSupabase } from '../../../../../lib/supabase-server';

async function ensureBookOwnership(supabase: any, bookId: string, userId: string) {
  const { data, error } = await supabase.from('books').select('id').eq('id', bookId).eq('user_id', userId).maybeSingle();
  if (error || !data) throw new Error('not found');
}

function normalizeTagName(t: string): string { return t.trim().toLowerCase(); }

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
    const { data: locs, error: lErr } = await supabase.from('book_locations').select('id,name,notes,parent_id,position,depth,created_at,updated_at,deleted_at').eq('book_id', bookId).is('deleted_at', null).order('position', { ascending: true });
    if (lErr) throw lErr;
    let joinsRes: any = await supabase.from('book_location_tags').select('location_id, tag_id, color_override, book_id, created_at').eq('book_id', bookId);
    if (joinsRes.error && /created_at/.test(joinsRes.error.message || '')) {
      joinsRes = await supabase.from('book_location_tags').select('location_id, tag_id, color_override, book_id').eq('book_id', bookId);
    }
    if (joinsRes.error) throw joinsRes.error;
    const joins = joinsRes.data;
    const { data: tags, error: tErr } = await supabase.from('book_tags').select('id,name,color').eq('book_id', bookId);
    if (tErr) throw tErr;
    const tagMap = Object.fromEntries((tags || []).map(t => [t.id, t]));
    const byLoc: Record<string, { tags: string[]; tagColors: Record<string, string> }> = {};
    (joins || []).forEach((j: any) => {
      const tag = tagMap[j.tag_id];
      if (!tag) return;
      if (!byLoc[j.location_id]) byLoc[j.location_id] = { tags: [], tagColors: {} };
      byLoc[j.location_id].tags.push(tag.name);
      byLoc[j.location_id].tagColors[tag.name] = j.color_override || tag.color;
    });
    const result = (locs || []).map(l => ({
      id: l.id,
      name: l.name,
      notes: l.notes || '',
      parentId: l.parent_id,
      position: l.position,
      depth: l.depth,
      tags: byLoc[l.id]?.tags || [],
      tagColors: byLoc[l.id]?.tagColors || {},
      createdAt: l.created_at,
      updatedAt: l.updated_at
    }));
    return NextResponse.json({ locations: result });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

interface UpsertLocationPayload { id?: string; name: string; notes?: string; parentId?: string | null; position?: number; tags?: (string | { name: string; color?: string; overrideColor?: string })[] }

async function upsertTagsAndJoins(supabase: any, bookId: string, locationId: string, tags: UpsertLocationPayload['tags']) {
  const tagInputs = (tags || []).map(t => typeof t === 'string' ? { name: t } : t).filter(t => t.name && t.name.trim() !== '');
  const normalized = tagInputs.map(t => ({ ...t, norm: normalizeTagName(t.name) }));
  for (const ti of normalized) {
    const { error: upErr } = await supabase.from('book_tags').upsert({ book_id: bookId, name: ti.norm, color: ti.color || '#888888' }, { onConflict: 'book_id,name' });
    if (upErr) {
      if (/no unique|no\s+unique\s+or\s+exclusion/i.test(upErr.message || '')) {
        const { data: existing } = await supabase.from('book_tags').select('id').eq('book_id', bookId).eq('name', ti.norm).maybeSingle();
        if (!existing) {
          const { error: insErr } = await supabase.from('book_tags').insert({ book_id: bookId, name: ti.norm, color: ti.color || '#888888' });
          if (insErr && !/duplicate/i.test(insErr.message || '')) throw insErr;
        }
      } else throw upErr;
    }
  }
  const { data: tagRows, error: tErr } = await supabase.from('book_tags').select('id,name,color').eq('book_id', bookId).in('name', normalized.map(n => n.norm));
  if (tErr) throw tErr;
  const wantedIds = new Set<string>();
  for (const tr of tagRows || []) {
    wantedIds.add(tr.id);
    const input = normalized.find(n => n.norm === tr.name);
    const overrideColor = input?.overrideColor && /^#[0-9A-Fa-f]{6}$/.test(input.overrideColor) ? input.overrideColor : null;
    const { error: joinErr } = await supabase.from('book_location_tags').upsert({ location_id: locationId, tag_id: tr.id, color_override: overrideColor, book_id: bookId }, { onConflict: 'location_id,tag_id' });
    if (joinErr) throw joinErr;
  }
  const { data: existingJoins, error: exErr } = await supabase.from('book_location_tags').select('tag_id').eq('location_id', locationId);
  if (exErr) throw exErr;
  for (const ej of existingJoins || []) {
    if (!wantedIds.has(ej.tag_id)) {
      const { error: delErr } = await supabase.from('book_location_tags').delete().eq('location_id', locationId).eq('tag_id', ej.tag_id);
      if (delErr) throw delErr;
    }
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { id: bookId } = await context.params;
  const payload = await req.json() as UpsertLocationPayload;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const { data: inserted, error: insErr } = await supabase.from('book_locations').insert({ book_id: bookId, name: payload.name, notes: payload.notes || '', parent_id: payload.parentId || null, position: payload.position }).select('id,name,notes,parent_id,position,depth,created_at,updated_at').single();
    if (insErr) throw insErr;
    if (payload.tags?.length) await upsertTagsAndJoins(supabase, bookId, inserted.id, payload.tags);
    return NextResponse.json({ location: { id: inserted.id, name: inserted.name, notes: inserted.notes, parentId: inserted.parent_id, position: inserted.position, depth: inserted.depth, tags: (payload.tags || []).map(t => typeof t === 'string' ? normalizeTagName(t) : normalizeTagName(t.name)), createdAt: inserted.created_at, updatedAt: inserted.updated_at } });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { id: bookId } = await context.params;
  const payload = await req.json() as UpsertLocationPayload & { id: string };
  if (!payload.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const { data: existing, error: exErr } = await supabase.from('book_locations').select('id').eq('id', payload.id).eq('book_id', bookId).maybeSingle();
    if (exErr) throw exErr;
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { data: updated, error: updErr } = await supabase.from('book_locations').update({ name: payload.name, notes: payload.notes || '', parent_id: payload.parentId || null, position: payload.position }).eq('id', payload.id).select('id,name,notes,parent_id,position,depth,created_at,updated_at').single();
    if (updErr) throw updErr;
    await upsertTagsAndJoins(supabase, bookId, updated.id, payload.tags || []);
    return NextResponse.json({ location: { id: updated.id, name: updated.name, notes: updated.notes, parentId: updated.parent_id, position: updated.position, depth: updated.depth, tags: (payload.tags || []).map(t => typeof t === 'string' ? normalizeTagName(t) : normalizeTagName(t.name)), createdAt: updated.created_at, updatedAt: updated.updated_at } });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('id');
  if (!locationId) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { id: bookId } = await context.params;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await ensureBookOwnership(supabase, bookId, user.id);
    const { data: row, error: selErr } = await supabase.from('book_locations').select('id').eq('id', locationId).eq('book_id', bookId).maybeSingle();
    if (selErr) throw selErr;
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { error: updErr } = await supabase.from('book_locations').update({ deleted_at: new Date().toISOString() }).eq('id', locationId);
    if (updErr) throw updErr;
    return NextResponse.json({ deleted: true, soft: true });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// PATCH: restore soft-deleted location (?restore=<id>)
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
    const { data: row, error: selErr } = await supabase.from('book_locations').select('id').eq('id', restoreId).eq('book_id', bookId).maybeSingle();
    if (selErr) throw selErr;
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { error: updErr } = await supabase.from('book_locations').update({ deleted_at: null }).eq('id', restoreId);
    if (updErr) throw updErr;
    return NextResponse.json({ restored: true });
  } catch (e: any) {
    const status = e.message === 'not found' ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
