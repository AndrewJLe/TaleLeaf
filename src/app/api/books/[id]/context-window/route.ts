import { NextRequest, NextResponse } from 'next/server';
import { WindowSelection } from '../../../../../lib/context-window';
import { buildContextWindowResult, buildPageFocusedContextWindowResult, extractExplicitPageFromQuestion } from '../../../../../lib/server/context-window';
import { isSupabaseEnabled } from '../../../../../lib/supabase-enabled';
import { createServerSupabase } from '../../../../../lib/supabase-server';

async function ensureBookOwnership(supabase: any, bookId: string, userId: string) {
  const { data, error } = await supabase.from('books').select('id').eq('id', bookId).eq('user_id', userId).maybeSingle();
  if (error || !data) throw new Error('not-found');
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled) {
    return NextResponse.json({ disabled: true }, { status: 400 });
  }

  const { id: bookId } = await context.params;
  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const question: string = (payload.question || '').trim();
  if (!question) {
    return NextResponse.json({ error: 'question-required' }, { status: 400 });
  }

  const selection: WindowSelection = payload.window?.type
    ? payload.window
    : { type: 'pages', start: payload.window?.start ?? payload.start ?? 1, end: payload.window?.end ?? payload.end ?? 1 };

  // Best-effort extraction of an explicit page reference from the user's question.
  const explicitPage = extractExplicitPageFromQuestion(question);

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = createServerSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // Early debug log: always record the incoming request (helps when ownership/auth fails)
    try {
      console.log('[debug] context-window incoming', { bookId, selection, question });
    } catch (_) {
      // ignore logging errors
    }

    await ensureBookOwnership(supabase, bookId, user.id);
    // Debug: log authenticated request details (user id included)
    try {
      console.log('context-window request', { bookId, userId: user.id, selection, question, explicitPage });
    } catch (_) {
      // ignore logging errors
    }

    // If the question clearly targets a single page, apply deterministic
    // outside/inside window logic so we never tell the user they haven't
    // reached an in-window page.
    if (explicitPage && selection.type === 'pages') {
      const { start, end } = selection;
      if (explicitPage < start || explicitPage > end) {
        return NextResponse.json({
          ready: true,
          result: null,
          contextText: '',
          resolvedWindow: { start, end, chapterIndices: [] },
          message: `Page ${explicitPage} is outside your current reading window (${start}–${end}), so I can't answer that yet. You can expand the window to include that page if you want more detail.`
        });
      }

      // For in-window explicit page questions, use a minimal page-focused
      // context builder to reduce token usage.
      const retrieval = await buildPageFocusedContextWindowResult({
        supabase,
        bookId,
        page: explicitPage,
        question,
        maxContextTokens: payload.maxContextTokens ?? 900
      });

      const { contextText, resolvedWindow, ...result } = retrieval;
      return NextResponse.json({
        ready: true,
        result,
        contextText,
        resolvedWindow
      });
    }

    const retrieval = await buildContextWindowResult({
      supabase,
      bookId,
      window: selection,
      question,
      maxContextTokens: payload.maxContextTokens ?? 1800,
      desiredK: payload.desiredK ?? { min: 4, max: 8 },
      includeRawParagraphs: payload.includeRawParagraphs ?? true
    });

    const { contextText, resolvedWindow, ...result } = retrieval;
    return NextResponse.json({
      ready: true,
      result,
      contextText,
      resolvedWindow
    });
  } catch (error: any) {
    if (error?.message === 'context-window-data-missing') {
      return NextResponse.json({ ready: false, reason: 'context-window-data-missing' }, { status: 202 });
    }
    if (error?.message === 'not-found') {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    console.error('context-window build failed', error);
    return NextResponse.json({ error: 'context-window-failed' }, { status: 500 });
  }
}
