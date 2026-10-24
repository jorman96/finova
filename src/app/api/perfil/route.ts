import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireActor } from '@/lib/server-auth';
const schema = z.object({ nombres: z.string().trim().min(1).max(100), apellidos: z.string().trim().min(1).max(100), telefono: z.string().trim().max(30) }).strict();
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const input = schema.parse(await request.json());
    await adminDb.runTransaction(async tx => {
      const ref = adminDb.doc('usuarios/' + actor.uid);
      const current = await tx.get(ref);
      if (current.data()?.empresaId !== actor.empresaId || current.data()?.rol !== actor.rol) throw new Error('El perfil cambió. Vuelve a iniciar sesión.');
      tx.update(ref, { ...input, nombre: `${input.nombres} ${input.apellidos}` });
      tx.create(adminDb.collection('auditoria').doc(), { empresaId: actor.empresaId, usuarioId: actor.uid, accion: 'actualizar_perfil_propio', fecha: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
