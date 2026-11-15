import { businessDate,daysOverdue,isOverdue } from "@/lib/business-date";
import { dateSchema,idSchema } from "@/lib/finance-schema";
import { adminDb } from "@/lib/firebase-admin";
import { apiError,requireActor } from "@/lib/server-auth";
import { FieldPath } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const { cursor } = z.object({ cursor: z.object({ date: dateSchema, id: idSchema }).nullable().default(null) }).parse(await request.json());
    const company = (await adminDb.collection("empresas").doc(actor.empresaId).get()).data();
    const today = businessDate(new Date(), company?.zonaHoraria);
    let q = adminDb.collection("cuotas").where("empresaId", "==", actor.empresaId).where("estado", "in", ["pendiente", "parcial", "vencida"]).where("fechaVencimiento", "<", today).orderBy("fechaVencimiento").orderBy(FieldPath.documentId()).limit(51);
    if (cursor) q = q.startAfter(cursor.date, cursor.id);
    const snap = await q.get(), page = snap.docs.slice(0, 50);
    const pending = page.filter(d => isOverdue(d.data() as { fechaVencimiento: string; totalCuota: number; montoPagado?: number }, today));
    const loanIds = [...new Set(pending.map(d => d.data().prestamoId as string))];
    const loans = loanIds.length ? await adminDb.getAll(...loanIds.map(id => adminDb.collection("prestamos").doc(id))) : [];
    const loanMap = new Map(loans.filter(d => d.data()?.empresaId === actor.empresaId && d.data()?.estado !== "cancelado").map(d => [d.id, d.data()!]));
    const clientIds = [...new Set([...loanMap.values()].map(l => l.clienteId as string))];
    const clients = clientIds.length ? await adminDb.getAll(...clientIds.map(id => adminDb.collection("clientes").doc(id))) : [];
    const clientMap = new Map(clients.filter(d => d.data()?.empresaId === actor.empresaId).map(d => [d.id, d.data()!]));
    const rows = pending.flatMap(d => { const c = d.data(), loan = loanMap.get(c.prestamoId), client = loan && clientMap.get(loan.clienteId); return client ? [{ id: d.id, prestamoId: c.prestamoId, clienteNombre: `${client.nombres} ${client.apellidos}`, telefono: client.telefonoPrincipal, numeroCuota: c.numeroCuota, fechaVencimiento: c.fechaVencimiento, saldo: c.totalCuota - (c.montoPagado || 0), diasAtraso: daysOverdue(c.fechaVencimiento, today) }] : []; });
    const last = page.at(-1);
    return NextResponse.json({ rows, next: snap.size > 50 && last ? { date: last.data().fechaVencimiento, id: last.id } : null, today });
  } catch (error) { return apiError(error); }
}
