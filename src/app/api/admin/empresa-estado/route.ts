import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { ApiError, apiError, requireActor } from '@/lib/server-auth';
const schema = z.object({ empresaId: z.string().min(1).max(200).regex(/^[^/]+$/), estado: z.enum(['activa', 'suspendida']), expectedEstado: z.enum(['activa', 'suspendida']), motivo: z.string().trim().min(10).max(500) }).strict();
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ['superadmin']);
    const input = schema.parse(await request.json());
    await adminDb.runTransaction(async tx => {
      const ref = adminDb.doc('empresas/' + input.empresaId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiError(404, 'La financiera ya no está disponible.');
      if (snap.data()!.estado !== input.expectedEstado) throw new ApiError(409, 'El estado cambió. Actualiza la lista antes de continuar.');
      tx.update(ref, { estado: input.estado });
      tx.create(adminDb.collection('auditoria').doc(), { empresaId: input.empresaId, usuarioId: actor.uid, usuarioNombre: actor.nombre, accion: 'cambiar_estado_financiera', anterior: input.expectedEstado, actual: input.estado, motivo: input.motivo, fecha: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
