import { apiPost } from '../api-client';
/** Persist only a random retry reference, never a password, amount or banking data. */
export async function capitalPost<T = { id: string; verified?: boolean }>(empresaId: string, context: string, command: Record<string, unknown>): Promise<T> {
  const storageKey = `finova-capital-v1:${empresaId}:${context}`;
  let key = sessionStorage.getItem(storageKey);
  if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); }
  const result = await apiPost<T>('/api/capital/commands', { ...command, key });
  sessionStorage.removeItem(storageKey);
  return result;
}
