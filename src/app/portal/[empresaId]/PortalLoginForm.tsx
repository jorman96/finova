"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
export function PortalLoginForm({ empresaId }: { empresaId: string }) {
  const [cedula, setCedula] = useState(""), [challenge, setChallenge] = useState(""), [code, setCode] = useState(""), [loading, setLoading] = useState(false);
  const router = useRouter();
  return <form className="space-y-5" onSubmit={async e => {
    e.preventDefault(); setLoading(true);
    try {
      const response = await fetch("/api/portal/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(challenge ? { action: "verify", challenge, code } : { action: "request", empresaId, cedula }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (challenge) { router.replace(`/portal/${result.empresaId}/cliente/${result.clienteId}`); router.refresh(); }
      else { setChallenge(result.challenge); toast.info(result.message); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo acceder."); }
    finally { setLoading(false); }
  }}>
    {challenge ? <><p className="text-sm text-muted-foreground">Introduce el código enviado al correo registrado. Vence en 10 minutos.</p><Label htmlFor="portal-code">Código de acceso</Label><Input id="portal-code" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></> : <><Label htmlFor="portal-cedula">Cédula de identidad</Label><Input id="portal-cedula" value={cedula} onChange={e => setCedula(e.target.value)} minLength={5} maxLength={30} required /><p className="text-sm text-muted-foreground">Enviaremos un código al correo que registraste con tu financiera.</p></>}
    <Button className="w-full" disabled={loading}>{loading ? "Procesando…" : challenge ? "Verificar e ingresar" : "Solicitar código"}</Button>
    {challenge && <Button type="button" variant="outline" disabled={loading} onClick={() => { setChallenge(""); setCode(""); }}>Solicitar otro código</Button>}
  </form>;
}
