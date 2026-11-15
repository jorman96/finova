"use client";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost } from "@/lib/api-client";
import { businessDate } from "@/lib/business-date";
import { managers } from "@/lib/permissions";
import { useResource } from "@/lib/use-resource";
import { endOfMonth,endOfWeek,format,parseISO,startOfMonth,startOfWeek } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from "recharts";
interface Summary {
  capitalInvertido: number | null; cajaDisponible: number | null; capitalPrestadoPeriodo: number; totalRecaudadoPeriodo: number;
  moraVencido: number; clientesMoraCount: number; interesCobrado: number; pagosSinDesglose: number; interesComprometido: number | null;
  spread: number | null; chart: { fecha: string; monto: number }[]; pagosCount: number; prestamosCount: number;
  ultimos: { id: string; clienteNombre: string; monto: number; fecha: string; metodo: string }[];
  generatedAt: string; moneda: string; zonaHoraria: string; today: string;
}
export default function DashboardPage() {
  const { userData } = useAuth();
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [revision, setRevision] = useState(0);
  const { data: summary, error, loading } = useResource<Summary>(JSON.stringify([userData?.empresaId, from, to, revision]), async () => {
    if (!from !== !to || (from && to && from > to)) throw new Error("Selecciona un rango válido.");
    return apiPost<Summary>("/api/dashboard", { from: from || null, to: to || null });
  });
  const money = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: summary?.moneda || "USD" }).format(n);
  const manager = userData && managers.includes(userData.rol);
  const setPeriod = (period: string) => {
    const now = parseISO(summary?.today || businessDate());
    if (period === "histórico") { setFrom(""); setTo(""); }
    else if (period === "hoy") { setFrom(format(now, "yyyy-MM-dd")); setTo(format(now, "yyyy-MM-dd")); }
    else if (period === "semana") { setFrom(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd")); setTo(format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd")); }
    else { setFrom(format(startOfMonth(now), "yyyy-MM-dd")); setTo(format(endOfMonth(now), "yyyy-MM-dd")); }
  };
  return <div className="space-y-6">
    <header><h1 className="text-3xl font-bold">Hola, {userData?.nombre}</h1><p className="text-muted-foreground">{manager ? "Control de liquidez, cartera y compromisos." : "Agenda de cobros y seguimiento de cartera."}</p></header>
    <nav aria-label="Acciones frecuentes" className="flex flex-wrap gap-3">
      <Link className="underline" href="/mora">Cobranza vencida</Link><Link className="underline" href="/prestamos">Préstamos y próximos pagos</Link><Link className="underline" href="/pagos">Historial de cobros</Link>{manager && <Link className="underline" href="/tesoreria">Tesorería y conciliación</Link>}
    </nav>
    <div className="flex flex-wrap items-end gap-3">
      {["hoy","semana","mes","histórico"].map(p => <Button key={p} variant="outline" onClick={() => setPeriod(p)}>{p}</Button>)}
      <label className="text-sm">Desde<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-sm">Hasta<Input type="date" value={to} onChange={e => setTo(e.target.value)} /></label><Button disabled={loading} onClick={() => setRevision(n => n + 1)}>Actualizar</Button>
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {loading && <p role="status">Actualizando indicadores…</p>}
    {summary && !error && <>
      <p className="text-xs text-muted-foreground">Moneda: {summary.moneda} · Zona: {summary.zonaHoraria} · Actualizado: {new Date(summary.generatedAt).toLocaleString("es-EC", { timeZone: summary.zonaHoraria })}. Período: {from || "Inicio del historial"} — {to || summary.today}.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ...(manager ? [{ title: "Capital propio · histórico", value: summary.capitalInvertido || 0, note: "Capital inicial y aportes vigentes" }, { title: "Caja calculada · histórico", value: summary.cajaDisponible || 0, note: "Incluye fondeo, gastos y retiros. Requiere conciliación." }] : []),
          { title: "Desembolsos · período", value: summary.capitalPrestadoPeriodo, note: `${summary.prestamosCount} créditos vigentes o completados` },
          { title: "Cobros · período", value: summary.totalRecaudadoPeriodo, note: `${summary.pagosCount} pagos sin anulaciones` },
          { title: "Deuda vencida · hoy", value: summary.moraVencido, note: `${summary.clientesMoraCount} clientes · fecha y saldo pendiente` },
          { title: "Interés identificado · período", value: summary.interesCobrado, note: summary.pagosSinDesglose ? `${summary.pagosSinDesglose} pagos históricos sin desglose verificable` : "Interés aplicado efectivamente en cada abono" },
        ].map(c => <Card key={c.title}><CardHeader><CardTitle className="text-sm">{c.title}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{money(c.value)}</p><p className="text-xs text-muted-foreground">{c.note}</p></CardContent></Card>)}
      </div>
      {manager && <section className="border rounded p-4 space-y-2"><h2 className="text-lg font-semibold">Margen de intermediación antes de gastos</h2><p>Intereses comprometidos con inversionistas en el período: {money(summary.interesComprometido || 0)}</p><p>{summary.spread === null ? "Margen no disponible: hay pagos históricos que requieren conciliación del desglose." : `Cobros de interés menos compromisos del período: ${money(summary.spread)}`}</p><p className="text-xs text-muted-foreground">Compara cobros efectivos con intereses programados. No representa utilidad neta ni incluye pérdidas o gastos.</p></section>}
      {summary.chart.length > 0 && <section className="space-y-2"><h2 className="text-lg font-semibold">Cobros por fecha de negocio</h2><p className="text-xs text-muted-foreground">Eje horizontal: fecha · Eje vertical: monto ({summary.moneda}) · Fuente: pagos registrados del período.</p><div className="h-64 w-full"><ResponsiveContainer initialDimension={{ width: 800, height: 256 }} minWidth={0}><BarChart data={summary.chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="fecha" /><YAxis /><Tooltip formatter={v => money(Number(v))} /><Bar dataKey="monto" name={`Cobros (${summary.moneda})`} fill="var(--primary)" /></BarChart></ResponsiveContainer></div></section>}
      {summary.ultimos.length > 0 && <section><h2 className="text-lg font-semibold mb-3">Últimos cobros del período</h2><ul className="divide-y">{summary.ultimos.map(p => <li key={p.id} className="py-3 flex justify-between gap-4"><span>{p.clienteNombre}<span className="block text-xs text-muted-foreground">{p.fecha} · {p.metodo}</span></span><span>{money(p.monto)}</span></li>)}</ul></section>}
    </>}
  </div>;
}
