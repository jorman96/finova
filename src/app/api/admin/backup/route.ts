import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { apiError,requireActor } from "@/lib/server-auth";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["superadmin", "dueño"]);
    await rateLimit("backup:" + actor.uid, 2, 3600_000);
    const result: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString(), empresaId: actor.empresaId };
    result.empresa = (await adminDb.collection("empresas").doc(actor.empresaId).get()).data();
    for (const collection of ["clientes", "prestamos", "cuotas", "pagos", "inversionistas", "inversion_contratos", "cuotas_inversionistas", "pagos_inversionistas", "movimientos_caja", "auditoria"]) {
      const list = [];
      for await (const item of adminDb.collection(collection).where("empresaId", "==", actor.empresaId).stream()) { const doc = item as unknown as QueryDocumentSnapshot; list.push({ id: doc.id, ...doc.data() }); }
      result[collection] = list;
    }
    await adminDb.collection("auditoria").add({ empresaId: actor.empresaId, accion: "exportar_respaldo", usuarioId: actor.uid, fecha: new Date() });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
