import { businessDate,isOverdue,normalizeTimeZone } from "@/lib/business-date";
import { exactCollectedInterest } from "@/lib/dashboard-metrics";
import { dateSchema } from "@/lib/finance-schema";
import { adminDb } from "@/lib/firebase-admin";
import { sumMoney } from "@/lib/money";
import { managers } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { apiError,requireActor } from "@/lib/server-auth";
import { FieldPath,type DocumentData } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
const range = z.object({ from: dateSchema.nullable(), to: dateSchema.nullable() }).refine(d => (!d.from && !d.to) || (!!d.from && !!d.to && d.from <= d.to));
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await rateLimit("dashboard:" + actor.uid, 20, 60_000);
    const { from, to } = range.parse(await request.json());
    const company = (await adminDb.collection("empresas").doc(actor.empresaId).get()).data()!;
    const cacheRef = adminDb.collection("dashboard_cache").doc(`${actor.empresaId}_${from || "all"}_${to || "all"}`);
    const cached = (await cacheRef.get()).data();
    let result = cached && cached.revision === (company.financialRevision || 0) && cached.expiresAt > Date.now() ? cached.result : null;
    if (!result) {
      const all = async (name: string) => {
        const rows: (DocumentData & { id: string })[] = [];
        // Read in pages; no history listeners or unbounded snapshots in the browser.
        let cursor: string | undefined;
        while (true) {
          let q = adminDb.collection(name).where("empresaId", "==", actor.empresaId).orderBy(FieldPath.documentId()).limit(500);
          if (cursor) q = q.startAfter(cursor);
          const snap = await q.get();
          rows.push(...snap.docs.map(d => ({ ...d.data(), id: d.id })));
          if (snap.size < 500) break;
          cursor = snap.docs.at(-1)!.id;
        }
        return rows;
      };
      const [loansRaw, paymentsRaw, cuotas, investments, investorQuotas, investorPayments, movements] = await Promise.all([all("prestamos"), all("pagos"), all("cuotas"), all("inversion_contratos"), all("cuotas_inversionistas"), all("pagos_inversionistas"), all("movimientos_caja")]);
      const loans = loansRaw.filter(p => p.estado !== "cancelado");
      const dateOf = (p: Record<string, unknown>, key: string) => { const v = p[key] as { toDate?: () => Date } | string | undefined; return typeof v === "string" ? v.slice(0, 10) : v?.toDate ? businessDate(v.toDate(), company.zonaHoraria) : ""; };
      const inRange = (d: string) => !!d && (!from || d >= from) && (!to || d <= to);
      const payments = paymentsRaw.filter(p => !p.anulado);
      const selectedPayments = payments.filter(p => inRange(dateOf(p, "fechaStr") || dateOf(p, "fecha")));
      const selectedLoans = loans.filter(p => inRange(dateOf(p, "fechaDesembolso") || dateOf(p, "createdAt")));
      const today = businessDate(new Date(), company.zonaHoraria);
      const overdue = cuotas.filter(c => isOverdue(c as unknown as { fechaVencimiento: string; totalCuota: number; montoPagado?: number }, today));
      const interest = exactCollectedInterest(selectedPayments);
      const activeInvestments = investments.filter(i => i.estado !== "cancelado");
      const investorInterest = sumMoney(investorQuotas.filter(q => inRange(String(q.fechaVencimiento)) && activeInvestments.some(i => i.id === q.inversionContratoId)).map(q => Number(q.interes || 0)));
      const ownCapital = sumMoney([Number(company.capitalInicial || 0), ...(company.inyeccionesCapital || []).filter((i: { revertida?: boolean }) => !i.revertida).map((i: { monto: number }) => i.monto)]);
      const funding = sumMoney(activeInvestments.map(i => Number(i.montoTotal || 0)));
      const extra = sumMoney(movements.filter(m => ["gasto", "retiro", "ingreso"].includes(String(m.tipo))).map(m => Number(m.monto) * (m.direccion === "egreso" ? -1 : 1)));
      const byDay = new Map<string, number>();
      for (const p of selectedPayments) { const d = dateOf(p, "fechaStr") || dateOf(p, "fecha"); byDay.set(d, sumMoney([byDay.get(d) || 0, Number(p.monto)])); }
      result = {
        capitalInvertido: ownCapital, cajaDisponible: sumMoney([ownCapital, funding, sumMoney(payments.map(p => Number(p.monto))), -sumMoney(loans.map(l => Number(l.monto))), -sumMoney(investorPayments.filter(p => !p.anulado).map(p => Number(p.monto))), extra]),
        capitalPrestadoPeriodo: sumMoney(selectedLoans.map(l => Number(l.monto))), totalRecaudadoPeriodo: sumMoney(selectedPayments.map(p => Number(p.monto))),
        moraVencido: sumMoney(overdue.map(c => Number(c.totalCuota) - Number(c.montoPagado || 0))), clientesMoraCount: new Set(overdue.map(c => c.clienteId)).size,
        interesCobrado: interest.amount, pagosSinDesglose: interest.missing, interesComprometido: investorInterest, spread: interest.missing ? null : sumMoney([interest.amount, -investorInterest]),
        chart: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, monto]) => ({ fecha, monto })),
        pagosCount: selectedPayments.length, prestamosCount: selectedLoans.length,
        ultimos: [...selectedPayments].sort((a, b) => (dateOf(b, "fecha") || "").localeCompare(dateOf(a, "fecha"))).slice(0, 10).map(p => ({ id: p.id, clienteNombre: p.clienteNombre || "Cliente", monto: p.monto, fecha: dateOf(p, "fecha"), metodo: p.metodo })),
        generatedAt: new Date().toISOString(), moneda: company.moneda || "USD", zonaHoraria: normalizeTimeZone(company.zonaHoraria), today,
      };
      await cacheRef.set({ result, revision: company.financialRevision || 0, expiresAt: Date.now() + 30_000 });
    }
    if (!managers.includes(actor.rol)) { result = { ...result, capitalInvertido: null, cajaDisponible: null, interesComprometido: null, spread: null }; }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
