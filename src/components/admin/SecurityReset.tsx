'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiPost } from '@/lib/api-client';
import { resetCategories, type ResetCategory } from '@/lib/reset-categories';

type Result = { status: 'available' | 'pending' | 'completed'; categories?: ResetCategory[]; reason?: string; expiresAt?: number; preview?: string; counts?: Partial<Record<ResetCategory, number>>; resetsBalances?: boolean };

export function SecurityReset({ empresaId, nombre, owner = false }: { empresaId: string; nombre: string; owner?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result>();
  const [selected, setSelected] = useState<ResetCategory[]>([]);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  async function send(action: string, fields: Record<string, unknown> = {}) {
    setBusy(true); setError('');
    try {
      const value = await apiPost<Result>('/api/admin/borrado-seguridad', { action, empresaId, ...fields });
      if (action === 'request') {
        setResult({ ...value, categories: selected, reason });
      } else setResult(value);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
    <Button type="button" size="sm" variant="outline" onClick={() => {
      setOpen(true); setResult(undefined); setSelected([]); setReason(''); setConfirmed(false); setConfirmation(''); void send('status');
    }}>{owner ? 'Solicitar borrado de seguridad' : 'Borrado de seguridad'}</Button>
    <DialogContent showCloseButton={!busy} className="max-h-[90dvh] sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{owner ? 'Autorizar borrado de seguridad' : 'Borrado de seguridad'}</DialogTitle>
        <DialogDescription>{nombre}. La ejecución es irreversible y está disponible una sola vez por financiera. Se conservan los usuarios, la financiera, los archivos adjuntos y la auditoría.</DialogDescription>
      </DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {busy && <p role="status" className="text-sm">Procesando…</p>}
      {result?.status === 'completed' && <p className="text-sm">El borrado único ya fue utilizado. La reactivación de la financiera se gestiona por separado.</p>}
      {result?.status === 'available' && !owner && <p className="text-sm">El dueño debe solicitarlo desde Configuración → Sistema. No hay una autorización vigente.</p>}
      {result?.status === 'available' && owner && <fieldset disabled={busy} className="space-y-3 text-sm">
        <legend className="mb-2 font-semibold">Elige qué autorizas borrar</legend>
        {(Object.entries(resetCategories) as [ResetCategory, string][]).map(([key, label]) => <label key={key} className="flex gap-2">
          <input type="checkbox" checked={selected.includes(key)} onChange={e => setSelected(old => e.target.checked ? [...old, key] : old.filter(item => item !== key))} />{label}
        </label>)}
        <label className="block space-y-1">Motivo de la solicitud<Input value={reason} minLength={12} maxLength={500} onChange={e => setReason(e.target.value)} /></label>
        <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Autorizo al superadmin a borrar definitivamente las categorías seleccionadas.</label>
        <Button type="button" disabled={!confirmed || !selected.length || reason.trim().length < 12} onClick={() => void send('request', { categories: selected, reason, confirmed })}>Autorizar solicitud</Button>
      </fieldset>}
      {result?.status === 'pending' && <div className="space-y-3 text-sm">
        <p className="font-semibold">Autorización vigente del dueño</p>
        {result.expiresAt && <p>Vence: {new Date(result.expiresAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}</p>}
        <p className="break-words">{result.reason}</p>
        <ul className="list-disc space-y-1 pl-5">{result.categories?.map(category => <li key={category}>{resetCategories[category]}{result.counts && ' · ' + (result.counts[category] ?? 0) + ' registros'}</li>)}</ul>
        {result.resetsBalances && <p>El capital inicial se pondrá en cero y se quitarán las inyecciones registradas.</p>}
        {owner ? <Button type="button" variant="outline" disabled={busy} onClick={() => void send('cancel')}>Retirar autorización</Button> : <>
          <p>Suspende la financiera antes de revisar. El borrado no la reactivará.</p>
          <Button type="button" variant="outline" disabled={busy} onClick={() => { setConfirmation(''); void send('preview'); }}>Revisar qué se borrará</Button>
          {result.preview && <>
            <label className="block space-y-1">Escribe <strong className="break-all">BORRAR {empresaId}</strong> para confirmar<Input value={confirmation} maxLength={150} disabled={busy} onChange={e => setConfirmation(e.target.value)} /></label>
            <Button type="button" variant="destructive" disabled={busy || confirmation !== 'BORRAR ' + empresaId} onClick={() => void send('execute', { preview: result.preview, confirmation })}>Ejecutar borrado definitivo</Button>
          </>}
        </>}
      </div>}
    </DialogContent>
  </Dialog>;
}
