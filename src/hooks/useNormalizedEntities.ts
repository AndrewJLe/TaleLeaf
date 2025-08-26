import { useCallback, useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabase-client';
import { Chapter, Character, Location } from '../types/book';

interface BaseResult<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: Partial<T> & { name?: string; title?: string }) => Promise<T | null>;
  update: (id: string, patch: Partial<T>) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
  reorder: (orderedIds: string[]) => Promise<void>;
}

async function jsonFetch<T>(url: string, options?: RequestInit, attempt = 1): Promise<T> {
  let authHeaders: Record<string, string> = {};
  try {
    if (typeof window !== 'undefined' && supabaseClient) {
      // Always refetch session (cheap) to reduce race with initial hydration
      const { data: { session } } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (token) authHeaders.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[jsonFetch] token retrieval failed', e);
  }
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}), ...authHeaders } });
  if (!res.ok) {
    const text = await res.text();
    // Retry once on 401 or 500 that looks like auth (missing or expired)
    if (attempt === 1 && (res.status === 401 || (res.status === 500 && /unauth|JW|token/i.test(text)))) {
      await new Promise(r => setTimeout(r, 150));
      return jsonFetch<T>(url, options, 2);
    }
    const err = new Error(text || `Request failed ${res.status}`);
    // Attach status for caller diagnostics
    (err as any).status = res.status;
    // eslint-disable-next-line no-console
    console.error('[jsonFetch error]', { url, status: res.status, body: text });
    throw err;
  }
  return res.json();
}

