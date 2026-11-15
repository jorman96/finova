import { adminDb } from "@/lib/firebase-admin";
import { apiError,requireActor } from "@/lib/server-auth";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try {
    await requireActor(request, ["superadmin"]);
    const [companies, owners, loans, clients] = await Promise.all([
      adminDb.collection("empresas").get(), adminDb.collection("usuarios").where("rol", "==", "dueño").get(), adminDb.collection("prestamos").get(), adminDb.collection("clientes").count().get(),
    ]);
    const activeLoans = loans.docs.filter(d => d.data().estado !== "cancelado");
    const growth = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map(mes => ({ mes, nuevas: 0 }));
    for (const d of companies.docs) { const raw = d.data().createdAt, date = raw?.toDate ? raw.toDate() : new Date(raw || 0); if (date.getFullYear() === new Date().getFullYear()) growth[date.getMonth()].nuevas++; }
    return NextResponse.json({ empresas: companies.docs.map(d => ({ ...d.data(), id: d.id, dueno: owners.docs.find(o => o.data().empresaId === d.id)?.data() || null })), metrics: { clientes: clients.data().count, prestamos: activeLoans.length, empresas: companies.size, capitalTotal: activeLoans.reduce((n, d) => n + d.data().monto, 0) }, chartData: { estados: [{ name: "Activos", value: activeLoans.filter(d => d.data().estado === "activo").length }, { name: "Completados", value: activeLoans.filter(d => d.data().estado === "completado").length }, { name: "En Mora", value: activeLoans.filter(d => d.data().estado === "moroso").length }], crecimientoInquilinos: growth } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
