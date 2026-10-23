"use client";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";
import { useState } from "react";
import { toast } from "sonner";
export function ResetValoresDialog() {
  const [loading, setLoading] = useState(false);
  return <div className="space-y-2">
    <p className="text-sm text-muted-foreground">El historial financiero se conserva. Usa anulaciones con motivo para corregir operaciones. Para pruebas, utiliza un proyecto Firebase separado. La descarga incluye registros de la empresa; los usuarios y los archivos adjuntos necesitan un respaldo separado.</p>
    <Button variant="outline" disabled={loading} onClick={async () => {
      setLoading(true);
      try {
        const data = await apiPost<object>("/api/admin/backup", {});
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "finova-respaldo-" + new Date().toISOString().slice(0,10) + ".json"; link.click(); URL.revokeObjectURL(url);
        toast.success("Respaldo exportado. Guárdalo en una ubicación protegida.");
      } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo exportar"); }
      finally { setLoading(false); }
    }}>{loading ? "Exportando…" : "Exportar respaldo de la empresa"}</Button>
  </div>;
}
