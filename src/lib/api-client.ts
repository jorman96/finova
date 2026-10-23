import { auth } from "./firebase";
export async function apiPost<T = { success: boolean }>(url: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para continuar.");
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se completó la operación.");
  return data as T;
}
