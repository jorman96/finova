import { emailConfigured,sendEmail } from "@/lib/email";
import { adminDb } from "@/lib/firebase-admin";
import { hashToken,PORTAL_COOKIE } from "@/lib/portal-session";
import { rateLimit } from "@/lib/rate-limit";
import { ApiError,apiError } from "@/lib/server-auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes,randomInt,timingSafeEqual } from "node:crypto";
import { z } from "zod";
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), empresaId: z.string().min(1).max(120).regex(/^[\w-]+$/), cedula: z.string().trim().min(5).max(30) }),
  z.object({ action: z.literal("verify"), challenge: z.string().regex(/^[a-f0-9]{64}$/), code: z.string().regex(/^\d{6}$/) }),
]);
export async function POST(request: Request) {
  try {
    const data = input.parse(await request.json());
    if (data.action === "request") {
      if (!emailConfigured()) throw new ApiError(503, "El portal requiere configurar el servicio de correo.");
      await rateLimit("portal:identity:" + data.empresaId + ":" + data.cedula, 3, 15 * 60_000);
      await rateLimit("portal:empresa:" + data.empresaId, 100, 15 * 60_000);
      const empresa = await adminDb.collection("empresas").doc(data.empresaId).get();
      const challenge = randomBytes(32).toString("hex");
      if (empresa.data()?.estado === "activa") {
        const clientes = await adminDb.collection("clientes").where("empresaId", "==", data.empresaId).where("cedula", "==", data.cedula).limit(1).get();
        const client = clientes.docs[0];
        if (client?.data().correo) {
          const code = String(randomInt(100000, 1000000));
          await adminDb.collection("portal_challenges").doc(challenge).set({
            hash: hashToken(challenge + code), clienteId: client.id, empresaId: data.empresaId,
            attempts: 0, expiresAt: new Date(Date.now() + 10 * 60_000), used: false,
          });
          await sendEmail(client.data().correo, "Código de acceso a tu portal",
            '<p>Tu código de acceso es <strong>' + code + '</strong>.</p><p>Válido durante 10 minutos. No lo compartas.</p>', "portal-" + challenge);
        }
      }
      return NextResponse.json({ challenge, message: "Si tus datos están registrados, recibirás un código en tu correo." });
    }
    await rateLimit("portal:verify:" + data.challenge, 6, 15 * 60_000);
    const rawSession = randomBytes(32).toString("hex");
    const sessionRef = adminDb.collection("portal_sessions").doc(hashToken(rawSession));
    const result = await adminDb.runTransaction(async tx => {
      const ref = adminDb.collection("portal_challenges").doc(data.challenge);
      const snap = await tx.get(ref), c = snap.data();
      if (!c || c.used || c.expiresAt.toMillis() < Date.now() || c.attempts >= 5) return null;
      const candidate = hashToken(data.challenge + data.code);
      if (!timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(c.hash, "hex"))) {
        tx.update(ref, { attempts: c.attempts + 1 });
        return null;
      }
      const empresa = await tx.get(adminDb.collection("empresas").doc(c.empresaId));
      if (empresa.data()?.estado !== "activa") return null;
      tx.update(ref, { used: true });
      tx.set(sessionRef, { empresaId: c.empresaId, clienteId: c.clienteId, expiresAt: new Date(Date.now() + 60 * 60_000) });
      return { empresaId: c.empresaId, clienteId: c.clienteId };
    });
    if (!result) throw new ApiError(401, "Código inválido o vencido. Solicita uno nuevo.");
    (await cookies()).set(PORTAL_COOKIE, rawSession, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 3600 });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
