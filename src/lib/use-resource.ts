"use client";
import { useMemo,useSyncExternalStore } from "react";
interface Snapshot<T> { data: T | null; error: string; loading: boolean }
/** A request owns its state; changing the key creates a fresh, cancellable subscription. */
function createResource<T>(loader: () => Promise<T>) {
    let snapshot: Snapshot<T> = { data: null, error: "", loading: true };
    const initial = snapshot;
    const listeners = new Set<() => void>();
    let started = false;
    const emit = () => { for (const fn of listeners) fn(); };
    return {
      getSnapshot: () => snapshot,
      getServerSnapshot: () => initial,
      subscribe: (fn: () => void) => {
        listeners.add(fn);
        if (!started) {
          started = true;
          loader().then(data => { snapshot = { data, error: "", loading: false }; emit(); }, error => { snapshot = { data: null, error: error instanceof Error ? error.message : "No se pudo cargar la información.", loading: false }; emit(); });
        }
        return () => { listeners.delete(fn); };
      },
    };
}
export function useResource<T>(key: string, loader: () => Promise<T>) {
  // The key is the serialized identity of the request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const store = useMemo(() => createResource(loader), [key]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
