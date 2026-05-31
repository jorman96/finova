"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function NotificarMorososButton() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleNotificar = async () => {
    if (!userData?.empresaId) return;
    
    setLoading(true);
    let enviados = 0;
    
    try {
      // Buscar cuotas vencidas
      const q = query(
        collection(db, "cuotas"),
        where("empresaId", "==", userData.empresaId),
        where("estado", "==", "vencida")
      );
      
      const cuotasSnap = await getDocs(q);
      
      if (cuotasSnap.empty) {
        toast.info("No hay cuotas vencidas actualmente.");
        setLoading(false);
        return;
      }

      // Procesar cada cuota vencida
      const promesas = cuotasSnap.docs.map(async (doc) => {
        const cuota = doc.data();
        
        // Evitar spam: Solo notificar si no se ha notificado en las últimas 24h
        if (cuota.ultimoRecordatorio) {
          const ultimaFecha = new Date(cuota.ultimoRecordatorio);
          const ahora = new Date();
          const horasDiferencia = Math.abs(ahora.getTime() - ultimaFecha.getTime()) / 36e5;
          if (horasDiferencia < 24) return; // Saltarse
        }

        try {
          const res = await fetch("/api/email/cobranza", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              empresaId: userData.empresaId,
              clienteId: cuota.clienteId,
              prestamoId: cuota.prestamoId,
              cuotaId: doc.id
            })
          });
          
          if (res.ok) enviados++;
        } catch (error) {
          console.error("Error enviando email a", cuota.clienteId, error);
        }
      });

      await Promise.all(promesas);

      if (enviados > 0) {
        toast.success(`Se enviaron ${enviados} recordatorios de cobranza por correo.`);
      } else {
        toast.info("No se enviaron recordatorios nuevos (posiblemente ya se enviaron hoy).");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar la cobranza masiva.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="destructive" onClick={handleNotificar} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
      Notificar Morosos
    </Button>
  );
}
