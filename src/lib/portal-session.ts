import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { adminDb } from "./firebase-admin";
export const PORTAL_COOKIE = "finova_portal";
export const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export async function hasPortalSession(empresaId: string, clienteId: string) {
  const token = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (!token) return false;
  const snap = await adminDb.collection("portal_sessions").doc(hashToken(token)).get();
  const s = snap.data();
  return !!s && s.empresaId === empresaId && s.clienteId === clienteId && s.expiresAt.toMillis() > Date.now();
}
