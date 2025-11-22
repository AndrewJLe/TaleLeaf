import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseClient } from "../lib/supabase-client";
import { trackEntityRestored } from "../lib/telemetry";
import { BookNote, Chapter, Character, Location } from "../types/book";

interface BaseResult<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (
    input: Partial<T> & { name?: string; title?: string },
  ) => Promise<T | null>;
  update: (id: string, patch: Partial<T>) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
  reorder: (orderedIds: string[]) => Promise<void>;
  lastRemoved?: { id: string; entity: T } | null;
  undoRemove?: () => Promise<boolean>;
}

async function jsonFetch<T>(
  url: string,
  options?: RequestInit,
  attempt = 1,
): Promise<T> {
  const authHeaders: Record<string, string> = {};
  try {
    if (typeof window !== "undefined" && supabaseClient) {
      // Always refetch session (cheap) to reduce race with initial hydration
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (token) authHeaders.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn("[jsonFetch] token retrieval failed", e);
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
      ...authHeaders,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    // Retry once on 401 or 500 that looks like auth (missing or expired)
    if (
      attempt === 1 &&
      (res.status === 401 ||
        (res.status === 500 && /unauth|JW|token/i.test(text)))
    ) {
      await new Promise((r) => setTimeout(r, 150));
      return jsonFetch<T>(url, options, 2);
    }
    const err = new Error(text || `Request failed ${res.status}`);
    // Attach status for caller diagnostics
    (err as any).status = res.status;
    console.error("[jsonFetch error]", { url, status: res.status, body: text });
    throw err;
  }
  return res.json();
}

export function useNormalizedCharacters(
  bookId: string,
  enable: boolean,
): BaseResult<Character> {
  const [items, setItems] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncesRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const refresh = useCallback(async () => {
    if (!enable) return;
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetch<{ characters: any }>(
        `/api/books/${bookId}/characters`,
      );
      if (Array.isArray(data.characters) && data.characters.length === 0) {
        // Fallback debug fetch to inspect raw rows (non-fatal; only in dev situations).
        try {
          const debug = await jsonFetch<{ characters: any; _debug?: any }>(
            `/api/books/${bookId}/characters?debug=1`,
          );
          if (debug._debug) {
            console.log("[useNormalizedCharacters debug]", debug._debug);
          }
        } catch {
          /* ignore */
        }
      }
      setItems(data.characters);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [bookId, enable]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: Partial<Character> & { name?: string }) => {
      if (!enable) return null;
      const tempId = `temp-${crypto.randomUUID()}`;
      const payload = {
        name: input.name || "Unnamed",
        notes: input.notes || "",
        tags: input.tags || [],
      };

      // Optimistic update: add to state immediately with temp ID
      const optimisticCharacter: Character = {
        id: tempId,
        name: payload.name,
        notes: payload.notes,
        tags: payload.tags,
        position: input.position ?? items.length * 1000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setItems((prev) => [...prev, optimisticCharacter]);

      try {
        const data = await jsonFetch<{ character: any }>(
          `/api/books/${bookId}/characters`,
          { method: "POST", body: JSON.stringify(payload) },
        );
        // Replace temp ID with real ID, preserving the optimistic position
        setItems((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? { ...data.character, position: optimisticCharacter.position }
              : c,
          ),
        );
        return data.character;
      } catch (e: any) {
        // Remove optimistic update on error
        setItems((prev) => prev.filter((c) => c.id !== tempId));
        setError(e.message);
        throw e;
      }
    },
    [bookId, enable, items.length],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Character>) => {
      if (!enable) return null;
      const existing = items.find((c) => c.id === id);
      if (!existing) return null;

      // Optimistic update: update local state immediately
      const optimisticUpdate = { ...existing, ...patch };
      setItems((prev) => prev.map((c) => (c.id === id ? optimisticUpdate : c)));

      // Clear existing debounce
      const existingTimeout = debouncesRef.current.get(id);
      if (existingTimeout) clearTimeout(existingTimeout);

      // Debounce the API call
      const timeout = setTimeout(async () => {
        debouncesRef.current.delete(id);
        try {
          const payload = {
            id,
            name: patch.name || existing.name,
            notes: patch.notes ?? existing.notes,
            tags: patch.tags || existing.tags,
          };
          const data = await jsonFetch<{ character: any }>(
            `/api/books/${bookId}/characters`,
            { method: "PUT", body: JSON.stringify(payload) },
          );
          // Update with server response
          setItems((prev) =>
            prev.map((c) => (c.id === id ? data.character : c)),
          );
          return data.character;
        } catch (e: any) {
          // Revert optimistic update on error
          setItems((prev) => prev.map((c) => (c.id === id ? existing : c)));
          setError(e.message);
          throw e;
        }
      }, 500); // 500ms debounce

      debouncesRef.current.set(id, timeout);
      return optimisticUpdate;
    },
    [bookId, enable, items],
  );

  const [lastRemoved, setLastRemoved] = useState<{
    id: string;
    entity: Character;
  } | null>(null);
  const remove = useCallback(
    async (id: string) => {
      if (!enable) return false;
      const existing = items.find((c) => c.id === id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      try {
        await jsonFetch(`/api/books/${bookId}/characters?id=${id}`, {
          method: "DELETE",
        });
        if (existing) setLastRemoved({ id, entity: existing });
        return true;
      } catch (e: any) {
        setError(e.message);
        if (existing) setItems((prev) => [...prev, existing]);
        return false;
      }
    },
    [bookId, enable, items],
  );
  const undoRemove = useCallback(async () => {
    if (!enable || !lastRemoved) return false;
    try {
      await jsonFetch(
        `/api/books/${bookId}/characters?restore=${lastRemoved.id}`,
        { method: "PATCH" },
      );
      setItems((prev) => [...prev, lastRemoved.entity]);
      trackEntityRestored("character");
      setLastRemoved(null);
      return true;
    } catch {
      return false;
    }
  }, [bookId, enable, lastRemoved]);

  const reorder = useCallback(
    async (orderedIds: string[]) => {
      if (!enable) return;
      try {
        // Optimistically update local state first for immediate UI response
        const orderedItems = orderedIds
          .map((id, index) => {
            const item = items.find((c) => c.id === id);
            return item ? { ...item, position: index * 1000 } : null;
          })
          .filter(Boolean) as Character[];
        setItems(orderedItems);

        // Skip API call if there are temp IDs (items not yet persisted)
        if (orderedIds.some((id) => id.startsWith("temp-"))) {
          return;
        }

        // Update positions via API in background (parallel for better performance)
        const promises = orderedIds.map((id, i) => {
          const position = i * 1000;
          return jsonFetch(`/api/books/${bookId}/characters`, {
            method: "PUT",
            body: JSON.stringify({ id, position }),
          });
        });
        await Promise.all(promises);
      } catch (e: any) {
        setError(e.message);
        // Revert optimistic update on error
        refresh();
      }
    },
    [bookId, enable, items, refresh],
  );

  return {
    items,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    reorder,
    lastRemoved,
    undoRemove,
  };
}

export function useNormalizedChapters(
  bookId: string,
  enable: boolean,
): BaseResult<Chapter> {
  const [items, setItems] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncesRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const refresh = useCallback(async () => {
    if (!enable) return;
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetch<{ chapters: any }>(
        `/api/books/${bookId}/chapters`,
      );
      setItems(data.chapters);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [bookId, enable]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const create = useCallback(
    async (input: Partial<Chapter> & { title?: string }) => {
      if (!enable) return null;
      const tempId = `temp-${crypto.randomUUID()}`;
      const payload = {
        title: input.title || input.name || "Untitled",
        position: input.position,
        content: input.notes || "",
        summary: (input as any).summary,
        analysis: (input as any).analysis,
        tags: input.tags || [],
      };

      // Optimistic update: add to state immediately with temp ID
      const optimisticChapter: Chapter = {
        id: tempId,
        name: payload.title,
        title: payload.title,
        notes: payload.content,
        summary: payload.summary,
        analysis: payload.analysis,
        tags: payload.tags,
        position: payload.position ?? items.length * 1000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setItems((prev) => [...prev, optimisticChapter]);

      try {
        const data = await jsonFetch<{ chapter: any }>(
          `/api/books/${bookId}/chapters`,
          { method: "POST", body: JSON.stringify(payload) },
        );
        // Replace temp ID with real ID, preserving the optimistic position
        setItems((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? { ...data.chapter, position: optimisticChapter.position }
              : c,
          ),
        );
        return data.chapter;
      } catch (e: any) {
        // Remove optimistic update on error
        setItems((prev) => prev.filter((c) => c.id !== tempId));
        setError(e.message);
        throw e;
      }
    },
    [bookId, enable, items.length],
  );
  const update = useCallback(
    async (id: string, patch: Partial<Chapter>) => {
      if (!enable) return null;
      const existing = items.find((c) => c.id === id);
      if (!existing) return null;

      // Optimistic update: update local state immediately
      const optimisticUpdate = { ...existing, ...patch };
      setItems((prev) => prev.map((c) => (c.id === id ? optimisticUpdate : c)));

      // Clear existing debounce
      const existingTimeout = debouncesRef.current.get(id);
      if (existingTimeout) clearTimeout(existingTimeout);

      // Debounce the API call
      const timeout = setTimeout(async () => {
        debouncesRef.current.delete(id);
        try {
          const payload = {
            id,
            title: patch.title || existing.title || existing.name,
            position: patch.position ?? existing.position,
            content: patch.notes ?? existing.notes,
            summary: patch.summary ?? existing.summary,
            analysis: patch.analysis ?? existing.analysis,
            tags: patch.tags || existing.tags,
          };
          const data = await jsonFetch<{ chapter: any }>(
            `/api/books/${bookId}/chapters`,
            { method: "PUT", body: JSON.stringify(payload) },
          );
          // Update with server response
          setItems((prev) => prev.map((c) => (c.id === id ? data.chapter : c)));
          return data.chapter;
        } catch (e: any) {
          // Revert optimistic update on error
          setItems((prev) => prev.map((c) => (c.id === id ? existing : c)));
          setError(e.message);
          throw e;
        }
      }, 500);

      debouncesRef.current.set(id, timeout);
      return optimisticUpdate;
    },
    [bookId, enable, items],
  );
  const [lastRemoved, setLastRemoved] = useState<{
    id: string;
    entity: Chapter;
  } | null>(null);
  const remove = useCallback(
    async (id: string) => {
      if (!enable) return false;
      const existing = items.find((c) => c.id === id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      try {
        await jsonFetch(`/api/books/${bookId}/chapters?id=${id}`, {
          method: "DELETE",
        });
        if (existing) setLastRemoved({ id, entity: existing });
        return true;
      } catch (e: any) {
        setError(e.message);
        if (existing) setItems((prev) => [...prev, existing]);
        return false;
      }
    },
    [bookId, enable, items],
  );
  const undoRemove = useCallback(async () => {
    if (!enable || !lastRemoved) return false;
    try {
      await jsonFetch(
        `/api/books/${bookId}/chapters?restore=${lastRemoved.id}`,
        { method: "PATCH" },
      );
      setItems((prev) => [...prev, lastRemoved.entity]);
      trackEntityRestored("chapter");
      setLastRemoved(null);
      return true;
    } catch {
      return false;
    }
  }, [bookId, enable, lastRemoved]);
  const reorder = useCallback(
    async (orderedIds: string[]) => {
      if (!enable) return;
      try {
        const orderedItems = orderedIds
          .map((id, index) => {
            const item = items.find((c) => c.id === id);
            return item ? { ...item, position: index * 1000 } : null;
          })
          .filter(Boolean) as Chapter[];
        setItems(orderedItems);

        // Skip API call if there are temp IDs (items not yet persisted)
        if (orderedIds.some((id) => id.startsWith("temp-"))) {
          return;
        }

        const promises = orderedIds.map((id, i) => {
          const position = i * 1000;
          return jsonFetch(`/api/books/${bookId}/chapters`, {
            method: "PUT",
            body: JSON.stringify({ id, position }),
          });
        });
        await Promise.all(promises);
      } catch (e: any) {
        setError(e.message);
        refresh();
      }
    },
    [bookId, enable, items, refresh],
  );
  return {
    items,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    reorder,
    lastRemoved,
    undoRemove,
  };
}

export function useNormalizedLocations(
  bookId: string,
  enable: boolean,
): BaseResult<Location> {
  const [items, setItems] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncesRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const refresh = useCallback(async () => {
    if (!enable) return;
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetch<{ locations: any }>(
        `/api/books/${bookId}/locations`,
      );
      setItems(data.locations);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [bookId, enable]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const create = useCallback(
    async (input: Partial<Location> & { name?: string }) => {
      if (!enable) return null;
      const tempId = `temp-${crypto.randomUUID()}`;
      const payload = {
        name: input.name || "Unnamed",
        notes: input.notes || "",
        parentId: input.parentId || null,
        position: input.position,
        tags: input.tags || [],
      };

      // Optimistic update: add to state immediately with temp ID
      const optimisticLocation: Location = {
        id: tempId,
        name: payload.name,
        notes: payload.notes,
        parentId: payload.parentId,
        tags: payload.tags,
        position: payload.position ?? items.length * 1000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setItems((prev) => [...prev, optimisticLocation]);

      try {
        const data = await jsonFetch<{ location: any }>(
          `/api/books/${bookId}/locations`,
          { method: "POST", body: JSON.stringify(payload) },
        );
        // Replace temp ID with real ID, preserving the optimistic position
        setItems((prev) =>
          prev.map((l) =>
            l.id === tempId
              ? { ...data.location, position: optimisticLocation.position }
              : l,
          ),
        );
        return data.location;
      } catch (e: any) {
        // Remove optimistic update on error
        setItems((prev) => prev.filter((l) => l.id !== tempId));
        setError(e.message);
        throw e;
      }
    },
    [bookId, enable, items.length],
  );
  const update = useCallback(
    async (id: string, patch: Partial<Location>) => {
      if (!enable) return null;
      const existing = items.find((l) => l.id === id);
      if (!existing) return null;

      // Optimistic update: update local state immediately
      const optimisticUpdate = { ...existing, ...patch };
      setItems((prev) => prev.map((l) => (l.id === id ? optimisticUpdate : l)));

      // Clear existing debounce
      const existingTimeout = debouncesRef.current.get(id);
      if (existingTimeout) clearTimeout(existingTimeout);

      // Debounce the API call
      const timeout = setTimeout(async () => {
        debouncesRef.current.delete(id);
        try {
          const payload = {
            id,
            name: patch.name || existing.name,
            notes: patch.notes ?? existing.notes,
            parentId: patch.parentId ?? existing.parentId ?? null,
            position: patch.position ?? existing.position,
            tags: patch.tags || existing.tags,
          };
          const data = await jsonFetch<{ location: any }>(
            `/api/books/${bookId}/locations`,
            { method: "PUT", body: JSON.stringify(payload) },
          );
          // Update with server response
          setItems((prev) =>
            prev.map((l) => (l.id === id ? data.location : l)),
          );
          return data.location;
        } catch (e: any) {
          // Revert optimistic update on error
          setItems((prev) => prev.map((l) => (l.id === id ? existing : l)));
          setError(e.message);
          throw e;
        }
      }, 500);

      debouncesRef.current.set(id, timeout);
      return optimisticUpdate;
    },
    [bookId, enable, items],
  );
  const [lastRemoved, setLastRemoved] = useState<{
    id: string;
    entity: Location;
  } | null>(null);
  const remove = useCallback(
    async (id: string) => {
      if (!enable) return false;
      const existing = items.find((l) => l.id === id);
      setItems((prev) => prev.filter((l) => l.id !== id));
      try {
        await jsonFetch(`/api/books/${bookId}/locations?id=${id}`, {
          method: "DELETE",
        });
        if (existing) setLastRemoved({ id, entity: existing });
        return true;
      } catch (e: any) {
        setError(e.message);
        if (existing) setItems((prev) => [...prev, existing]);
        return false;
      }
    },
    [bookId, enable, items],
  );
  const undoRemove = useCallback(async () => {
    if (!enable || !lastRemoved) return false;
    try {
      await jsonFetch(
        `/api/books/${bookId}/locations?restore=${lastRemoved.id}`,
        { method: "PATCH" },
      );
      setItems((prev) => [...prev, lastRemoved.entity]);
      trackEntityRestored("location");
      setLastRemoved(null);
      return true;
    } catch {
      return false;
    }
  }, [bookId, enable, lastRemoved]);
  const reorder = useCallback(
    async (orderedIds: string[]) => {
      if (!enable) return;
      try {
        const orderedItems = orderedIds
          .map((id, index) => {
            const item = items.find((l) => l.id === id);
            return item ? { ...item, position: index * 1000 } : null;
          })
          .filter(Boolean) as Location[];
        setItems(orderedItems);

        // Skip API call if there are temp IDs (items not yet persisted)
        if (orderedIds.some((id) => id.startsWith("temp-"))) {
          return;
        }

        const promises = orderedIds.map((id, i) => {
          const position = i * 1000;
          return jsonFetch(`/api/books/${bookId}/locations`, {
            method: "PUT",
            body: JSON.stringify({ id, position }),
          });
        });
        await Promise.all(promises);
      } catch (e: any) {
        setError(e.message);
        refresh();
      }
    },
    [bookId, enable, items, refresh],
  );
  return {
    items,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    reorder,
    lastRemoved,
    undoRemove,
  };
}

// Normalized Notes (BookNote) - immediate persistence like other entities
export function useNormalizedNotes(bookId: string, enable: boolean = true) {
  const [items, setItems] = useState<BookNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncesRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const refresh = useCallback(async () => {
    if (!enable) return;
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetch<{ notes: BookNote[] }>(
        `/api/books/${bookId}/notes`,
      );
      setItems(data.notes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [bookId, enable]);

  useEffect(() => {
    if (enable) refresh();
  }, [refresh, enable]);

  const create = useCallback(
    async (input: Partial<BookNote> & { title?: string; body?: string }) => {
      if (!enable) return null;
      const tempId = `temp-${crypto.randomUUID()}`;
      const payload = {
        title: input.title || `Note ${items.length + 1}`,
        body: input.body || "",
        tags: input.tags || [],
        position: input.position ?? items.length * 1000,
        spoilerProtected: input.spoilerProtected || false,
        minVisiblePage: input.minVisiblePage,
        groupId: input.groupId || null,
      };

      // Optimistic update: add to state immediately with temp ID
      const optimisticNote: BookNote = {
        id: tempId,
        title: payload.title,
        body: payload.body,
        tags: payload.tags,
        position: payload.position,
        spoilerProtected: payload.spoilerProtected,
        minVisiblePage: payload.minVisiblePage,
        groupId: payload.groupId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bookId: bookId,
      };
      setItems((prev) => [...prev, optimisticNote]);

      try {
        const data = await jsonFetch<{ note: BookNote }>(
          `/api/books/${bookId}/notes`,
          { method: "POST", body: JSON.stringify(payload) },
        );
        // Replace temp ID with real ID, preserving the optimistic position
        setItems((prev) =>
          prev.map((n) =>
            n.id === tempId
              ? { ...data.note, position: optimisticNote.position }
              : n,
          ),
        );
        return data.note;
      } catch (e: any) {
        // Remove optimistic update on error
        setItems((prev) => prev.filter((n) => n.id !== tempId));
        setError(e.message);
        throw e;
      }
    },
    [bookId, enable, items.length],
  );

  const update = useCallback(
    async (id: string, patch: Partial<BookNote>) => {
      if (!enable) return null;
      const existing = items.find((n) => n.id === id);
      if (!existing) return null;

      // Optimistic update
      const updated = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      setItems((prev) => prev.map((n) => (n.id === id ? updated : n)));

      // Clear existing debounce
      const existingTimeout = debouncesRef.current.get(id);
      if (existingTimeout) clearTimeout(existingTimeout);

      // Debounce the API call
      const timeout = setTimeout(async () => {
        debouncesRef.current.delete(id);
        try {
          const payload = {
            id,
            title: patch.title ?? existing.title,
            body: patch.body ?? existing.body,
            tags: patch.tags !== undefined ? patch.tags : undefined,
            position: patch.position ?? existing.position,
            spoilerProtected:
              patch.spoilerProtected ?? existing.spoilerProtected,
            minVisiblePage: patch.minVisiblePage ?? existing.minVisiblePage,
            groupId: patch.groupId ?? existing.groupId,
          };
          const data = await jsonFetch<{ note: BookNote }>(
            `/api/books/${bookId}/notes`,
            { method: "PUT", body: JSON.stringify(payload) },
          );
          setItems((prev) => prev.map((n) => (n.id === id ? data.note : n)));
          return data.note;
        } catch (e: any) {
          setError(e.message);
          // Revert optimistic update
          setItems((prev) => prev.map((n) => (n.id === id ? existing : n)));
          throw e;
        }
      }, 500);

      debouncesRef.current.set(id, timeout);
      return updated;
    },
    [bookId, enable, items],
  );

  const [lastRemoved, setLastRemoved] = useState<{
    id: string;
    entity: BookNote;
  } | null>(null);
  const remove = useCallback(
    async (id: string) => {
      if (!enable) return false;
      const existing = items.find((n) => n.id === id);
      setItems((prev) => prev.filter((n) => n.id !== id));
      try {
        await jsonFetch(`/api/books/${bookId}/notes?id=${id}`, {
          method: "DELETE",
        });
        if (existing) setLastRemoved({ id, entity: existing });
        return true;
      } catch (e: any) {
        setError(e.message);
        if (existing)
          setItems((prev) =>
            [...prev, existing].sort(
              (a, b) => (a.position || 0) - (b.position || 0),
            ),
          );
        return false;
      }
    },
    [bookId, enable, items],
  );
  const undoRemove = useCallback(async () => {
    if (!enable || !lastRemoved) return false;
    try {
      await jsonFetch(`/api/books/${bookId}/notes?restore=${lastRemoved.id}`, {
        method: "PATCH",
      });
      setItems((prev) => [...prev, lastRemoved.entity]);
      trackEntityRestored("note");
      setLastRemoved(null);
      return true;
    } catch {
      return false;
    }
  }, [bookId, enable, lastRemoved]);

  const reorder = useCallback(
    async (orderedIds: string[]) => {
      if (!enable) return;
      try {
        // Optimistic update
        const orderedItems = orderedIds
          .map((id, index) => {
            const item = items.find((n) => n.id === id);
            return item ? { ...item, position: index * 1000 } : null;
          })
          .filter(Boolean) as BookNote[];
        setItems(orderedItems);

        // Skip API call if there are temp IDs (items not yet persisted)
        if (orderedIds.some((id) => id.startsWith("temp-"))) {
          return;
        }

        // Update positions via API in background (parallel for better performance)
        const promises = orderedIds.map((id, i) => {
          const position = i * 1000;
          return jsonFetch(`/api/books/${bookId}/notes`, {
            method: "PUT",
            body: JSON.stringify({ id, position }),
          });
        });
        await Promise.all(promises);
      } catch (e: any) {
        setError(e.message);
        refresh(); // Revert on error
      }
    },
    [bookId, enable, items, refresh],
  );

  return {
    items,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    reorder,
    lastRemoved,
    undoRemove,
  };
}
