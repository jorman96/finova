'use client';
import { useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';
const event = 'finova-list-preferences';
const fallback = new Map<string, string>();
function subscribe(notify: () => void) {
  window.addEventListener(event, notify); window.addEventListener('storage', notify);
  return () => { window.removeEventListener(event, notify); window.removeEventListener('storage', notify); };
}
/** Tab-scoped filters are isolated by both user and company; no search terms go in URLs. */
export function useListFilter(name: string, initial = ''): [string, (value: string) => void] {
  const { userData } = useAuth();
  const key = `finova:list:${userData?.uid}:${userData?.empresaId}:${name}`;
  const value = useSyncExternalStore(subscribe, () => { if (fallback.has(key)) return fallback.get(key)!; try { return sessionStorage.getItem(key) ?? initial; } catch { return initial; } }, () => initial);
  return [value, next => { fallback.set(key, next.slice(0, 500)); try { sessionStorage.setItem(key, next.slice(0, 500)); } catch { /* The in-memory preference remains usable when storage is restricted. */ } window.dispatchEvent(new Event(event)); }];
}
