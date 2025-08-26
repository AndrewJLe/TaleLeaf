import { useCallback, useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabase-client';
import { isSupabaseEnabled } from '../lib/supabase-enabled';
import { BookNoteGroup, BookTag } from '../types/book';

interface UseBookTagGroupsResult {
  tags: BookTag[];
  groups: BookNoteGroup[];
  isLoading: boolean;
  error: string | null;
  upsertTag: (name: string, color: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  upsertGroup: (group: Partial<BookNoteGroup> & { name: string; color: string }) => Promise<string | void>;
  deleteGroup: (id: string) => Promise<void>;
  reorderGroups: (orderedIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useBookTagGroups(bookId: string, enabled: boolean = true): UseBookTagGroupsResult {
  const [tags, setTags] = useState<BookTag[]>([]);
  const [groups, setGroups] = useState<BookNoteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient || !bookId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [{ data: tagRows, error: tagErr }, { data: groupRows, error: groupErr }] = await Promise.all([
        supabaseClient.from('book_tags').select('*').eq('book_id', bookId).order('updated_at', { ascending: false }),
        supabaseClient.from('book_note_groups').select('*').eq('book_id', bookId).order('position', { ascending: true, nullsFirst: true }).order('created_at', { ascending: true })
      ]);
      if (tagErr) throw tagErr;
      if (groupErr) throw groupErr;
      setTags((tagRows || []).map((r: any) => ({ id: r.id, bookId: r.book_id, name: r.name, color: r.color, createdAt: r.created_at, updatedAt: r.updated_at })));
      setGroups((groupRows || []).map((r: any) => ({ id: r.id, bookId: r.book_id, name: r.name, color: r.color, position: r.position, createdAt: r.created_at, updatedAt: r.updated_at })));
    } catch (e: any) {
      console.error('Failed to fetch tags/groups', e);
      setError(e.message || 'Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  }, [bookId, enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upsertTag = useCallback(async (name: string, color: string) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;
    try {
      const normalized = name.toLowerCase();
      // Use explicit select -> update/insert flow to avoid REST upsert on_conflict issues
      const existing = await supabaseClient.from('book_tags').select('*').eq('book_id', bookId).eq('name', normalized).maybeSingle();
      if (existing.error) throw existing.error;
      let data: any[] | null = null;
      if (!existing.data) {
        const ins = await supabaseClient.from('book_tags').insert({ book_id: bookId, name: normalized, color }).select();
        if (ins.error) {
          // If duplicate error due to race, try to fetch again
          if (/duplicate|unique/i.test(ins.error.message || '')) {
            const refetch = await supabaseClient.from('book_tags').select('*').eq('book_id', bookId).eq('name', normalized).maybeSingle();
            if (refetch.error) throw refetch.error;
            data = refetch.data ? [refetch.data] : null;
          } else {
            console.error('Failed insert tag', ins.error);
            throw ins.error;
          }
        } else {
          data = ins.data as any[];
        }
      } else {
        if (existing.data.color !== color) {
          const upd = await supabaseClient.from('book_tags').update({ color }).eq('id', existing.data.id).select();
          if (upd.error) throw upd.error;
          data = upd.data as any[];
        } else {
          data = [existing.data];
        }
      }
      // Merge into local state to avoid full refetch flicker
      setTags(prev => {
        const existingIdx = prev.findIndex(t => t.name === normalized);
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = { ...copy[existingIdx], color };
          return copy;
        }
        const row: any = data?.[0];
        return [...prev, row ? { id: row.id, bookId: row.book_id, name: row.name, color: row.color, createdAt: row.created_at, updatedAt: row.updated_at } : { id: crypto.randomUUID(), bookId, name: normalized, color, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
      });
    } catch (e: any) {
      setError(e.message || 'Failed to upsert tag');
    }
  }, [bookId, enabled, fetchAll]);

  const deleteTag = useCallback(async (id: string) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;
    try {
      const { error: delErr } = await supabaseClient.from('book_tags').delete().eq('id', id);
      if (delErr) throw delErr;
      setTags(prev => prev.filter(t => t.id !== id));
    } catch (e: any) {
      setError(e.message || 'Failed to delete tag');
    }
  }, [enabled]);

  const upsertGroup = useCallback(async (group: Partial<BookNoteGroup> & { name: string; color: string }) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;
    const payload: any = { book_id: bookId, name: group.name, color: group.color };
    if (group.id) payload.id = group.id;
    if (group.position !== undefined) payload.position = group.position;
    try {
      const { data, error: upErr } = await supabaseClient.from('book_note_groups').upsert(payload).select().single();
      if (upErr) throw upErr;
      await fetchAll();
      return data?.id as string;
    } catch (e: any) {
      setError(e.message || 'Failed to upsert group');
    }
  }, [bookId, enabled, fetchAll]);

  const deleteGroup = useCallback(async (id: string) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;
    try {
      const { error: delErr } = await supabaseClient.from('book_note_groups').delete().eq('id', id);
      if (delErr) throw delErr;
      setGroups(prev => prev.filter(g => g.id !== id));
    } catch (e: any) {
      setError(e.message || 'Failed to delete group');
    }
  }, [enabled]);

  const reorderGroups = useCallback(async (orderedIds: string[]) => {
    if (!enabled || !isSupabaseEnabled || !supabaseClient) return;
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        const position = i * 1000;
        const { error: updErr } = await supabaseClient.from('book_note_groups').update({ position }).eq('id', id);
        if (updErr) throw updErr;
      }
      await fetchAll();
    } catch (e: any) {
      setError(e.message || 'Failed to reorder groups');
    }
  }, [enabled, fetchAll]);

  return { tags, groups, isLoading, error, upsertTag, deleteTag, upsertGroup, deleteGroup, reorderGroups, refresh: fetchAll };
}
