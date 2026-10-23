'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AccessRole = 'dueño' | 'admin' | 'cajero' | 'cobrador';
const roleInfo: Record<AccessRole, { label: string; description: string }> = {
  dueño: { label: 'Dueño de la financiera', description: 'Administra su financiera y crea cuentas para su equipo.' },
  admin: { label: 'Administrador', description: 'Gestiona la operación de esta financiera, sin administrar otras empresas.' },
  cajero: { label: 'Cajero', description: 'Registra cobros y consulta la información necesaria para atenderlos.' },
  cobrador: { label: 'Cobrador', description: 'Consulta su operación de cobranza y registra pagos autorizados.' },
};
type Fields = { nombre: string; documento: string; telefono: string; email: string; password: string; rol: AccessRole };
export function UserAccessDialog({ open, onOpenChange, empresaId, empresaNombre, allowedRoles, onCreated }: {
  open: boolean; onOpenChange: (open: boolean) => void; empresaId: string; empresaNombre: string;
  allowedRoles: AccessRole[]; onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Mount only while open: sensitive form values are discarded on close.
  return <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
    {open && <AccessForm empresaId={empresaId} empresaNombre={empresaNombre} allowedRoles={allowedRoles} onCreated={onCreated} onClose={() => onOpenChange(false)} busy={busy} setBusy={setBusy} />}
  </Dialog>;
}
function AccessForm({ empresaId, empresaNombre, allowedRoles, onCreated, onClose, busy, setBusy }: {
  empresaId: string; empresaNombre: string; allowedRoles: AccessRole[]; onCreated: () => void; onClose: () => void;
  busy: boolean; setBusy: (busy: boolean) => void;
}) {
  const prefix = useId();
  const [fields, setFields] = useState<Fields>({ nombre: '', documento: '', telefono: '', email: '', password: '', rol: allowedRoles[0] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  function update(key: keyof Fields, value: string) {
    setFields(old => ({ ...old, [key]: value }));
    setErrors(old => ({ ...old, [key]: '', form: '' }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const invalid: Record<string, string> = {};
    if (fields.nombre.trim().length < 2) invalid.nombre = 'Escribe al menos dos caracteres.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) invalid.email = 'Escribe un correo válido.';
    if (fields.password.length < 12) invalid.password = 'La contraseña debe tener al menos 12 caracteres.';
    if (!empresaId || !allowedRoles.includes(fields.rol)) invalid.form = 'Selecciona una financiera y un rol disponibles.';
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      document.getElementById(`${prefix}-${Object.keys(invalid)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('La sesión venció. Inicia sesión nuevamente.');
      const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ ...fields, nombre: fields.nombre.trim(), email: fields.email.trim(), empresaId }) });
      const result = await response.json();
      if (!response.ok) {
        setErrors({ form: result.error || 'No se pudo crear la cuenta.', ...result.fields });
        const firstField = Object.keys(result.fields || {})[0];
        if (firstField) document.getElementById(`${prefix}-${firstField}`)?.focus();
        return;
      }
      onCreated(); onClose();
    } catch (error) { setErrors({ form: error instanceof Error ? error.message : 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.' }); }
    finally { setBusy(false); }
  }
  const input = (key: 'nombre' | 'documento' | 'telefono' | 'email', label: string, type = 'text', autoComplete = 'off', placeholder = '') => <div className="min-w-0 space-y-2">
    <Label htmlFor={`${prefix}-${key}`}>{label}</Label>
    <Input id={`${prefix}-${key}`} type={type} required={key === 'nombre' || key === 'email'} autoComplete={autoComplete} placeholder={placeholder} value={fields[key]} onChange={e => update(key, e.target.value)} disabled={busy} maxLength={key === 'nombre' ? 100 : key === 'documento' ? 40 : key === 'telefono' ? 30 : 254} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${prefix}-${key}-error` : undefined} className="h-11" />
    {errors[key] && <p id={`${prefix}-${key}-error`} className="text-sm text-destructive">{errors[key]}</p>}
  </div>;
  return <DialogContent showCloseButton={!busy} className="flex max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
    <DialogHeader className="shrink-0 border-b p-5 pr-12 sm:px-6">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><UserRoundPlus className="size-4" /> Accesos del equipo</div>
      <DialogTitle className="text-xl leading-tight">Crear cuenta de acceso</DialogTitle>
      <DialogDescription>Asigna a la persona responsable y sus permisos en esta financiera.</DialogDescription>
    </DialogHeader>
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col" aria-busy={busy}>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-6">
        <div className="rounded-lg border bg-muted/40 px-4 py-3"><p className="text-xs text-muted-foreground">Financiera seleccionada</p><p className="break-words font-semibold">{empresaNombre || 'Financiera actual'}</p></div>
        {errors.form && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{errors.form}</div>}
        <fieldset className="space-y-4"><legend className="mb-3 text-sm font-semibold">1. Datos de la persona</legend>
          {input('nombre', 'Nombre completo', 'text', 'name', 'Nombres y apellidos')}
          <div className="grid gap-4 sm:grid-cols-2">{input('documento', 'Documento · opcional', 'text', 'off')}{input('telefono', 'Teléfono · opcional', 'tel', 'tel')}</div>
        </fieldset>
        <fieldset className="space-y-4"><legend className="mb-3 text-sm font-semibold">2. Credenciales y permisos</legend>
          {input('email', 'Correo de acceso', 'email', 'off', 'persona@empresa.com')}
          <div className="space-y-2"><Label htmlFor={`${prefix}-role`}>Rol en esta financiera</Label><select id={`${prefix}-role`} className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={fields.rol} disabled={busy} onChange={e => update('rol', e.target.value)} aria-describedby={`${prefix}-role-help`}>{allowedRoles.map(role => <option key={role} value={role}>{roleInfo[role].label}</option>)}</select><p id={`${prefix}-role-help`} className="text-sm text-muted-foreground">{roleInfo[fields.rol].description}</p></div>
          <div className="space-y-2"><Label htmlFor={`${prefix}-password`}>Contraseña inicial</Label><div className="relative"><Input id={`${prefix}-password`} required minLength={12} autoComplete="new-password" type={showPassword ? 'text' : 'password'} value={fields.password} disabled={busy} maxLength={128} onChange={e => update('password', e.target.value)} className="h-11 pr-12" aria-invalid={!!errors.password} aria-describedby={`${prefix}-password-help`} /><Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-0.5" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div><p id={`${prefix}-password-help`} className={`text-sm ${errors.password ? 'text-destructive' : 'text-muted-foreground'}`}>{errors.password || 'Usa entre 12 y 128 caracteres. Comparte el acceso por un canal seguro.'}</p></div>
        </fieldset>
        <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="size-4 shrink-0" />La cuenta tendrá acceso únicamente a la financiera indicada. Crear este acceso no modifica créditos, saldos ni otras cuentas.</p>
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-end sm:px-6"><Button type="button" variant="outline" onClick={onClose} disabled={busy} className="h-11">Cancelar</Button><Button type="submit" disabled={busy} className="h-11 sm:min-w-40">{busy && <Loader2 className="mr-2 size-4 animate-spin" />}{busy ? 'Creando cuenta…' : 'Crear cuenta'}</Button></div>
    </form>
  </DialogContent>;
}
