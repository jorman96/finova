"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export function PortalLoginForm({ empresaId }: { empresaId: string }) {
  const [cedula, setCedula] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedula.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId, cedula: cedula.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al ingresar");
      }

      router.push(`/portal/${empresaId}/cliente/${data.clienteId}`);
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-6">
      <div className="space-y-2 text-left">
        <Label htmlFor="cedula">Cédula de Identidad</Label>
        <Input 
          id="cedula"
          type="text" 
          placeholder="Ej: 1712345678" 
          value={cedula}
          onChange={e => setCedula(e.target.value)}
          required
          className="h-12 text-lg text-center tracking-widest"
          autoComplete="off"
        />
      </div>
      
      <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Consultar Estado"}
        {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
      </Button>
    </form>
  );
}
