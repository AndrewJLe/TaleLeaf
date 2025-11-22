import { useCallback, useState } from "react";

export interface UseUnsavedChangesResult {
  hasUnsavedChanges: boolean;
  registerUnsavedCheck: (key: string, isDirty: boolean) => void;
  unregisterUnsavedCheck: (key: string) => void;
  clearAll: () => void;
}

// Global hook for tracking unsaved changes across multiple components
export function useUnsavedChanges(): UseUnsavedChangesResult {
  const [dirtyStates, setDirtyStates] = useState<Record<string, boolean>>({});

  const registerUnsavedCheck = useCallback((key: string, isDirty: boolean) => {
    setDirtyStates((prev) => ({ ...prev, [key]: isDirty }));
  }, []);

  const unregisterUnsavedCheck = useCallback((key: string) => {
    setDirtyStates((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setDirtyStates({});
  }, []);

  const hasUnsavedChanges = Object.values(dirtyStates).some(Boolean);

  return {
    hasUnsavedChanges,
    registerUnsavedCheck,
    unregisterUnsavedCheck,
    clearAll,
  };
}
