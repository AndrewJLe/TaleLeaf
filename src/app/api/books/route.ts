import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseEnabled } from '../../../lib/supabase-enabled';
import { createServerSupabase } from '../../../lib/supabase-server';

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled) return NextResponse.json({ books: [] });
  const supabase = createServerSupabase();
  // If Authorization header present, set auth via setAuth (supabase-js v2 exposes auth.setSession but needs refresh token). Simpler: use getUser with header.
  const authHeader = req.headers.get('authorization');
  let user = null as any;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data } = await supabase.auth.getUser(token);
    user = data.user;
  } else {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }
  if (!user) return NextResponse.json({ books: [] }, { status: 401 });
  const { data, error } = await supabase.from('books').select('id,title,cover_url,window_start,window_end,updated_at,created_at').eq('user_id', user.id).order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ books: data });
}
