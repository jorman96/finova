"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, FileText, FileSpreadsheet, Loader2, Calendar } from "lucide-react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { startOfMonth, endOfMonth, format } from "date-fns";

export default function ReportesPage() {
  const { userData } = useAuth();
  
  // Opciones de configuración
  const [fechaInicio, setFechaInicio] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [fechaFin, setFechaFin] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  
  const [incluirResumen, setIncluirResumen] = useState(true);
  const [incluirPrestamos, setIncluirPrestamos] = useState(true);
  const [incluirCobros, setIncluirCobros] = useState(true);
  const [incluirMora, setIncluirMora] = useState(true);

  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Recolectar datos
  const fetchReportData = async () => {
    if (!userData?.empresaId) throw new Error("No empresa ID");
    
    const data: any = {};
    
    // Diccionario de clientes para inyectar nombres
    const qClientes = query(collection(db, "clientes"), where("empresaId", "==", userData.empresaId));
    const snapClientes = await getDocs(qClientes);
    const clientesMap = new Map();
    snapClientes.docs.forEach(doc => {
      const c = doc.data();
      clientesMap.set(doc.id, `${c.nombres} ${c.apellidos}`);
    });
    
    // 1. Cobros (Pagos en el rango de fechas)
    if (incluirCobros || incluirResumen) {
      const qPagos = query(
        collection(db, "pagos"),
        where("empresaId", "==", userData.empresaId)
      );
      const snapPagos = await getDocs(qPagos);
      const todosPagos = snapPagos.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Filtrar en memoria para evitar errores de índices compuestos en Firebase
      data.pagos = todosPagos
        .filter(p => p.fechaStr >= fechaInicio && p.fechaStr <= fechaFin)
        .sort((a, b) => a.fechaStr.localeCompare(b.fechaStr));
    }

    // 2. Préstamos Otorgados en el rango
    if (incluirPrestamos || incluirResumen) {
      const qPrestamos = query(
        collection(db, "prestamos"),
        where("empresaId", "==", userData.empresaId)
      );
      const snapPrestamos = await getDocs(qPrestamos);
      data.prestamos = snapPrestamos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // 3. Mora actual
    if (incluirMora || incluirResumen) {
      const qMora = query(
        collection(db, "cuotas"),
        where("empresaId", "==", userData.empresaId)
      );
      const snapMora = await getDocs(qMora);
      const todayStr = format(new Date(), "yyyy-MM-dd");
      
      // Filtrar en memoria por estado y fecha de vencimiento
      data.mora = snapMora.docs
        .map(doc => {
          const d = doc.data() as any;
          return { id: doc.id, clienteNombre: clientesMap.get(d.clienteId) || "Desconocido", ...d };
        })
        .filter((d: any) => 
          (d.estado === 'pendiente' || d.estado === 'vencida' || d.estado === 'parcial') && 
          d.fechaVencimiento < todayStr
        );
    }

    return data;
  };

  const generarExcel = async () => {
    try {
      setIsGeneratingExcel(true);
      const data = await fetchReportData();
      const wb = XLSX.utils.book_new();

      // Hoja de Resumen
      if (incluirResumen) {
        const totalCobrado = data.pagos?.reduce((acc: number, p: any) => acc + (p.monto || 0), 0) || 0;
        const totalPrestado = data.prestamos?.reduce((acc: number, p: any) => acc + (p.monto || 0), 0) || 0;
        const totalEnMora = data.mora?.reduce((acc: number, c: any) => acc + (c.totalCuota - c.montoPagado), 0) || 0;

        const resumenData = [
          ["RESUMEN EJECUTIVO"],
          ["Periodo", `${fechaInicio} al ${fechaFin}`],
          [""],
          ["Métrica", "Valor"],
          ["Total Dinero Prestado (Global)", totalPrestado],
          ["Total Ingresos por Cobros (Periodo)", totalCobrado],
          ["Total Cartera en Mora (Al día de hoy)", totalEnMora]
        ];
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen General");
      }

      // Hoja de Préstamos
      if (incluirPrestamos && data.prestamos) {
        const prestamosData = data.prestamos.map((p: any) => ({
          "ID": p.id,
          "Cliente": p.clienteNombre || "N/A",
          "Fecha Otorgamiento": p.fechaDesembolso || "N/A",
          "Estado": p.estado,
          "Monto Original": p.monto,
          "Tasa (%)": p.tasaInteres,
          "Total a Pagar": p.totalPagar,
          "Saldo Restante": p.saldoRestante,
          "Frecuencia": p.frecuenciaPago
        }));
        const wsPrestamos = XLSX.utils.json_to_sheet(prestamosData);
        XLSX.utils.book_append_sheet(wb, wsPrestamos, "Préstamos");
      }

      // Hoja de Cobros
      if (incluirCobros && data.pagos) {
        const cobrosData = data.pagos.map((p: any) => ({
          "ID Pago": p.id,
          "Fecha": p.fechaStr,
          "Cliente": p.clienteNombre || "N/A",
          "Monto": p.monto,
          "Método": p.metodo,
          "Registrado Por": p.usuarioNombre || "Sistema"
        }));
        const wsCobros = XLSX.utils.json_to_sheet(cobrosData);
        XLSX.utils.book_append_sheet(wb, wsCobros, "Cobros del Periodo");
      }

      // Hoja de Mora
      if (incluirMora && data.mora) {
        const moraData = data.mora.map((m: any) => ({
          "Préstamo ID": m.prestamoId,
          "Cliente": m.clienteNombre,
          "Cuota No.": m.numeroCuota,
          "Vencimiento": m.fechaVencimiento,
          "Monto Cuota": m.totalCuota,
          "Monto Pagado": m.montoPagado,
          "Deuda Pendiente": m.totalCuota - m.montoPagado
        }));
        const wsMora = XLSX.utils.json_to_sheet(moraData);
        XLSX.utils.book_append_sheet(wb, wsMora, "Cartera en Mora");
      }

      XLSX.writeFile(wb, `Reporte_Finova_${format(new Date(), "yyyyMMdd")}.xlsx`);
      toast.success("Excel generado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("Error al generar Excel");
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const generarPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const data = await fetchReportData();
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.text("Reporte Consolidado Gerencial", 14, 22);
      
      doc.setFontSize(11);
      doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);
      doc.text(`Periodo Analizado: ${fechaInicio} al ${fechaFin}`, 14, 36);

      let currentY = 45;

      if (incluirResumen) {
        const totalCobrado = data.pagos?.reduce((acc: number, p: any) => acc + (p.monto || 0), 0) || 0;
        const totalPrestado = data.prestamos?.reduce((acc: number, p: any) => acc + (p.monto || 0), 0) || 0;
        const totalEnMora = data.mora?.reduce((acc: number, c: any) => acc + (c.totalCuota - c.montoPagado), 0) || 0;

        doc.setFontSize(14);
        doc.text("Resumen Ejecutivo", 14, currentY);
        currentY += 5;
        
        autoTable(doc, {
          startY: currentY,
          head: [['Métrica', 'Valor']],
          body: [
            ['Total Ingresos por Cobros (En el periodo)', formatMoney(totalCobrado)],
            ['Total Dinero Prestado (Global Activo)', formatMoney(totalPrestado)],
            ['Total Cartera en Mora (Al día de hoy)', formatMoney(totalEnMora)],
          ],
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185] }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      if (incluirCobros && data.pagos?.length > 0) {
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        doc.setFontSize(14);
        doc.text("Historial de Cobros (Ingresos)", 14, currentY);
        currentY += 5;

        const tableBody = data.pagos.map((p: any) => [
          p.fechaStr,
          p.clienteNombre || 'N/A',
          p.metodo,
          formatMoney(p.monto)
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Fecha', 'Cliente', 'Método', 'Monto']],
          body: tableBody,
          theme: 'striped',
          headStyles: { fillColor: [46, 204, 113] }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      if (incluirMora && data.mora?.length > 0) {
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        doc.setFontSize(14);
        doc.text("Cartera Vencida (Mora)", 14, currentY);
        currentY += 5;

        const tableBody = data.mora.map((m: any) => [
          m.fechaVencimiento,
          m.clienteNombre,
          m.numeroCuota,
          formatMoney(m.totalCuota - m.montoPagado)
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Vencimiento', 'Cliente', 'Cuota', 'Deuda']],
          body: tableBody,
          theme: 'striped',
          headStyles: { fillColor: [231, 76, 60] }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      doc.save(`Reporte_Finova_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("PDF generado correctamente");

    } catch (e) {
      console.error(e);
      toast.error("Error al generar PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reporte Consolidado Maestro</h2>
        <p className="text-muted-foreground">Configura y genera un reporte gerencial con toda la información clave de tu financiera en un solo documento.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <Card className="md:col-span-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/> Configuración del Reporte</CardTitle>
            <CardDescription>Selecciona qué información deseas incluir en el documento final.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Rango de Fechas */}
            <div className="space-y-3">
              <Label className="text-base">Rango de Fechas (Para análisis de cobros e ingresos)</Label>
              <div className="flex gap-4 items-center">
                <div className="grid gap-1.5 flex-1">
                  <Label htmlFor="fechaInicio" className="text-xs text-muted-foreground">Fecha Inicio</Label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="fechaInicio" type="date" className="pl-9" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
                  </div>
                </div>
                <span className="text-muted-foreground pt-4">-</span>
                <div className="grid gap-1.5 flex-1">
                  <Label htmlFor="fechaFin" className="text-xs text-muted-foreground">Fecha Fin</Label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="fechaFin" type="date" className="pl-9" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <Label className="text-base mb-4 block">Módulos a Incluir</Label>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-lg border">
                  <Checkbox id="resumen" checked={incluirResumen} onCheckedChange={(c) => setIncluirResumen(c as boolean)} />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="resumen" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Resumen Ejecutivo</label>
                    <p className="text-xs text-muted-foreground">Totales de ingresos, mora y cartera activa.</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-lg border">
                  <Checkbox id="cobros" checked={incluirCobros} onCheckedChange={(c) => setIncluirCobros(c as boolean)} />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="cobros" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Historial de Cobros</label>
                    <p className="text-xs text-muted-foreground">Todos los pagos recibidos en el rango de fechas.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-lg border">
                  <Checkbox id="mora" checked={incluirMora} onCheckedChange={(c) => setIncluirMora(c as boolean)} />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="mora" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Cartera en Mora</label>
                    <p className="text-xs text-muted-foreground">Listado de cuotas vencidas al día de hoy.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-lg border">
                  <Checkbox id="prestamos" checked={incluirPrestamos} onCheckedChange={(c) => setIncluirPrestamos(c as boolean)} />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="prestamos" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Listado de Préstamos</label>
                    <p className="text-xs text-muted-foreground">Todos los créditos activos y su saldo restante.</p>
                  </div>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        <div className="md:col-span-4 flex flex-col gap-4">
          <Card className="flex-1 bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Generar Archivo</CardTitle>
              <CardDescription>Descarga el consolidado en tu formato preferido.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full h-14 text-base" 
                onClick={generarPDF}
                disabled={isGeneratingPDF || isGeneratingExcel || (!incluirResumen && !incluirCobros && !incluirMora && !incluirPrestamos)}
              >
                {isGeneratingPDF ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileText className="mr-2 h-5 w-5" />}
                {isGeneratingPDF ? "Armando PDF..." : "Exportar en PDF"}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">O alternativamente</span></div>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-14 text-base border-emerald-600/30 hover:bg-emerald-600/10 hover:text-emerald-700 dark:hover:text-emerald-400" 
                onClick={generarExcel}
                disabled={isGeneratingPDF || isGeneratingExcel || (!incluirResumen && !incluirCobros && !incluirMora && !incluirPrestamos)}
              >
                {isGeneratingExcel ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileSpreadsheet className="mr-2 h-5 w-5" />}
                {isGeneratingExcel ? "Armando Excel..." : "Exportar Multi-Hoja (Excel)"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
