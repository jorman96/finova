"use client";

import { useState, useEffect } from "react";
import { FirebaseError } from "firebase/app";
import { getMultiFactorResolver, TotpMultiFactorGenerator, type MultiFactorError, type MultiFactorResolver, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function LoginPage() {
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false), [resetEmail, setResetEmail] = useState('');
  const [resetBusy, setResetBusy] = useState(false), [resetSent, setResetSent] = useState(false), [resetError, setResetError] = useState('');
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (user) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (resolver) {
        const factor = resolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (!factor) throw new Error("No hay un autenticador compatible.");
        await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factor.uid, otp));
      } else await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof FirebaseError && err.code === "auth/multi-factor-auth-required") {
        setResolver(getMultiFactorResolver(auth, err as MultiFactorError)); setPassword("");
      } else setError(resolver ? "Código inválido o vencido. Revisa el autenticador o vuelve a iniciar sesión." : "No se pudo iniciar sesión. Revisa tus credenciales.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 bg-muted/40 p-4 py-10">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">Finova</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder a tu cuenta
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {resolver && <div className="space-y-2"><Label htmlFor="login-otp">Código del autenticador</Label><Input id="login-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e => setOtp(e.target.value)} /><Button type="button" variant="outline" onClick={() => { setResolver(null); setOtp(""); setPassword(""); }}>Volver al inicio de sesión</Button></div>}
            {error && (
              <div role="alert" className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={!resolver}
                disabled={!!resolver}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <button type="button" disabled={!!resolver || isLoading} onClick={() => { setResetEmail(email); setResetSent(false); setResetError(''); setResetOpen(true); }} className="min-h-11 text-sm text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative"><Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!resolver}
                disabled={!!resolver}
              /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-9" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Sesión
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={resetOpen} onOpenChange={open => { if (!resetBusy) setResetOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Recuperar acceso</DialogTitle><DialogDescription>Solicita un enlace de recuperación al correo de tu cuenta. No cambia tu contraseña hasta que completes el enlace.</DialogDescription></DialogHeader>
        {resetSent ? <div className="space-y-4"><p role="status">Si existe una cuenta con ese correo, recibirás las instrucciones. Revisa también correo no deseado. Si no llegan, contacta al administrador.</p><Button onClick={() => setResetOpen(false)}>Volver al inicio de sesión</Button></div> : <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setResetBusy(true); setResetError(''); try { await sendPasswordResetEmail(auth, resetEmail.trim()); setResetSent(true); } catch (err) { if (err instanceof FirebaseError && err.code === 'auth/user-not-found') setResetSent(true); else setResetError('No se pudo solicitar el enlace. Revisa el correo e inténtalo nuevamente.'); } finally { setResetBusy(false); } }}><Label htmlFor="reset-email">Correo de la cuenta</Label><Input id="reset-email" type="email" autoComplete="email" required value={resetEmail} onChange={e => setResetEmail(e.target.value)} />{resetError && <p role="alert" className="text-destructive">{resetError}</p>}<Button type="submit" disabled={resetBusy}>{resetBusy ? 'Solicitando…' : 'Solicitar enlace'}</Button></form>}
      </DialogContent></Dialog>
      <div className="text-center w-full">
        <p className="text-sm text-muted-foreground/60 font-medium tracking-wide">
          Developed by Jorman Castro © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
