'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiPost } from '@/lib/api-client';
import { cents, chart, validateLines, type Line } from '@/lib/accounting/core';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

type Snapshot = {
  empresaId: string;
  enabled: boolean; currency: string; startDate: string | null; closedThrough: string | null;
  invalidLoanDates: number; loanCount: number; trialDifference: number;
  chart: { code: string; name: string; kind: string; net: number }[];
  savings: { id: string; clientId: string; balance: number; held: number; state: string }[];
  entries: { id: string; date: string; description: string; totals: { debit: number; credit: number }; reverses: string | null; lines: Line[] }[];
  moreEntries: boolean; moreSavings: boolean;
  legacyReview: { checked: number; total: number; issueCount: number; issues: { reference: string; reason: string }[]; moreIssues: boolean };
};
const money = (value: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value / 100);
const kindNames: Record<string, string> = { asset: 'Activo', liability: 'Pasivo', equity: 'Patrimonio', income: 'Ingreso', expense: 'Gasto' };
export default function AccountingPage() {
  const { userData } = useAuth();
  const [snapshot, setData] = useState<Snapshot | null>(null);
  const data = snapshot?.empresaId === userData?.empresaId ? snapshot : null;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('catalog');
  const [amount, setAmount] = useState('');
  const [debit, setDebit] = useState('1101');
  const [credit, setCredit] = useState('3101');
  const [preview, setPreview] = useState<Line[] | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await apiPost<Snapshot>('/api/accounting/status', {})); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar la contabilidad.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    apiPost<Snapshot>('/api/accounting/status', {}).then(result => {
      if (active) setData(result);
    }).catch(e => {
      if (active) setError(e instanceof Error ? e.message : 'No se pudo consultar la contabilidad.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userData?.empresaId]);
  function simulate(event: React.FormEvent) {
    event.preventDefault(); setError(''); setPreview(null);
    try {
      if (debit === credit) throw new Error('Selecciona dos cuentas diferentes.');
      const value = cents(amount);
      const lines = [{ account: debit, debit: value, credit: 0 }, { account: credit, debit: 0, credit: value }];
      validateLines(lines); setPreview(lines);
    } catch (e) { setError(e instanceof Error ? e.message : 'Revisa el importe.'); }
  }
  return <section className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Contabilidad</h1><p className="text-muted-foreground">Libro mayor y base de las futuras cuentas de ahorro.</p></div>
      <Button variant="outline" onClick={load} disabled={loading}>{loading ? 'Consultando…' : 'Actualizar'}</Button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{error}</p>}
    {loading && !data && <p role="status">Consultando el estado contable…</p>}
    {data && <>
      <div className="rounded-xl border bg-card p-5 space-y-2">
        <h2 className="font-semibold">{data.enabled ? 'Núcleo contable habilitado' : 'Preparación contable · operación actual preservada'}</h2>
        <p className="text-sm">Moneda base: dólar americano (USD). Inicio contable: <strong>{data.startDate || 'Pendiente: esta financiera no tiene préstamos con fecha válida'}</strong>.</p>
        <p className="text-sm text-muted-foreground">La fecha corresponde al préstamo más antiguo de esta financiera. Los préstamos y pagos anteriores aún no forman parte de este libro. Sus saldos deben conciliarse antes de incorporar la apertura; los valores de este módulo no representan todavía el patrimonio real.</p>
        {!data.enabled && <p className="text-sm">Los depósitos, retiros y asientos reales están deshabilitados hasta aprobar la apertura. El simulador no guarda movimientos ni cambia saldos.</p>}
        {data.invalidLoanDates > 0 && <p role="alert" className="text-sm text-destructive">Hay {data.invalidLoanDates} préstamos con fecha inválida. Deben revisarse antes de confirmar el inicio contable.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Control del libro nuevo</p><p className="text-xl font-semibold">{data.trialDifference === 0 ? 'Débitos y créditos cuadrados' : 'Diferencia por revisar'}</p><p>{money(data.trialDifference)}</p></article>
        <article className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Último cierre</p><p className="text-xl font-semibold">{data.closedThrough || 'Sin cierres registrados'}</p></article>
        <article className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Historial por conciliar</p><p className="text-xl font-semibold">{data.loanCount} préstamos</p><p className="text-sm text-muted-foreground">Sin migración automática de importes</p></article>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Secciones de contabilidad">
        {[['catalog', 'Catálogo y balance'], ['entries', 'Libro diario'], ['review', 'Conciliación previa'], ['savings', 'Cuentas de ahorro'], ['simulator', 'Simular asiento']].map(([key, label]) => <Button key={key} variant={tab === key ? 'default' : 'outline'} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</Button>)}
      </div>
      {tab === 'catalog' && <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><caption className="p-4 text-left font-semibold">Catálogo inicial · saldos exclusivos del libro nuevo</caption><thead><tr className="border-b text-left"><th className="p-3">Código</th><th className="p-3">Cuenta</th><th className="p-3">Clase</th><th className="p-3 text-right">Débito</th><th className="p-3 text-right">Crédito</th></tr></thead><tbody>{data.chart.map(a => <tr key={a.code} className="border-b"><td className="p-3">{a.code}</td><td className="p-3">{a.name}</td><td className="p-3">{kindNames[a.kind]}</td><td className="p-3 text-right">{money(Math.max(a.net, 0))}</td><td className="p-3 text-right">{money(Math.max(-a.net, 0))}</td></tr>)}</tbody></table></div>}
      {tab === 'entries' && <div className="space-y-3"><h2 className="font-semibold">Libro diario · últimos 50 asientos</h2>{!data.entries.length && <p className="rounded-lg border p-6">Aún no hay asientos. El historial operativo permanece en Créditos y Pagos.</p>}{data.entries.map(entry => <details key={entry.id} className="rounded-lg border p-4"><summary className="cursor-pointer">{entry.date} · {entry.description} · {money(entry.totals.debit)}{entry.reverses ? ' · Reverso' : ''}</summary><ul className="mt-3 space-y-1 text-sm">{entry.lines.map((line, i) => <li key={i}>{line.account} · Débito {money(line.debit)} · Crédito {money(line.credit)}</li>)}</ul></details>)}{data.moreEntries && <p>Se muestran los 50 asientos más recientes; no es un estado de cuenta completo.</p>}</div>}
      {tab === 'review' && <div className="rounded-lg border p-5 space-y-3"><h2 className="font-semibold">Diagnóstico del historial · sin modificar registros</h2><p>Créditos con importes comprobables: {data.legacyReview.checked} de {data.legacyReview.total}. Observaciones: {data.legacyReview.issueCount}.</p><p className="text-sm text-muted-foreground">Compara el total pactado menos pagos contra el saldo contractual guardado. No certifica caja, bancos, capital pendiente ni intereses devengados; tampoco sustituye una conciliación contable. Los importes con más de dos decimales se señalan para revisión sin redondearlos automáticamente.</p>{data.legacyReview.issueCount === 0 ? <p>No se detectaron diferencias en esta comprobación limitada.</p> : <ul className="space-y-2">{data.legacyReview.issues.map((issue, i) => <li key={i} className="rounded-md bg-muted p-3 text-sm"><span className="break-all">Referencia {issue.reference}</span><p>{issue.reason}</p></li>)}</ul>}{data.legacyReview.moreIssues && <p>Se muestran las primeras 20 observaciones.</p>}</div>}
      {tab === 'savings' && <div className="space-y-3"><h2 className="font-semibold">Cuentas individuales · USD</h2><p className="text-sm text-muted-foreground">El saldo disponible descuenta los bloqueos. Las inversiones existentes conservan su tratamiento y no se convierten en ahorros.</p>{!data.savings.length && <p className="rounded-lg border p-6">No se han abierto cuentas de ahorro. La apertura y los canales de depósitos se incorporarán después de conciliar y autorizar la operación.</p>}{data.savings.map(a => <article key={a.id} className="rounded-lg border p-4"><p>Cuenta {a.id}</p><p>Contable: {money(a.balance)} · Bloqueado: {money(a.held)} · Disponible: {money(a.balance - a.held)}</p></article>)}{data.moreSavings && <p>Se muestran hasta 200 cuentas; esta vista no es un total institucional.</p>}</div>}
      {tab === 'simulator' && <div className="rounded-lg border bg-card p-5 space-y-4"><h2 className="font-semibold">Simulador de partida doble</h2><p className="text-sm text-muted-foreground">Ejemplo de asiento. No guarda datos ni registra una apertura real.</p><form onSubmit={simulate} className="grid gap-4 sm:grid-cols-3"><label className="space-y-2">Cuenta de débito<select className="w-full rounded-md border bg-background p-2" value={debit} onChange={e => { setDebit(e.target.value); setPreview(null); }}>{chart.filter(a => a.code !== '2101').map(a => <option value={a.code} key={a.code}>{a.code} · {a.name}</option>)}</select></label><label className="space-y-2">Cuenta de crédito<select className="w-full rounded-md border bg-background p-2" value={credit} onChange={e => { setCredit(e.target.value); setPreview(null); }}>{chart.filter(a => a.code !== '2101').map(a => <option value={a.code} key={a.code}>{a.code} · {a.name}</option>)}</select></label><label className="space-y-2">Importe USD<input inputMode="decimal" placeholder="100.00" value={amount} onChange={e => { setAmount(e.target.value); setPreview(null); }} className="w-full rounded-md border bg-background p-2" required /></label><Button type="submit">Validar simulación</Button></form>{preview && <div role="status" className="rounded-lg border p-4"><p className="font-semibold">Asiento balanceado · sin guardar</p>{preview.map((line, i) => <p key={i}>{line.account}: débito {money(line.debit)}, crédito {money(line.credit)}</p>)}<p>Diferencia: {money(0)}</p></div>}</div>}
    </>}
  </section>;
}
