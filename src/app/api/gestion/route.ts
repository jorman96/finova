import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { FieldPath, FieldValue, type Query } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { managers } from '@/lib/permissions';
import { ApiError, apiError, requireActor } from '@/lib/server-auth';
import { validDate } from '@/lib/capital/core';
import { rateLimit } from '@/lib/rate-limit';
const id = z.string().min(1).max(128).regex(/^[^/]+$/);
const day = z.string().refine(validDate, 'Fecha inválida.');
const state = z.enum(['pendiente', 'en_curso', 'resuelta', 'cancelada']);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list'), scope: z.enum(['open','closed','all']).default('open'), cursor: z.object({ date: day, id }).optional() }).strict(),
  z.object({ action: z.literal('create'), key: z.uuid(), kind: z.enum(['solicitud','cobranza','seguimiento']), title: z.string().trim().min(4).max(120), clientId: id.optional(), assigneeUid: id.optional(), dueDate: day, note: z.string().trim().max(1000), promiseCents: z.number().int().positive().max(100000000000).optional() }).strict(),
  z.object({ action: z.literal('update'), key: z.uuid(), taskId: id, version: z.number().int().nonnegative(), state, assigneeUid: id.optional(), note: z.string().trim().min(4).max(1000) }).strict(),
]);
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const manager = managers.includes(actor.rol);
    const text = await request.text();
    if (text.length > 8000) throw new ApiError(413, 'La solicitud excede el tamaño permitido.');
    const input = schema.parse(JSON.parse(text));
    const base = adminDb.doc('operational_workspaces/' + actor.empresaId);
    if (input.action === 'list') {
      let query: Query = base.collection('tasks');
      if (!manager) query = query.where('assigneeUid', '==', actor.uid);
      if (input.scope !== 'all') query = query.where('state', 'in', input.scope === 'open' ? ['pendiente','en_curso'] : ['resuelta','cancelada']);
      query = query.orderBy('dueDate').orderBy(FieldPath.documentId());
      if (input.cursor) query = query.startAfter(input.cursor.date, input.cursor.id);
      const [tasks, clients, members] = await Promise.all([
        query.limit(21).get(),
        adminDb.collection('clientes').where('empresaId', '==', actor.empresaId).select('nombres','apellidos','cedula').get(),
        manager ? adminDb.collection('usuarios').where('empresaId', '==', actor.empresaId).select('nombre','activo','rol').get() : null,
      ]);
      const selected = tasks.docs.slice(0, 20);
      const last = selected.at(-1);
      return NextResponse.json({ empresaId: actor.empresaId, items: selected.map(d => ({ ...d.data(), id: d.id })), next: tasks.size > 20 && last ? { date: last.data().dueDate, id: last.id } : null, manager, clients: clients.docs.map(d => ({ id: d.id, ...d.data() })), members: members ? members.docs.filter(d => d.data().activo !== false && d.data().rol !== 'consulta').map(d => ({ id: d.id, nombre: d.data().nombre })) : [{ id: actor.uid, nombre: actor.nombre }] }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (!['superadmin','dueño','admin','gestor','cobrador','cajero'].includes(actor.rol)) throw new ApiError(403, 'Tu rol permite consultar, pero no cambiar gestiones.');
    await rateLimit('operations:' + actor.uid, 40, 60000);
    const opId = createHash('sha256').update(JSON.stringify([actor.empresaId, actor.uid, input.key])).digest('hex');
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const result = await adminDb.runTransaction(async tx => {
      const opRef = base.collection('operations').doc(opId);
      const taskRef = base.collection('tasks').doc(input.action === 'create' ? opId : input.taskId);
      const [company, profile, previous, task] = await Promise.all([tx.get(adminDb.doc('empresas/' + actor.empresaId)), tx.get(adminDb.doc('usuarios/' + actor.uid)), tx.get(opRef), tx.get(taskRef)]);
      if (company.data()?.estado !== 'activa' || profile.data()?.empresaId !== actor.empresaId || profile.data()?.rol !== actor.rol || profile.data()?.activo === false) throw new ApiError(403, 'El operador o la financiera ya no están habilitados.');
      if (previous.exists) { if (previous.data()!.fingerprint !== fingerprint) throw new ApiError(409, 'La referencia se usó con otros datos.'); return { id: previous.data()!.taskId, repeated: true }; }
      if (input.action === 'update' && (!task.exists || (!manager && task.data()!.assigneeUid !== actor.uid))) throw new ApiError(403, 'La gestión no está disponible para tu usuario.');
      if (input.action === 'update' && task.data()!.version !== input.version) throw new ApiError(409, 'La gestión cambió. Actualiza la lista antes de continuar.');
      const assigneeUid = input.assigneeUid || (input.action === 'update' ? task.data()!.assigneeUid : actor.uid);
      if (!manager && assigneeUid !== actor.uid) throw new ApiError(403, 'Solo puedes crear o actualizar gestiones asignadas a ti.');
      const assignee = await tx.get(adminDb.doc('usuarios/' + assigneeUid));
      if (assignee.data()?.empresaId !== actor.empresaId || assignee.data()?.activo === false || assignee.data()?.rol === 'consulta') throw new ApiError(400, 'Selecciona un integrante activo de la misma financiera.');
      let clientName = '';
      if (input.action === 'create') {
        if (input.kind === 'cobranza' && !input.clientId) throw new ApiError(400, 'Selecciona un cliente para la gestión de cobranza.');
        if (input.promiseCents && input.kind !== 'cobranza') throw new ApiError(400, 'Una promesa de pago corresponde a una gestión de cobranza.');
        if (input.clientId) {
          const client = await tx.get(adminDb.doc('clientes/' + input.clientId));
          if (client.data()?.empresaId !== actor.empresaId) throw new ApiError(403, 'El cliente no pertenece a tu financiera.');
          clientName = `${client.data()!.nombres || ''} ${client.data()!.apellidos || ''}`.trim();
        }
      }
      const history = { reference: opId, date: new Date().toISOString(), actor: actor.nombre, state: input.action === 'create' ? 'pendiente' : input.state, note: input.note };
      if (input.action === 'create') tx.create(taskRef, { empresaId: actor.empresaId, kind: input.kind, title: input.title, clientId: input.clientId || null, clientName, assigneeUid, assigneeName: assignee.data()!.nombre || assigneeUid, dueDate: input.dueDate, note: input.note, promiseCents: input.promiseCents || null, state: 'pendiente', version: 0, history: [history], createdAt: FieldValue.serverTimestamp() });
      else tx.update(taskRef, { state: input.state, assigneeUid, assigneeName: assignee.data()!.nombre || assigneeUid, version: input.version + 1, history: [...(task.data()!.history || []).slice(-19), history], updatedAt: FieldValue.serverTimestamp() });
      tx.create(opRef, { fingerprint, taskId: taskRef.id, actor: actor.uid, createdAt: FieldValue.serverTimestamp() });
      tx.create(adminDb.collection('auditoria').doc(), { empresaId: actor.empresaId, usuarioId: actor.uid, accion: 'gestion_' + input.action, registroId: taskRef.id, detail: history, fecha: FieldValue.serverTimestamp() });
      return { id: taskRef.id, repeated: false };
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
