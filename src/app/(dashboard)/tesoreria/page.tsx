"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost } from "@/lib/api-client";
import { useFinanceRequest } from "@/lib/use-finance-request";
import { useResource } from "@/lib/use-resource";
import { useState } from "react";
import { toast } from "sonner";
interface Treasury { moneda: string; cuentas: { id: string; banco: string; numero: string }[]; rows: { id: string; fecha: string; fechaStr?: string; tipo: string; monto: number; direccion: string; cuenta: string; conciliado: boolean; motivo?: string; referencia?: string }[]; next: string | null; forecast: { from: string; to: string; expectedIn: number; expectedOut: number; net: number } }
export default function TreasuryPage() {
  const { userData } = useAuth(), finance = useFinanceRequest();
  const [revision, setRevision] = useState(0), [cursors, setCursors] = useState<(string | null)[]>([null]), [page, setPage] = useState(0);
  const [tipo, setTipo] = useState("gasto"), [monto, setMonto] = useState(""), [origen, setOrigen] = useState("Caja General"), [destino, setDestino] = useState(""), [motivo, setMotivo] = useState(""), [referencia, setReferencia] = useState(""), [saving, setSaving] = useState(false);
  const { data, error, loading } = useResource<Treasury>(JSON.stringify([userData?.empresaId, cursors[page], revision]), () => apiPost<Treasury>("/api/treasury", { cursor: cursors[page] }));
  const money = (value: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: data?.moneda || "USD" }).format(value);
  const account = (id: string) => data?.cuentas.find(c => c.id === id)?.banco || id;
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Tesorería y conciliación</h1><p className="text-muted-foreground">Movimientos conservados con usuario y referencia. La conciliación confirma tu revisión contra el banco o arqueo de caja.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}{loading && <p role="status">Cargando…</p>}
    {data && <><section className="border rounded p-4 space-y-2"><h2 className="font-semibold">Proyección de compromisos a 30 días</h2><p>{data.forecast.from} — {data.forecast.to}</p><p>Cobros programados: {money(data.forecast.expectedIn)} · Pagos a inversionistas: {money(data.forecast.expectedOut)} · Flujo programado: {money(data.forecast.net)}</p><p className="text-xs text-muted-foreground">Proyección basada en cuotas pendientes. No incluye nuevos préstamos, gastos futuros ni certeza de cobro.</p></section>
      <form className="border rounded p-4 space-y-3" onSubmit={async e => {
        e.preventDefault(); setSaving(true);
        try { await finance.submit({ action: "cash", tipo, monto: Number(monto), cuentaOrigen: origen, cuentaDestino: destino || undefined, motivo, referencia }); finance.reset(); setMonto(""); setMotivo(""); setReferencia(""); setPage(0); setRevision(n => n + 1); toast.success("Movimiento registrado."); }
        catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo registrar"); } finally { setSaving(false); }
      }}><h2 className="font-semibold">Registrar movimiento</h2><div className="grid gap-3 sm:grid-cols-2">
        <label>Tipo<select className="block border rounded p-2 w-full bg-background" value={tipo} onChange={e => setTipo(e.target.value)}>{["gasto","retiro","ingreso","transferencia"].map(t => <option key={t}>{t}</option>)}</select></label>
        <label>Monto ({data.moneda})<Input type="number" min="0.01" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} required /></label>
        <label>Cuenta de origen<select className="block border rounded p-2 w-full bg-background" value={origen} onChange={e => setOrigen(e.target.value)}><option>Caja General</option>{data.cuentas.map(c => <option key={c.id} value={c.id}>{c.banco} · {c.numero}</option>)}</select></label>
        {tipo === "transferencia" && <label>Cuenta de destino<select className="block border rounded p-2 w-full bg-background" value={destino} onChange={e => setDestino(e.target.value)} required><option value="">Selecciona</option><option>Caja General</option>{data.cuentas.map(c => <option key={c.id} value={c.id}>{c.banco} · {c.numero}</option>)}</select></label>}
        <label>Motivo<Input value={motivo} onChange={e => setMotivo(e.target.value)} minLength={5} maxLength={500} required /></label><label>Referencia bancaria o documento<Input value={referencia} onChange={e => setReferencia(e.target.value)} maxLength={120} /></label>
      </div><Button disabled={saving}>{saving ? "Registrando…" : "Registrar con auditoría"}</Button></form>
      <div className="flex gap-3"><Button variant="outline" disabled={!page || loading} onClick={() => setPage(p => p - 1)}>Anterior</Button><span>Página {page + 1}</span><Button variant="outline" disabled={!data.next || loading} onClick={() => { setCursors(c => [...c.slice(0, page + 1), data.next]); setPage(p => p + 1); }}>Siguiente</Button><Button variant="ghost" onClick={() => setRevision(n => n + 1)}>Actualizar</Button></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th>Fecha</th><th>Tipo / cuenta</th><th>Monto</th><th>Referencia</th><th>Conciliación</th></tr></thead><tbody>{data.rows.map(r => <tr key={r.id} className="border-b"><td className="py-3">{r.fechaStr || r.fecha.slice(0, 10)}</td><td>{({ gasto: "Gasto", retiro: "Retiro", ingreso: "Ingreso", transferencia: "Transferencia", cobro: "Cobro", desembolso: "Desembolso", fondeo: "Fondeo", pago_inversionista: "Pago a inversionista", reversion_cobro: "Reversión de cobro", reversion_desembolso: "Reversión de desembolso", aporte_capital: "Aporte de capital" } as Record<string, string>)[r.tipo] || r.tipo}<span className="block text-xs">{account(r.cuenta)}</span></td><td>{r.direccion === "egreso" ? "−" : "+"}{money(r.monto)}</td><td>{r.referencia || r.motivo || "—"}</td><td>{r.conciliado ? "Conciliado" : <Button size="sm" variant="outline" disabled={saving} onClick={async () => {
        const ref = window.prompt("Referencia del estado bancario o arqueo verificado (mínimo 3 caracteres)"); if (!ref) return;
        setSaving(true);
        try { await finance.submit({ action: "reconcile", movimientoId: r.id, referencia: ref }); finance.reset(); setRevision(n => n + 1); }
        catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo conciliar"); } finally { setSaving(false); }
      }}>Marcar conciliado</Button>}</td></tr>)}</tbody></table></div>
    </>}
  </div>;
}
