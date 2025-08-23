import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseEnabled } from '../../../../../lib/supabase-enabled';
import { createServerSupabase } from '../../../../../lib/supabase-server';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; // Next.js provides params as a Promise in typed routes
  if (!isSupabaseEnabled) return NextResponse.json({ disabled: true }, { status: 400 });
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const { coverUrl, title, window, pdfPath, pdfPageCount } = body as { coverUrl?: string; title?: string; window?: { start: number; end: number }; pdfPath?: string; pdfPageCount?: number };
  const update: any = {};
  if (coverUrl) update.cover_url = coverUrl;
  if (title) update.title = title;
  if (window) { update.window_start = window.start; update.window_end = window.end; }
  if (pdfPath !== undefined) update.pdf_path = pdfPath;
  if (pdfPageCount !== undefined) update.pdf_page_count = pdfPageCount;
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });
  const { error } = await supabase.from('books').update(update).eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
