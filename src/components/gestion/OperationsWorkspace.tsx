'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { apiPost } from '@/lib/api-client';
import { amount } from '@/lib/capital/core';
import { businessDate } from '@/lib/business-date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchPicker } from '@/components/SearchPicker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUnsavedDialog } from '@/hooks/use-unsaved-dialog';
type State = 'pendiente' | 'en_curso' | 'resuelta' | 'cancelada';
type Cursor = { date: string; id: string } | null;
type Task = { id: string; kind: string; title: string; clientId: string | null; clientName: string; assigneeUid: string; assigneeName: string; dueDate: string; note: string; promiseCents: number | null; state: State; version: number; history: { reference: string; date: string; actor: string; state: State; note: string }[] };
type Snapshot = { empresaId: string; items: Task[]; next: Cursor; manager: boolean; clients: { id: string; nombres: string; apellidos: string; cedula: string }[]; members: { id: string; nombre: string }[] };
type Editing = { type: 'create' } | { type: 'update'; task: Task };
const labels: Record<State, string> = { pendiente: 'Pendiente', en_curso: 'En curso', resuelta: 'Resuelta', cancelada: 'Cancelada' };
const kinds: Record<string, string> = { solicitud: 'Solicitud por evaluar', cobranza: 'Gestión de cobranza', seguimiento: 'Seguimiento' };
export function OperationsWorkspace({ initialClientId = '' }: { initialClientId?: string }) {
  const { userData } = useAuth();
  const [scope, setScope] = useState<'open'|'closed'|'all'>('open'), [cursor, setCursor] = useState<Cursor>(null), [pages, setPages] = useState<Cursor[]>([]);
  const [stored, setData] = useState<Snapshot | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const data = stored?.empresaId === userData?.empresaId ? stored : null;
  const requestId = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const current = ++requestId.current;
    try { const result = await apiPost<Snapshot>('/api/gestion', { action: 'list', scope, ...(cursor ? { cursor } : {}) }, signal); if (current === requestId.current && !signal?.aborted) { setData(result); setError(''); } }
    catch (e) { if (current === requestId.current && !signal?.aborted) setError(e instanceof Error ? e.message : 'No se pudieron consultar las gestiones.'); }
    finally { if (current === requestId.current && !signal?.aborted) setLoading(false); }
  }, [scope, cursor]);
  // Synchronizes an abortable server query; state changes occur after the request settles.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, userData?.empresaId]);
  const [editing, setEditing] = useState<Editing | null>(initialClientId ? { type: 'create' } : null), [busy, setBusy] = useState(false), [formError, setFormError] = useState(''), [key, setKey] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({ kind: 'seguimiento', title: '', clientId: initialClientId, dueDate: businessDate(), note: '', assigneeUid: '', promise: '', state: 'pendiente' as State });
  function update<K extends keyof typeof form>(field: K, value: typeof form[K]) { setForm(previous => ({ ...previous, [field]: value })); setKey(crypto.randomUUID()); setFormError(''); }
  function open(action: Editing) { setEditing(action); setFormError(''); setKey(crypto.randomUUID()); setForm({ kind: action.type === 'update' ? action.task.kind : 'seguimiento', title: action.type === 'update' ? action.task.title : '', clientId: action.type === 'update' ? action.task.clientId || '' : initialClientId, dueDate: action.type === 'update' ? action.task.dueDate : businessDate(), note: '', assigneeUid: action.type === 'update' ? action.task.assigneeUid : userData?.uid || '', promise: '', state: action.type === 'update' ? action.task.state : 'pendiente' }); }
  const close = useUnsavedDialog(!!editing, next => { if (!next) setEditing(null); }, !!(form.title && editing?.type === 'create' || form.note), busy);
  const canWrite = !!userData && userData.rol !== 'consulta';
  return <section className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Gestiones y agenda</h1><p className="mt-1 text-sm text-muted-foreground">Solicitudes por evaluar, seguimiento y compromisos de pago.</p></div><div className="flex gap-2"><Button variant="outline" disabled={loading} onClick={() => { setLoading(true); setError(''); void load(); }}>Actualizar</Button>{canWrite && <Button onClick={() => open({ type: 'create' })}>Nueva gestión</Button>}</div></header>
    <p className="rounded-lg border bg-card p-4 text-sm">Una solicitud no aprueba ni desembolsa un crédito. Una promesa de pago no registra un cobro ni modifica saldos. {data?.manager ? 'Puedes asignar trabajo al equipo de tu financiera.' : 'Se muestran las gestiones asignadas a tu usuario.'}</p>
    <label className="flex flex-wrap items-center gap-3 text-sm">Mostrar<select className="min-h-11 rounded-md border bg-background px-3" value={scope} onChange={e => { setLoading(true); setError(''); setScope(e.target.value as typeof scope); setCursor(null); setPages([]); }}><option value="open">Pendientes y en curso</option><option value="closed">Resueltas y canceladas</option><option value="all">Todas</option></select></label>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-destructive">{error}</p>}
    {loading || (!data && !error) ? <p role="status">Consultando agenda…</p> : data && !error && <>
      {!data.items.length && <p className="rounded-lg border border-dashed p-6 text-muted-foreground">No hay gestiones en esta vista.</p>}
      <div className="grid gap-4 lg:grid-cols-2">{data.items.map(task => <article key={task.id} className="space-y-3 rounded-xl border bg-card p-5"><div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{kinds[task.kind] || task.kind}</span><span>{labels[task.state]}</span></div><h2 className="font-semibold">{task.title}</h2>{task.clientId && <Link href={'/clientes/' + task.clientId} className="block text-sm underline">{task.clientName || 'Ver expediente'}</Link>}<p className="text-sm">Responsable: {task.assigneeName}<br />Fecha objetivo: {task.dueDate} {['pendiente','en_curso'].includes(task.state) && task.dueDate < businessDate() && <span className="font-medium text-destructive">· Atrasada</span>}</p>{task.promiseCents != null && <p className="text-sm">Promesa registrada: ${(task.promiseCents / 100).toFixed(2)} · pendiente de verificar en cobros</p>}{task.note && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.note}</p>}<details className="text-sm"><summary className="cursor-pointer">Últimas actualizaciones</summary><ol className="mt-3 space-y-3">{task.history.map(h => <li key={h.reference} className="border-l pl-3"><p>{h.actor} · {labels[h.state]} · {new Date(h.date).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}</p><p className="whitespace-pre-wrap text-muted-foreground">{h.note}</p></li>)}</ol><p className="mt-3 text-xs text-muted-foreground">Se muestran hasta 20 actualizaciones. La auditoría conserva las operaciones.</p></details>{canWrite && <Button variant="outline" onClick={() => open({ type: 'update', task })}>Actualizar gestión</Button>}</article>)}</div>
      <nav aria-label="Paginación de gestiones" className="flex flex-wrap items-center justify-between gap-3 text-sm"><p>Página {pages.length + 1} · hasta 20 gestiones, ordenadas por fecha objetivo</p><div className="flex gap-2"><Button variant="outline" disabled={!pages.length} onClick={() => { setLoading(true); setError(''); setCursor(pages.at(-1) || null); setPages(pages.slice(0, -1)); }}>Anterior</Button><Button variant="outline" disabled={!data.next} onClick={() => { setLoading(true); setError(''); setPages([...pages, cursor]); setCursor(data.next); }}>Siguiente</Button></div></nav>
    </>}
    <Dialog open={!!editing} onOpenChange={close}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editing?.type === 'create' ? 'Nueva gestión' : 'Actualizar gestión'}</DialogTitle><DialogDescription>Control de trabajo interno. No registra dinero ni envía mensajes al cliente.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); if (!editing || !data) return; setBusy(true); setFormError('');
      try {
        if (editing.type === 'create') await apiPost('/api/gestion', { action: 'create', key, kind: form.kind, title: form.title, dueDate: form.dueDate, note: form.note, ...(form.clientId ? { clientId: form.clientId } : {}), assigneeUid: form.assigneeUid || userData?.uid, ...(form.kind === 'cobranza' && form.promise ? { promiseCents: amount(form.promise) } : {}) });
        else await apiPost('/api/gestion', { action: 'update', key, taskId: editing.task.id, version: editing.task.version, state: form.state, assigneeUid: form.assigneeUid, note: form.note });
        setEditing(null); setLoading(true); await load();
      } catch (err) { setFormError(err instanceof Error ? err.message : 'No se pudo guardar la gestión.'); }
      finally { setBusy(false); }
    }}>
      {editing?.type === 'create' ? <><label className="block space-y-2 text-sm">Tipo<select className="min-h-11 w-full rounded-md border bg-background px-3" value={form.kind} onChange={e => update('kind', e.target.value)}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block space-y-2 text-sm">Asunto<Input required minLength={4} maxLength={120} value={form.title} onChange={e => update('title', e.target.value)} /></label><SearchPicker label="Cliente relacionado" value={form.clientId} onChange={value => update('clientId', value)} items={(data?.clients || []).map(c => ({ id: c.id, label: `${c.nombres} ${c.apellidos} — ${c.cedula}` }))} /><label className="block space-y-2 text-sm">Fecha objetivo<Input required type="date" value={form.dueDate} onChange={e => update('dueDate', e.target.value)} /></label>{form.kind === 'cobranza' && <label className="block space-y-2 text-sm">Promesa de pago · USD (opcional)<Input type="number" step="0.01" min="0.01" value={form.promise} onChange={e => update('promise', e.target.value)} /></label>}</> : <><p className="font-medium">{form.title}</p><label className="block space-y-2 text-sm">Estado<select className="min-h-11 w-full rounded-md border bg-background px-3" value={form.state} onChange={e => update('state', e.target.value as State)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></>}
      {data?.manager && <label className="block space-y-2 text-sm">Responsable<select required className="min-h-11 w-full rounded-md border bg-background px-3" value={form.assigneeUid || userData?.uid} onChange={e => update('assigneeUid', e.target.value)}>{data.members.map(member => <option key={member.id} value={member.id}>{member.nombre}</option>)}</select></label>}
      <label className="block space-y-2 text-sm">{editing?.type === 'create' ? 'Detalle (opcional)' : 'Motivo o resultado de la gestión'}<textarea required={editing?.type === 'update'} minLength={editing?.type === 'update' ? 4 : undefined} maxLength={1000} rows={4} className="w-full rounded-md border bg-background p-3" value={form.note} onChange={e => update('note', e.target.value)} /></label>{formError && <p role="alert" className="text-destructive">{formError}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>Cancelar</Button><Button type="submit" disabled={busy || !data}>{busy ? 'Guardando…' : 'Guardar gestión'}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </section>;
}
