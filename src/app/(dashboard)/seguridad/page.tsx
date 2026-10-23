"use client";
import { useEffect, useState } from "react";
import { EmailAuthProvider, multiFactor, reauthenticateWithCredential, reload, sendEmailVerification, TotpMultiFactorGenerator, type TotpSecret } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
type Status = { available: boolean; enrolled: boolean; emailVerified: boolean };
export default function SeguridadPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null), [error, setError] = useState("");
  const [password, setPassword] = useState(""), [code, setCode] = useState("");
  const [secret, setSecret] = useState<TotpSecret | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; apiPost<Status>("/api/security/status", {}).then(s => { if (active) setStatus(s); }).catch(() => { if (active) setError("No se pudo consultar la seguridad de la cuenta."); }); return () => { active = false; }; }, []);
  async function run(action: () => Promise<void>) { setBusy(true); setError(""); try { await action(); } catch { setError("No se completó la operación. Revisa la contraseña o código; si la sesión venció, vuelve a ingresar."); } finally { setBusy(false); setPassword(""); } }
  return <main className="max-w-xl space-y-5">
    <h1 className="text-2xl font-bold">Seguridad de mi cuenta</h1>
    <p>La verificación en dos pasos añade un código de una aplicación autenticadora. La activación es voluntaria y no cambia tu usuario ni tus permisos.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!status && !error && <p>Cargando estado…</p>}
    {status?.enrolled ? <p role="status">Tu cuenta ya tiene verificación en dos pasos. Si pierdes acceso a tu autenticador, solicita recuperación al administrador mediante la verificación de identidad establecida.</p> : status && <>
      <p>Antes de activarla, configura una copia segura de tu autenticador y confirma con el administrador el procedimiento de recuperación.</p>
      {!status.available ? <p>La activación de doble factor aún no está disponible en este entorno.</p> : !status.emailVerified ? <>
        <p>Primero verifica tu correo electrónico.</p>
        <Button disabled={busy} onClick={() => run(async () => { if (user) { await sendEmailVerification(user); toast.success("Revisa tu correo para verificar tu cuenta."); } })}>Enviar verificación</Button>
        <Button variant="outline" disabled={busy} onClick={() => run(async () => { if (user) { await reload(user); setStatus(await apiPost<Status>("/api/security/status", {})); } })}>Ya verifiqué mi correo</Button>
      </> : !secret ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => {
        if (!user?.email) return;
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
        setSecret(await TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession()));
      }); }}>
        <label htmlFor="security-password">Confirma tu contraseña actual</label>
        <Input id="security-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        <Button disabled={busy} type="submit">Preparar autenticador</Button>
      </form> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => {
        if (!user) return;
        await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code), "Autenticador Finova");
        await user.getIdToken(true); setSecret(null); setCode(""); setStatus(await apiPost<Status>("/api/security/status", {})); toast.success("Verificación en dos pasos activada.");
      }); }}>
        <p>Añade una cuenta en tu aplicación autenticadora: tipo basado en tiempo, seis dígitos. Introduce esta clave manualmente y luego el código que genere. No compartas esta clave.</p>
        <code className="block break-all rounded border p-3 select-all">{secret.secretKey}</code>
        <label htmlFor="security-code">Código del autenticador</label>
        <Input id="security-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value)} />
        <Button type="submit" disabled={busy}>Confirmar activación</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => { setSecret(null); setCode(""); }}>Cancelar</Button>
      </form>}
    </>}
  </main>;
}
