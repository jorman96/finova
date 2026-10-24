import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { managers } from '@/lib/permissions';
import { ApiError, apiError, assertTenant, requireActor } from '@/lib/server-auth';
const schema = z.object({ clienteId: z.string().min(1).max(200).regex(/^[^/]+$/), score: z.number().int().min(0).max(100), motivo: z.string().trim().min(10).max(500) }).strict();
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, managers);
    const input = schema.parse(await request.json());
    await adminDb.runTransaction(async tx => {
      const ref = adminDb.doc('clientes/' + input.clienteId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiError(404, 'El cliente ya no está disponible.');
      assertTenant(actor, snap.data()!.empresaId);
      const revision = { anterior: snap.data()!.score ?? null, actual: input.score, motivo: input.motivo, usuarioNombre: actor.nombre, fecha: new Date().toISOString() };
      tx.update(ref, { score: input.score, scoreRevision: revision });
      tx.create(adminDb.collection('auditoria').doc(), { empresaId: actor.empresaId, usuarioId: actor.uid, accion: 'ajustar_indicador_cliente', registroId: input.clienteId, ...revision, createdAt: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
