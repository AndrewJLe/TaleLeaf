import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseEnabled } from '../../../../../lib/supabase-enabled';
import { createServerSupabase } from '../../../../../lib/supabase-server';

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: bookId } = await context.params; // params as Promise per Next.js typed route expectations
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const { sections, window } = body as { sections: any; window?: { start: number; end: number } };
  try {
    // Ensure ownership
    const { data: owned, error: ownErr } = await supabase.from('books').select('id').eq('id', bookId).eq('user_id', user.id).single();
    if (ownErr || !owned) return NextResponse.json({ error: 'not found' }, { status: 404 });

    const upsertSection = async (type: string, data: any) => {
      // Try update first
      const { data: existing, error: selErr } = await supabase.from('sections').select('id').eq('book_id', bookId).eq('type', type).maybeSingle();
      if (selErr) throw selErr;
      if (existing) {
        const { error: updErr } = await supabase.from('sections').update({ data }).eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('sections').insert({ book_id: bookId, type, data });
        if (insErr) throw insErr;
      }
    };

    await upsertSection('characters', { items: sections.characters });
    await upsertSection('chapters', { items: sections.chapters });
    await upsertSection('locations', { items: sections.locations });
    await upsertSection('notes', { content: sections.notes });

    if (window) {
      const { error: winErr } = await supabase.from('books').update({ window_start: window.start, window_end: window.end }).eq('id', bookId);
      if (winErr) throw winErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
