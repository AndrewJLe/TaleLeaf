import { isSupabaseEnabled } from "../supabase-enabled";
import { createServerSupabase } from "../supabase-server";

interface LocalBook {
  id: string;
  title: string;
  window: { start: number; end: number };
  sections: {
    characters: { name: string; notes: string }[];
    chapters: { name: string; notes: string }[];
    locations: { name: string; notes: string }[];
    notes: string;
  };
  uploads?: Array<{ id: string; filename: string; type: string; pageCount: number; }>; // simplified
  cover?: string | null;
}

export async function listBooksForUser(userId: string) {
  if (!isSupabaseEnabled) return [];
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from('books').select('id,title,cover_url,window_start,window_end,created_at,updated_at').eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function importLocalBook(userId: string, local: LocalBook) {
  if (!isSupabaseEnabled) return { skipped: true };
  const supabase = createServerSupabase();
  // Insert book (use provided id to preserve references)
  const { error: bookErr } = await supabase.from('books').upsert({
    id: local.id,
    user_id: userId,
    title: local.title,
    cover_url: null, // cover handling deferred (could store data URL -> storage later)
    window_start: local.window.start,
    window_end: local.window.end
  }, { onConflict: 'id' });
  if (bookErr) throw bookErr;

  const sectionPayloads = [
    { type: 'characters', data: { items: local.sections.characters } },
    { type: 'chapters', data: { items: local.sections.chapters } },
    { type: 'locations', data: { items: local.sections.locations } },
    { type: 'notes', data: { content: local.sections.notes } }
  ];
  for (const s of sectionPayloads) {
    const { error: secErr } = await supabase.from('sections').upsert({
      book_id: local.id,
      type: s.type,
      data: s.data
    }, { onConflict: 'book_id,type' as any });
    if (secErr) throw secErr;
  }
  return { imported: true };
}
