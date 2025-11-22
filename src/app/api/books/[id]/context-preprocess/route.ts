import { NextRequest, NextResponse } from 'next/server';
import { preprocessBookContext } from '../../../../../lib/server/context-preprocess';
import { isSupabaseEnabled } from '../../../../../lib/supabase-enabled';
import { createServerSupabase } from '../../../../../lib/supabase-server';

async function ensureBookOwnership(supabase: any, bookId: string, userId: string) {
  const { data, error } = await supabase
    .from('books')
    .select('id')
    .eq('id', bookId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) throw new Error('not-found');
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) {
    return NextResponse.json({ disabled: true }, { status: 400 });
  }

  const { id: bookId } = await context.params;

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    await ensureBookOwnership(supabase, bookId, user.id);

    // Allow client to provide extracted `pages` to the server so preprocessing
    // can run even when the DB doesn't store page text server-side.
    const body = await req.json().catch(() => null);
    const pages: string[] | undefined = body?.pages;

    const result = await preprocessBookContext(supabase, bookId, pages);

    return NextResponse.json({
      status: 'done',
      processedPages: result.processedPages,
      totalPages: result.totalPages
    });
  } catch (error: any) {
    if (error?.message === 'not-found' || error?.message === 'book-not-found') {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    console.error('context-preprocess failed', error);
    return NextResponse.json({ error: 'context-preprocess-failed' }, { status: 500 });
  }
}
