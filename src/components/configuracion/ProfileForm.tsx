'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { apiPost } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
export function ProfileForm() {
  const { user, userData } = useAuth();
  const [names, setNames] = useState(userData?.nombres || ''), [surnames, setSurnames] = useState(userData?.apellidos || ''), [phone, setPhone] = useState(userData?.telefono || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  return <form className="max-w-xl space-y-5 rounded-xl border bg-card p-5" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setSaved(false); try { await apiPost('/api/perfil', { nombres: names, apellidos: surnames, telefono: phone }); setSaved(true); } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); } finally { setBusy(false); } }}>
    <div><h2 className="font-semibold">Mi perfil</h2><p className="mt-1 text-sm text-muted-foreground">Nombre registrado: {userData?.nombre}. El encabezado utilizará tu primer nombre y primer apellido.</p></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="profile-names">Nombres</Label><Input id="profile-names" autoComplete="given-name" maxLength={100} required value={names} onChange={e => { setNames(e.target.value); setSaved(false); }} /></div><div className="space-y-2"><Label htmlFor="profile-surnames">Apellidos</Label><Input id="profile-surnames" autoComplete="family-name" maxLength={100} required value={surnames} onChange={e => { setSurnames(e.target.value); setSaved(false); }} /></div></div>
    <div className="space-y-2"><Label htmlFor="profile-phone">Teléfono</Label><Input id="profile-phone" type="tel" autoComplete="tel" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} /></div>
    <p className="text-sm">Correo de acceso: {user?.email}<br />Cargo: {userData?.rol}. Los cambios de acceso se gestionan con el administrador.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}{saved && <p role="status">Perfil actualizado.</p>}
    <div className="flex flex-wrap items-center gap-4"><Button disabled={busy} type="submit">{busy ? 'Guardando…' : 'Guardar perfil'}</Button><Link href="/seguridad" className="text-sm underline">Seguridad y autenticador</Link></div>
  </form>;
}
