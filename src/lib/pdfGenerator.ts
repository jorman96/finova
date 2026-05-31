import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const formatMoney = (amount: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

const getBase64ImageFromUrl = async (imageUrl: string) => {
  const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generarReciboPago = async (
  pago: any,
  prestamo: any,
  cliente: any,
  empresa: any
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  if (empresa?.logoUrl) {
    try {
      const base64Logo = await getBase64ImageFromUrl(empresa.logoUrl);
      doc.addImage(base64Logo, "PNG", 14, 10, 40, 40, undefined, "FAST");
    } catch (e) {
      console.warn("No se pudo cargar el logo en el PDF", e);
    }
  }

  // Encabezado - Datos de la empresa
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text(empresa?.nombre || "Finova Capital", empresa?.logoUrl ? 60 : 14, 25);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("RECIBO DE PAGO", empresa?.logoUrl ? 60 : 14, 32);
  doc.text(`Fecha: ${format(new Date(pago.fecha), "dd MMM yyyy, HH:mm", { locale: es })}`, pageWidth - 14, 25, { align: "right" });
  doc.text(`Recibo N°: ${pago.id.substring(0, 8).toUpperCase()}`, pageWidth - 14, 32, { align: "right" });

  doc.line(14, 45, pageWidth - 14, 45); // Línea separadora

  // Datos del Cliente
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Información del Cliente:", 14, 55);
  
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Nombre: ${cliente.nombres} ${cliente.apellidos}`, 14, 62);
  doc.text(`Identificación: ${cliente.cedula}`, 14, 68);
  doc.text(`Teléfono: ${cliente.telefonoPrincipal}`, 14, 74);

  // Detalles del Pago
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Detalles de la Transacción:", 14, 90);

  // Tabla
  autoTable(doc, {
    startY: 95,
    head: [["Descripción", "Monto"]],
    body: [
      [`Pago de Cuota N° ${pago.numeroCuota || '-'} del Préstamo`, formatMoney(pago.monto, empresa?.moneda)],
      ["Método de Pago", pago.metodoPago?.toUpperCase() || "EFECTIVO"],
      ["Registrado por", pago.registradoPorNombre || "Administración"]
    ],
    theme: 'grid',
    headStyles: { fillColor: [66, 66, 66] },
    styles: { fontSize: 10, cellPadding: 5 },
  });

  // Total
  const finalY = (doc as any).lastAutoTable.finalY || 130;
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total Pagado: ${formatMoney(pago.monto, empresa?.moneda)}`, pageWidth - 14, finalY + 15, { align: "right" });

  // Pie de página
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("Este documento es un comprobante válido de su transacción.", pageWidth / 2, 280, { align: "center" });
  doc.text("Generado por el sistema de gestión financiera.", pageWidth / 2, 285, { align: "center" });

  // Guardar PDF
  doc.save(`Recibo_${cliente.nombres}_${pago.id.substring(0, 6)}.pdf`);
};

export const generarContratoPrestamo = async (
  prestamo: any,
  cliente: any,
  empresa: any,
  cuotas: any[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  if (empresa?.logoUrl) {
    try {
      const base64Logo = await getBase64ImageFromUrl(empresa.logoUrl);
      doc.addImage(base64Logo, "PNG", 14, 10, 40, 40, undefined, "FAST");
    } catch (e) {
      console.warn("No se pudo cargar el logo en el PDF", e);
    }
  }

  // Encabezado
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text(empresa?.nombre || "Finova Capital", empresa?.logoUrl ? 60 : 14, 25);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("PLAN DE AMORTIZACIÓN Y CRÉDITO", empresa?.logoUrl ? 60 : 14, 32);
  doc.text(`Fecha: ${format(new Date(), "dd MMM yyyy", { locale: es })}`, pageWidth - 14, 25, { align: "right" });

  doc.line(14, 45, pageWidth - 14, 45); 

  // Datos
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  
  // Columna Izquierda
  doc.text(`Cliente: ${cliente.nombres} ${cliente.apellidos}`, 14, 55);
  doc.text(`Identificación: ${cliente.cedula}`, 14, 62);
  doc.text(`Monto Aprobado: ${formatMoney(prestamo.montoOriginal, empresa?.moneda)}`, 14, 69);
  
  // Columna Derecha
  doc.text(`Tasa de Interés: ${prestamo.tasaInteres}% Mensual`, pageWidth / 2, 55);
  doc.text(`Plazo: ${prestamo.plazoMeses} Cuotas`, pageWidth / 2, 62);
  doc.text(`Total a Pagar: ${formatMoney(prestamo.totalDevolver, empresa?.moneda)}`, pageWidth / 2, 69);

  // Tabla de Amortización
  doc.text("Tabla de Pagos Programados:", 14, 85);

  const tablaBody = cuotas.map(c => [
    c.numero,
    format(new Date(c.fechaVencimiento), "dd/MM/yyyy"),
    formatMoney(c.monto, empresa?.moneda),
    formatMoney(c.saldoPendienteAntes || 0, empresa?.moneda)
  ]);

  autoTable(doc, {
    startY: 90,
    head: [["N°", "Vencimiento", "Monto Cuota", "Saldo Restante"]],
    body: tablaBody,
    theme: 'striped',
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 9 },
  });

  // Pie de página (Firmas)
  const finalY = (doc as any).lastAutoTable.finalY || 200;
  
  if (finalY < 240) {
    doc.line(30, finalY + 40, 80, finalY + 40);
    doc.text("Firma del Cliente", 55, finalY + 45, { align: "center" });

    doc.line(pageWidth - 80, finalY + 40, pageWidth - 30, finalY + 40);
    doc.text(`Firma por ${empresa?.nombre || "Empresa"}`, pageWidth - 55, finalY + 45, { align: "center" });
  }

  doc.save(`Credito_${cliente.nombres}_${prestamo.id.substring(0,6)}.pdf`);
};
