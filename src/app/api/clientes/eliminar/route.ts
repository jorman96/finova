import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { managers } from "@/lib/permissions";
import { ApiError, apiError, assertTenant, requireActor } from "@/lib/server-auth";

const schema = z.object({ clienteId: z.string().min(1).max(200).regex(/^[^/]+$/) });

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, managers);
    const { clienteId } = schema.parse(await request.json());
    await adminDb.runTransaction(async tx => {
      const ref = adminDb.collection("clientes").doc(clienteId);
      const client = await tx.get(ref);
      if (!client.exists) throw new ApiError(404, "El cliente ya no existe. Actualiza la lista.");
      assertTenant(actor, client.data()!.empresaId);
      // Keep every financial relationship, including settled and cancelled loans.
      for (const name of ["prestamos", "pagos", "cuotas"]) {
        const history = await tx.get(adminDb.collection(name).where("clienteId", "==", clienteId).limit(1));
        if (!history.empty) throw new ApiError(409, "No se puede eliminar un cliente con historial financiero. Se conservan también los créditos pagados o cancelados.");
      }
      tx.delete(ref);
      tx.create(adminDb.collection("auditoria").doc(), {
        empresaId: actor.empresaId, usuarioId: actor.uid, usuarioNombre: actor.nombre,
        accion: "eliminar_cliente", registroId: clienteId, fecha: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
