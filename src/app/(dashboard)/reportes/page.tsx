"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";

export default function ReportesPage() {
  const { userData } = useAuth();
  const [loadingIds, setLoadingIds] = useState<Record<number, boolean>>({});

  const downloadCSV = (filename: string, csvContent: string) => {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async (id: number) => {
    if (!userData?.empresaId) return;
    
    setLoadingIds(prev => ({ ...prev, [id]: true }));
    try {
      if (id === 1 || id === 2) {
        // Préstamos Activos (1) o Finalizados (2)
        const estado = id === 1 ? 'activo' : 'completado';
        const q = query(
          collection(db, "prestamos"), 
          where("empresaId", "==", userData.empresaId),
          where("estado", "==", estado)
        );
        const snap = await getDocs(q);
        
        let csv = "ID;Cliente;Monto Prestado;Tasa (%);Cuotas;Frecuencia;Saldo Restante\n";
        snap.forEach(doc => {
          const d = doc.data();
          const nombre = d.clienteNombre || 'Desconocido';
          csv += `${doc.id};"${nombre}";${d.monto};${d.tasaInteres};${d.numeroCuotas};${d.frecuenciaPago};${d.saldoRestante}\n`;
        });
        
        downloadCSV(`prestamos_${estado}_${new Date().getTime()}.csv`, csv);
        toast.success(`Reporte de préstamos generado`);
      } 
      else if (id === 3) {
        // Cobros
        const q = query(
          collection(db, "pagos"), 
          where("empresaId", "==", userData.empresaId),
          orderBy("fecha", "desc")
        );
        const snap = await getDocs(q);
        
        let csv = "ID Pago;ID Prestamo;Cliente;Monto;Metodo;Fecha;Observacion\n";
        snap.forEach(doc => {
          const d = doc.data();
          const fecha = d.fecha?.toDate ? d.fecha.toDate().toLocaleDateString() : 'N/A';
          const nombre = d.clienteNombre || d.clienteId || 'Desconocido';
          csv += `${doc.id};${d.prestamoId};"${nombre}";${d.monto};${d.metodo};${fecha};"${d.observaciones || ''}"\n`;
        });
        
        downloadCSV(`historial_cobros_${new Date().getTime()}.csv`, csv);
        toast.success(`Reporte de cobros generado`);
      }
      else if (id === 4) {
        // Mora
        const q = query(
          collection(db, "cuotas"), 
          where("empresaId", "==", userData.empresaId),
          where("estado", "in", ["vencida", "parcial"])
        );
        const snap = await getDocs(q);
        
        let csv = "ID Cuota;ID Prestamo;Cliente ID;Numero Cuota;Fecha Vencimiento;Total Cuota;Monto Pagado;Saldo Pendiente\n";
        snap.forEach(doc => {
          const d = doc.data();
          // Solo vencidas pasadas de fecha
          const todayStr = new Date().toISOString().split("T")[0];
          if (d.fechaVencimiento < todayStr) {
            csv += `${doc.id};${d.prestamoId};${d.clienteId};${d.numeroCuota};${d.fechaVencimiento};${d.totalCuota};${d.montoPagado};${d.totalCuota - d.montoPagado}\n`;
          }
        });
        
        downloadCSV(`reporte_mora_${new Date().getTime()}.csv`, csv);
        toast.success(`Reporte de mora generado`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el reporte");
    } finally {
      setLoadingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const reportesDisponibles = [
    { id: 1, titulo: "Préstamos Activos", desc: "Listado completo de préstamos vigentes con sus saldos." },
    { id: 2, titulo: "Préstamos Finalizados", desc: "Historial de créditos cancelados exitosamente." },
    { id: 3, titulo: "Cobros Realizados", desc: "Detalle de todos los pagos ingresados históricamente." },
    { id: 4, titulo: "Reporte de Mora", desc: "Consolidado de cuotas atrasadas y montos vencidos." }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reportes</h2>
        <p className="text-muted-foreground">Genera y exporta informes financieros y operativos de la cartera en formato CSV para Excel.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportesDisponibles.map((rep) => (
          <Card key={rep.id}>
            <CardHeader>
              <CardTitle className="text-lg">{rep.titulo}</CardTitle>
              <CardDescription>{rep.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleExport(rep.id)}
                disabled={loadingIds[rep.id]}
              >
                {loadingIds[rep.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {loadingIds[rep.id] ? "Generando..." : "Exportar Excel (CSV)"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
