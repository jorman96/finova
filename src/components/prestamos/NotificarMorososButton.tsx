"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost } from "@/lib/api-client";
import { businessDate,isOverdue } from "@/lib/business-date";
import { db } from "@/lib/firebase";
import { collection,getDocs,query,where } from "firebase/firestore";
import { Loader2,Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
        where("fechaVencimiento", "<", businessDate())
      );
      
      const cuotasSnap = await getDocs(q);
      
      if (cuotasSnap.empty) {
        toast.info("No hay cuotas vencidas actualmente.");
        setLoading(false);
        return;
      }

      // Procesar cada cuota vencida
      // Sequential requests keep the provider and the rate limiter within their limits.
      for (const doc of cuotasSnap.docs.slice(0, 25)) {
        const cuota = doc.data();
        if (!isOverdue(cuota as { fechaVencimiento: string; totalCuota: number; montoPagado?: number })) continue;
        
        // Evitar spam: Solo notificar si no se ha notificado en las últimas 24h
        if (cuota.ultimoRecordatorio) {
          const ultimaFecha = new Date(cuota.ultimoRecordatorio);
          const ahora = new Date();
          const horasDiferencia = Math.abs(ahora.getTime() - ultimaFecha.getTime()) / 36e5;
          if (horasDiferencia < 24) continue; // Saltarse
        }

        try {
          const result = await apiPost<{ success: boolean; alreadySent?: boolean }>("/api/email/cobranza", { cuotaId: doc.id });
          if (!result.alreadySent) enviados++;
        } catch (error) {
          console.error("Error enviando email a", cuota.clienteId, error);
        }
      }

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
      Notificar vencidos (hasta 25)
    </Button>
  );
}
