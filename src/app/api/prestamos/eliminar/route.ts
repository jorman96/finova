import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { managers } from '@/lib/permissions';
import { ApiError, apiError, assertTenant, requireActor } from '@/lib/server-auth';

const schema = z.object({ prestamoId: z.string().regex(/^[\w-]{1,128}$/), motivo: z.string().trim().min(5).max(500), confirmado: z.literal(true) }).strict();

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, managers);
    const input = schema.parse(await request.json());
    await adminDb.runTransaction(async tx => {
      const loanRef = adminDb.doc('prestamos/' + input.prestamoId);
      const [loan, profile, company] = await Promise.all([tx.get(loanRef), tx.get(adminDb.doc('usuarios/' + actor.uid)), tx.get(adminDb.doc('empresas/' + actor.empresaId))]);
      const data = loan.data();
      if (!data) throw new ApiError(404, 'El crédito ya no existe.');
      assertTenant(actor, data.empresaId);
      const operator = profile.data();
      if (operator?.rol !== actor.rol || operator.empresaId !== actor.empresaId || (operator.activo !== undefined && operator.activo !== true) || company.data()?.estado !== 'activa') throw new ApiError(403, 'La financiera o el operador no están habilitados.');
      if (!['activo', 'moroso'].includes(data.estado) || data.prestamoOrigenId || data.nuevoPrestamoId || data.saldoRestante !== data.totalPagar) throw new ApiError(409, 'Este crédito tiene historial o vínculos financieros. No se puede eliminar.');
      const [payments, installments, movements, linked, accounting, lots] = await Promise.all([
        tx.get(adminDb.collection('pagos').where('prestamoId', '==', loan.id).limit(1)),
        tx.get(adminDb.collection('cuotas').where('prestamoId', '==', loan.id).limit(201)),
        tx.get(adminDb.collection('movimientos_caja').where('origenId', '==', loan.id).limit(1)),
        tx.get(adminDb.collection('prestamos').where('prestamoOrigenId', '==', loan.id).limit(1)),
        tx.get(adminDb.doc('accounting/' + actor.empresaId)),
        tx.get(adminDb.doc('capital_control/' + actor.empresaId).collection('lots').where('loanId', '==', loan.id).limit(1)),
      ]);
      if (!payments.empty || !movements.empty || !linked.empty || accounting.exists || !lots.empty || installments.size > 200 || installments.docs.some(row => {
        const q = row.data();
        return q.empresaId !== actor.empresaId || q.clienteId !== data.clienteId || q.montoPagado !== 0 || !['pendiente','vencida'].includes(q.estado) || q.capitalCobradoCentavos || q.interesCobradoCentavos;
      })) throw new ApiError(409, 'Hay cobros, movimientos o vínculos que requieren conciliación. No se borró nada.');
      const clientRef = adminDb.doc('clientes/' + data.clienteId);
      const [client, remaining] = await Promise.all([
        tx.get(clientRef),
        tx.get(adminDb.collection('prestamos').where('empresaId', '==', actor.empresaId).where('clienteId', '==', clientRef.id).limit(2)),
      ]);
      if (client.data()?.empresaId !== actor.empresaId) throw new ApiError(409, 'El cliente asociado requiere revisión.');
      for (const row of installments.docs) tx.delete(row.ref);
      tx.delete(loanRef);
      if (client.data()?.estado === 'activo' && remaining.docs.every(row => row.id === loan.id)) tx.update(clientRef, { estado: 'nuevo' });
      tx.create(adminDb.collection('auditoria').doc(), { empresaId: actor.empresaId, usuarioId: actor.uid, accion: 'eliminar_credito_erroneo', registroId: loan.id, monto: data.monto, motivo: input.motivo, cuotasEliminadas: installments.size, fecha: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
