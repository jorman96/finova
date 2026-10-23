import { createHash } from "node:crypto";
import { adminDb } from "./firebase-admin";
import { ApiError } from "./server-auth";
/** Shared across instances; expiresAt can be configured as a Firestore TTL field. */
export async function rateLimit(key: string, max: number, windowMs: number) {
  const ref = adminDb.collection("rate_limits").doc(createHash("sha256").update(key).digest("hex"));
  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref), now = Date.now(), data = snap.data();
    const current = data && data.until > now ? data.count : 0;
    if (current >= max) throw new ApiError(429, "Demasiados intentos. Espera unos minutos.");
    const until = data && data.until > now ? data.until : now + windowMs;
    tx.set(ref, { count: current + 1, until, expiresAt: new Date(until) });
  });
}