export function useNormalizedCharacters(bookId: string, enable: boolean): BaseResult<Character> {
  const [items, setItems] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enable) return;
    setLoading(true); setError(null);
    try {
      const data = await jsonFetch<{ characters: any }>(`/api/books/${bookId}/characters`);
      if (Array.isArray(data.characters) && data.characters.length === 0) {
        // Fallback debug fetch to inspect raw rows (non-fatal; only in dev situations).
        try {
          const debug = await jsonFetch<{ characters: any; _debug?: any }>(`/api/books/${bookId}/characters?debug=1`);
          if (debug._debug) {
            // eslint-disable-next-line no-console
            console.log('[useNormalizedCharacters debug]', debug._debug);
          }
        } catch { /* ignore */ }
      }
      setItems(data.characters);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [bookId, enable]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (input: Partial<Character> & { name?: string }) => {
    if (!enable) return null;
    const payload = { name: input.name || 'Unnamed', notes: input.notes || '', tags: input.tags || [] };
    const data = await jsonFetch<{ character: any }>(`/api/books/${bookId}/characters`, { method: 'POST', body: JSON.stringify(payload) });
    setItems(prev => [...prev, data.character]);
    return data.character;
  }, [bookId, enable]);

  const update = useCallback(async (id: string, patch: Partial<Character>) => {
    if (!enable) return null;
    const existing = items.find(c => c.id === id);
    if (!existing) return null;
    const payload = { id, name: patch.name || existing.name, notes: patch.notes ?? existing.notes, tags: patch.tags || existing.tags };
    const data = await jsonFetch<{ character: any }>(`/api/books/${bookId}/characters`, { method: 'PUT', body: JSON.stringify(payload) });
    setItems(prev => prev.map(c => c.id === id ? data.character : c));
    return data.character;
  }, [bookId, enable, items]);

  const remove = useCallback(async (id: string) => {
    if (!enable) return false;
    await jsonFetch(`/api/books/${bookId}/characters?id=${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(c => c.id !== id));
    return true;
  }, [bookId, enable]);

  const reorder = useCallback(async (orderedIds: string[]) => {
    if (!enable) return;
    try {
      // Optimistically update local state first for immediate UI response
      const orderedItems = orderedIds.map((id, index) => {
        const item = items.find(c => c.id === id);
        return item ? { ...item, position: index * 1000 } : null;
      }).filter(Boolean) as Character[];
      setItems(orderedItems);

      // Update positions via API in background
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        const position = i * 1000;
        await jsonFetch(`/api/books/${bookId}/characters`, {
          method: 'PUT',
          body: JSON.stringify({ id, position })
        });
      }
    } catch (e: any) {
      setError(e.message);
      // Revert optimistic update on error
      refresh();
    }
  }, [bookId, enable, items, refresh]);

  return { items, loading, error, refresh, create, update, remove, reorder };
}

export function useNormalizedChapters(bookId: string, enable: boolean): BaseResult<Chapter> {
  const [items, setItems] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!enable) return; setLoading(true); setError(null);
    try { const data = await jsonFetch<{ chapters: any }>(`/api/books/${bookId}/chapters`); setItems(data.chapters); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [bookId, enable]);
  useEffect(() => { refresh(); }, [refresh]);
  const create = useCallback(async (input: Partial<Chapter> & { title?: string }) => {
    if (!enable) return null;
    const payload = { title: input.title || input.name || 'Untitled', position: input.position, content: input.notes || '', summary: (input as any).summary, analysis: (input as any).analysis, tags: input.tags || [] };
    const data = await jsonFetch<{ chapter: any }>(`/api/books/${bookId}/chapters`, { method: 'POST', body: JSON.stringify(payload) });
    setItems(prev => [...prev, data.chapter]);
    return data.chapter;
  }, [bookId, enable]);
  const update = useCallback(async (id: string, patch: Partial<Chapter>) => {
    if (!enable) return null;
    const existing = items.find(c => c.id === id); if (!existing) return null;
    const payload = { id, title: patch.title || existing.title || existing.name, position: patch.position ?? existing.position, content: patch.notes ?? existing.notes, summary: patch.summary ?? existing.summary, analysis: patch.analysis ?? existing.analysis, tags: patch.tags || existing.tags };
    const data = await jsonFetch<{ chapter: any }>(`/api/books/${bookId}/chapters`, { method: 'PUT', body: JSON.stringify(payload) });
    setItems(prev => prev.map(c => c.id === id ? data.chapter : c));
    return data.chapter;
  }, [bookId, enable, items]);
  const remove = useCallback(async (id: string) => { if (!enable) return false; await jsonFetch(`/api/books/${bookId}/chapters?id=${id}`, { method: 'DELETE' }); setItems(prev => prev.filter(c => c.id !== id)); return true; }, [bookId, enable]);
  const reorder = useCallback(async (orderedIds: string[]) => {
    if (!enable) return;
    try {
      const orderedItems = orderedIds.map((id, index) => {
        const item = items.find(c => c.id === id);
        return item ? { ...item, position: index * 1000 } : null;
      }).filter(Boolean) as Chapter[];
      setItems(orderedItems);
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        const position = i * 1000;
        await jsonFetch(`/api/books/${bookId}/chapters`, { method: 'PUT', body: JSON.stringify({ id, position }) });
      }
    } catch (e: any) { setError(e.message); refresh(); }
  }, [bookId, enable, items, refresh]);
  return { items, loading, error, refresh, create, update, remove, reorder };
}

export function useNormalizedLocations(bookId: string, enable: boolean): BaseResult<Location> {
  const [items, setItems] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { if (!enable) return; setLoading(true); setError(null); try { const data = await jsonFetch<{ locations: any }>(`/api/books/${bookId}/locations`); setItems(data.locations); } catch (e: any) { setError(e.message); } finally { setLoading(false); } }, [bookId, enable]);
  useEffect(() => { refresh(); }, [refresh]);
  const create = useCallback(async (input: Partial<Location> & { name?: string }) => { if (!enable) return null; const payload = { name: input.name || 'Unnamed', notes: input.notes || '', parentId: input.parentId || null, position: input.position, tags: input.tags || [] }; const data = await jsonFetch<{ location: any }>(`/api/books/${bookId}/locations`, { method: 'POST', body: JSON.stringify(payload) }); setItems(prev => [...prev, data.location]); return data.location; }, [bookId, enable]);
  const update = useCallback(async (id: string, patch: Partial<Location>) => { if (!enable) return null; const existing = items.find(l => l.id === id); if (!existing) return null; const payload = { id, name: patch.name || existing.name, notes: patch.notes ?? existing.notes, parentId: patch.parentId ?? existing.parentId ?? null, position: patch.position ?? existing.position, tags: patch.tags || existing.tags }; const data = await jsonFetch<{ location: any }>(`/api/books/${bookId}/locations`, { method: 'PUT', body: JSON.stringify(payload) }); setItems(prev => prev.map(l => l.id === id ? data.location : l)); return data.location; }, [bookId, enable, items]);
  const remove = useCallback(async (id: string) => { if (!enable) return false; await jsonFetch(`/api/books/${bookId}/locations?id=${id}`, { method: 'DELETE' }); setItems(prev => prev.filter(l => l.id !== id)); return true; }, [bookId, enable]);
  const reorder = useCallback(async (orderedIds: string[]) => {
    if (!enable) return;
    try {
      const orderedItems = orderedIds.map((id, index) => {
        const item = items.find(l => l.id === id);
        return item ? { ...item, position: index * 1000 } : null;
      }).filter(Boolean) as Location[];
      setItems(orderedItems);
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        const position = i * 1000;
        await jsonFetch(`/api/books/${bookId}/locations`, { method: 'PUT', body: JSON.stringify({ id, position }) });
      }
    } catch (e: any) { setError(e.message); refresh(); }
  }, [bookId, enable, items, refresh]);
  return { items, loading, error, refresh, create, update, remove, reorder };
}
