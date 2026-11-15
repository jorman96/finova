import { businessDate } from "@/lib/business-date";
import { idSchema } from "@/lib/finance-schema";
import { adminDb } from "@/lib/firebase-admin";
import { sumMoney } from "@/lib/money";
import { managers } from "@/lib/permissions";
import { apiError,requireActor } from "@/lib/server-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, managers);
    const { cursor } = z.object({ cursor: idSchema.nullable().default(null) }).parse(await request.json());
    const company = (await adminDb.collection("empresas").doc(actor.empresaId).get()).data()!;
    let q = adminDb.collection("movimientos_caja").where("empresaId", "==", actor.empresaId).orderBy("fecha", "desc").limit(51);
    if (cursor) { const snap = await adminDb.collection("movimientos_caja").doc(cursor).get(); if (snap.data()?.empresaId === actor.empresaId) q = q.startAfter(snap); }
    const snap = await q.get(), today = businessDate(new Date(), company.zonaHoraria), end = businessDate(new Date(Date.now() + 30 * 86400000), company.zonaHoraria);
    const due = async (collection: string) => {
      const docs = await adminDb.collection(collection).where("empresaId", "==", actor.empresaId).where("fechaVencimiento", ">=", today).where("fechaVencimiento", "<=", end).get();
      return sumMoney(docs.docs.filter(d => d.data().estado !== "anulada").map(d => Math.max(0, d.data().totalCuota - (d.data().montoPagado || 0))));
    };
    const [expectedIn, expectedOut] = await Promise.all([due("cuotas"), due("cuotas_inversionistas")]);
    const page = snap.docs.slice(0, 50);
    return NextResponse.json({ moneda: company.moneda || "USD", cuentas: company.cuentasBancarias || [], rows: page.map(d => ({ ...d.data(), id: d.id, fecha: d.data().fecha.toDate().toISOString() })), next: snap.size > 50 ? page.at(-1)!.id : null, forecast: { from: today, to: end, expectedIn, expectedOut, net: sumMoney([expectedIn, -expectedOut]) } });
  } catch (error) { return apiError(error); }
}
