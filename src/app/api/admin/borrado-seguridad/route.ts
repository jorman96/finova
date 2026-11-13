import { createHash } from 'node:crypto';
import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { ApiError, apiError, requireActor } from '@/lib/server-auth';
import { rateLimit } from '@/lib/rate-limit';
import { resetCategories, type ResetCategory } from '@/lib/reset-categories';

const id = z.string().regex(/^[\w-]{1,128}$/);
const selection = z.array(z.enum(Object.keys(resetCategories) as [ResetCategory, ...ResetCategory[]])).min(1).max(5).refine(v => new Set(v).size === v.length);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('request'), empresaId: id, categories: selection, reason: z.string().trim().min(12).max(500), confirmed: z.literal(true) }).strict(),
  z.object({ action: z.enum(['status', 'cancel', 'preview']), empresaId: id }).strict(),
  z.object({ action: z.literal('execute'), empresaId: id, preview: z.string().regex(/^[a-f0-9]{64}$/), confirmation: z.string().max(150) }).strict(),
]);
const maxRecords = 400;
const groups = {
  loans: ['prestamos', 'cuotas', 'pagos'],
  clients: ['clientes', 'portal_sessions', 'portal_challenges'],
  investors: ['inversionistas', 'inversion_contratos', 'cuotas_inversionistas', 'pagos_inversionistas'],
  balances: ['movimientos_caja'],
  agenda: [],
} as const;
const capitalCollections = ['agreements','installments','lots','claims','reserves','payouts','restrictions','reversals','contributions','contribution_returns','operations','injection_links'];
const accountingCollections = ['settings','operations','balances','savings','entries','holds','closes','reversals'];

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ['superadmin', 'dueño'], { allowSuspended: true });
    await rateLimit('security-reset:' + actor.uid, 45, 60000);
    const raw = await request.text();
    if (raw.length > 4000) throw new ApiError(413, 'Solicitud demasiado extensa.');
    const input = schema.parse(JSON.parse(raw));
    const { empresaId, action } = input;
    const ownerAction = action === 'request' || action === 'cancel';
    if ((actor.rol === 'dueño' && (actor.empresaId !== empresaId || action === 'preview' || action === 'execute')) || (actor.rol !== 'dueño' && ownerAction)) throw new ApiError(403, 'Esta acción requiere la cuenta correspondiente.');
    const result = await adminDb.runTransaction(async tx => {
      const companyRef = adminDb.doc('empresas/' + empresaId);
      const stateRef = adminDb.doc('security_resets/' + empresaId);
      const [company, state, operator] = await Promise.all([tx.get(companyRef), tx.get(stateRef), tx.get(adminDb.doc('usuarios/' + actor.uid))]);
      const profile = operator.data();
      if (!company.exists) throw new ApiError(404, 'La financiera no existe.');
      if (profile?.rol !== actor.rol || (profile?.activo !== undefined && profile.activo !== true) || (actor.rol === 'dueño' && profile?.empresaId !== empresaId)) throw new ApiError(403, 'El permiso ya no está vigente.');
      const saved = state.data();
      const pending = saved?.status === 'pending' && saved.expiresAt > Date.now();
      const status = saved?.status === 'completed' ? 'completed' : pending ? 'pending' : 'available';
      if (action === 'status') return { status, ...(pending ? { categories: saved!.categories, reason: saved!.reason, expiresAt: saved!.expiresAt } : {}) };
      if (status === 'completed') throw new ApiError(409, 'Esta financiera ya utilizó su borrado único.');
      if (input.action === 'request') {
        if (company.data()?.estado !== 'activa' || pending) throw new ApiError(409, 'Debe estar activa y sin otra solicitud vigente.');
        tx.set(stateRef, { status: 'pending', requestId: crypto.randomUUID(), ownerUid: actor.uid, categories: [...input.categories].sort(), reason: input.reason, expiresAt: Date.now() + 7 * 86400000, requestedAt: FieldValue.serverTimestamp() });
        return { status: 'pending' };
      }
      if (!pending) throw new ApiError(409, 'No hay una solicitud vigente del dueño.');
      if (action === 'cancel') {
        tx.update(stateRef, { status: 'cancelled', cancelledAt: FieldValue.serverTimestamp(), cancelledBy: actor.uid });
        return { status: 'available' };
      }
      if (company.data()?.estado !== 'suspendida') throw new ApiError(409, 'Suspende la financiera antes de revisar o ejecutar el borrado.');
      const requester = (await tx.get(adminDb.doc('usuarios/' + saved!.ownerUid))).data();
      if (requester?.rol !== 'dueño' || requester.empresaId !== empresaId || (requester.activo !== undefined && requester.activo !== true)) throw new ApiError(409, 'La autorización del dueño ya no está vigente.');
      const categories = selection.parse(saved!.categories);
      const picked = new Set<ResetCategory>(categories);
      const capital = adminDb.doc('capital_control/' + empresaId);
      const operations = adminDb.doc('operational_workspaces/' + empresaId);
      const accounting = adminDb.doc('accounting/' + empresaId);
      const tenantRows = (name: string, limit = maxRecords + 1) => tx.get(adminDb.collection(name).where('empresaId', '==', empresaId).limit(limit));
      const [accountRoot, capitalRoot, ...checks] = await Promise.all([tx.get(accounting), tx.get(capital), ...accountingCollections.map(name => tx.get(accounting.collection(name).limit(1)))]);
      if (accountRoot.exists || checks.some(snapshot => !snapshot.empty)) throw new ApiError(409, 'Hay datos contables. El borrado automático no está disponible para esta financiera.');
      if (picked.has('clients') && !picked.has('loans') && (await Promise.all(groups.loans.map(name => tenantRows(name, 1)))).some(s => !s.empty)) throw new ApiError(409, 'Para borrar clientes con historial, el dueño debe autorizar también préstamos, cuotas y cobros.');
      if (picked.has('clients') && !picked.has('agenda') && !(await tx.get(operations.collection('tasks').limit(1))).empty) throw new ApiError(409, 'Hay gestiones que podrían referirse a clientes. El dueño debe autorizar también Gestiones y agenda.');
      if ((picked.has('loans') || picked.has('investors')) && !picked.has('balances') && (capitalRoot.exists || (await Promise.all(capitalCollections.map(name => tx.get(capital.collection(name).limit(1))))).some(s => !s.empty))) throw new ApiError(409, 'Hay movimientos registrados en el control de capital. El dueño debe autorizar también Capital, compromisos y movimientos de caja.');
      if (picked.has('balances') && ((!picked.has('loans') && (await Promise.all(groups.loans.map(name => tenantRows(name, 1)))).some(s => !s.empty)) || (!picked.has('investors') && (await Promise.all(groups.investors.map(name => tenantRows(name, 1)))).some(s => !s.empty)))) throw new ApiError(409, 'No se pueden reiniciar los saldos conservando movimientos de créditos o inversiones. El dueño debe ampliar la autorización correspondiente.');
      const snapshots = await Promise.all(categories.map(async category => {
        const queries = groups[category].map(name => tenantRows(name));
        if (category === 'balances') queries.push(...capitalCollections.map(name => tx.get(capital.collection(name).limit(maxRecords + 1))));
        if (category === 'agenda') queries.push(...['tasks','operations'].map(name => tx.get(operations.collection(name).limit(maxRecords + 1))));
        const docs: DocumentSnapshot[] = (await Promise.all(queries)).flatMap(s => s.docs);
        if (category === 'balances' && capitalRoot.exists) docs.push(capitalRoot);
        return { category, docs };
      }));
      const records = snapshots.flatMap(group => group.docs);
      if (records.length > maxRecords) throw new ApiError(409, 'La selección supera 400 registros. Requiere una revisión asistida; no se borró nada.');
      if (records.some(row => row.data()?.empresaId !== undefined && row.data()?.empresaId !== empresaId)) throw new ApiError(409, 'Hay registros con pertenencia inconsistente. No se borró nada.');
      const resetsBalances = picked.has('balances') && Boolean(company.data()?.capitalInicial || company.data()?.inyeccionesCapital?.length);
      if (!records.length && !resetsBalances) throw new ApiError(409, 'No hay datos seleccionados que borrar.');
      const preview = createHash('sha256').update(JSON.stringify([saved!.requestId, [company.updateTime?.seconds, company.updateTime?.nanoseconds], records.map(row => [row.ref.path, row.updateTime?.seconds, row.updateTime?.nanoseconds]).sort()])).digest('hex');
      const counts = Object.fromEntries(snapshots.map(group => [group.category, group.docs.length]));
      if (input.action === 'execute') {
        if (input.preview !== preview || input.confirmation !== 'BORRAR ' + empresaId) throw new ApiError(409, 'Los datos cambiaron o la confirmación no coincide. Revisa la vista previa otra vez.');
        for (const row of records) tx.delete(row.ref);
        if (picked.has('balances')) tx.update(companyRef, { capitalInicial: 0, inyeccionesCapital: [] });
        tx.update(stateRef, { status: 'completed', completedAt: FieldValue.serverTimestamp(), executedBy: actor.uid, counts, resetsBalances });
        tx.create(adminDb.collection('auditoria').doc(), { empresaId, usuarioId: actor.uid, ownerUid: saved!.ownerUid, requestId: saved!.requestId, accion: 'borrado_seguridad_unico', categorias: categories, counts, resetsBalances, motivo: saved!.reason, fecha: FieldValue.serverTimestamp() });
        return { status: 'completed', counts };
      }
      return { status, preview, counts, resetsBalances, categories, reason: saved!.reason };
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
