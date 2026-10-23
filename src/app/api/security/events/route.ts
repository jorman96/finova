import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { apiError, requireActor } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";
const schema = z.object({ reference: z.uuid(), event: z.literal("application_error"), section: z.enum(["dashboard", "clientes", "prestamos", "pagos", "mora", "inversionistas", "reportes", "configuracion", "seguridad", "master", "other"]) });
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const data = schema.parse(await request.json());
    await rateLimit("events:" + actor.uid, 20, 60_000);
    await adminDb.collection("security_events").doc(actor.uid + "_" + data.reference).set({ ...data, empresaId: actor.empresaId, usuarioId: actor.uid, fecha: new Date(), source: "client_report" });
    console.error(JSON.stringify({ level: "error", event: "client_report", reference: data.reference, section: data.section }));
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
