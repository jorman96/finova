import { businessDate,isOverdue } from "@/lib/business-date";
import { dateSchema } from "@/lib/finance-schema";
import { adminDb } from "@/lib/firebase-admin";
import { managers } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { apiError,requireActor } from "@/lib/server-auth";
import type { DocumentData } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, managers);
    await rateLimit("reports:" + actor.uid, 10, 60_000);
    const range = z.object({ from: dateSchema, to: dateSchema }).refine(r => r.from <= r.to).parse(await request.json());
    const company = (await adminDb.collection("empresas").doc(actor.empresaId).get()).data()!;
    const all = async (name: string) => {
      const rows: DocumentData[] = [];
      const stream = adminDb.collection(name).where("empresaId", "==", actor.empresaId).stream();
      for await (const item of stream) { const d = item as unknown as FirebaseFirestore.QueryDocumentSnapshot; rows.push({ ...d.data(), id: d.id }); }
      return rows;
    };
    const [payments, loans, cuotas, clients] = await Promise.all([all("pagos"), all("prestamos"), all("cuotas"), all("clientes")]);
    const clientMap = new Map(clients.map(c => [c.id, `${c.nombres} ${c.apellidos}`]));
    const date = (v: unknown) => typeof v === "string" ? v.slice(0, 10) : v && typeof v === "object" && "toDate" in v ? businessDate((v as { toDate: () => Date }).toDate(), company.zonaHoraria) : "";
    const inRange = (d: string) => d >= range.from && d <= range.to;
    const today = businessDate(new Date(), company.zonaHoraria);
    return NextResponse.json({ moneda: company.moneda || "USD", corteMora: today,
      pagos: payments.filter(p => !p.anulado && inRange(p.fechaStr || date(p.fecha))).map(p => ({ ...p, fechaStr: p.fechaStr || date(p.fecha), clienteNombre: p.clienteNombre || clientMap.get(p.clienteId) || "Cliente" })),
      prestamos: loans.filter(p => p.estado !== "cancelado" && inRange(p.fechaDesembolso || date(p.createdAt))),
      mora: cuotas.filter(c => isOverdue(c as { fechaVencimiento: string; totalCuota: number; montoPagado?: number }, today)).map(c => ({ ...c, clienteNombre: clientMap.get(c.clienteId) || "Cliente" })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
