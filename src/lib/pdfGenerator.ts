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

  let startY = 95;
  if (pago.cuotasAplicadas && pago.cuotasAplicadas.length > 0) {
    autoTable(doc, {
      startY: startY,
      head: [["Cuota N°", "Valor Inicial", "Intereses", "Abono", "Saldo Restante"]],
      body: pago.cuotasAplicadas.map((c: any) => [
        `${c.numeroCuota}`,
        formatMoney(c.valorCuota, empresa?.moneda),
        formatMoney(c.interes, empresa?.moneda),
        formatMoney(c.montoAbonado, empresa?.moneda),
        formatMoney(c.saldoRestante, empresa?.moneda)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
      styles: { fontSize: 9, cellPadding: 4 },
    });
    startY = (doc as any).lastAutoTable.finalY + 10;
  }

  autoTable(doc, {
    startY: startY,
    head: [["Descripción General", "Detalle"]],
    body: [
      ...(!pago.cuotasAplicadas ? [[`Pago de Cuota N° ${pago.numeroCuota || '-'} del Préstamo`, formatMoney(pago.monto, empresa?.moneda)]] : []),
      ["Método de Pago", pago.metodo?.toUpperCase() || pago.metodoPago?.toUpperCase() || "EFECTIVO"],
      ["Registrado por", pago.registradoPor || pago.registradoPorNombre || "Administración"]
    ],
    theme: pago.cuotasAplicadas ? 'plain' : 'grid',
    headStyles: { fillColor: pago.cuotasAplicadas ? [240, 240, 240] : [66, 66, 66], textColor: pago.cuotasAplicadas ? [40, 40, 40] : [255, 255, 255] },
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
  const pageHeight = doc.internal.pageSize.height;
  
  // Colores Premium (Slate 900 y Slate 500)
  const primaryColor: [number, number, number] = [15, 23, 42]; 
  const secondaryColor: [number, number, number] = [100, 116, 139];

  if (empresa?.logoUrl) {
    try {
      const base64Logo = await getBase64ImageFromUrl(empresa.logoUrl);
      doc.addImage(base64Logo, "PNG", 14, 10, 40, 40, undefined, "FAST");
    } catch (e) {
      console.warn("No se pudo cargar el logo en el PDF", e);
    }
  }

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.text(empresa?.nombre || "Finova Capital", empresa?.logoUrl ? 60 : 14, 24);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...secondaryColor);
  doc.text("TABLA DE AMORTIZACIÓN Y CRÉDITO", empresa?.logoUrl ? 60 : 14, 32);
  doc.text(`Fecha de Emisión: ${format(new Date(), "dd MMM yyyy", { locale: es })}`, pageWidth - 14, 25, { align: "right" });

  // Línea separadora principal
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(14, 40, pageWidth - 14, 40); 

  // Caja de Resumen del Préstamo (Fondo claro)
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(14, 45, pageWidth - 28, 30, 2, 2, "F");
  
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  
  // Columna Izquierda (Cliente)
  doc.setFont("helvetica", "bold");
  doc.text("Información del Cliente", 18, 52);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...secondaryColor);
  doc.text(`Nombre: ${cliente.nombres} ${cliente.apellidos}`, 18, 58);
  doc.text(`ID/Cédula: ${cliente.cedula}`, 18, 64);
  doc.text(`Teléfono: ${cliente.telefonoPrincipal}`, 18, 70);
  
  // Columna Derecha (Crédito)
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("Detalles del Crédito", pageWidth / 2 + 10, 52);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...secondaryColor);
  doc.text(`Monto Aprobado: ${formatMoney(prestamo.montoOriginal, empresa?.moneda)}`, pageWidth / 2 + 10, 58);
  doc.text(`Tasa: ${prestamo.tasaInteres}% ${prestamo.tipoInteres} | Plazo: ${prestamo.plazoMeses} Cuotas`, pageWidth / 2 + 10, 64);
  doc.text(`Total a Devolver: ${formatMoney(prestamo.totalDevolver, empresa?.moneda)}`, pageWidth / 2 + 10, 70);

  // Tabla de Amortización
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text("Cronograma de Pagos", 14, 85);

  const tablaBody = cuotas.map(c => [
    c.numero,
    format(new Date(c.fechaVencimiento), "dd/MM/yyyy"),
    formatMoney(c.monto, empresa?.moneda),
    formatMoney(c.capital || 0, empresa?.moneda),
    formatMoney(c.interes || 0, empresa?.moneda),
    formatMoney(c.saldoPendienteAntes || 0, empresa?.moneda)
  ]);

  autoTable(doc, {
    startY: 90,
    head: [["N°", "Vencimiento", "Cuota Total", "Abono Capital", "Interés", "Saldo Restante"]],
    body: tablaBody,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] }, // Slate 50
    styles: { fontSize: 9, cellPadding: 4, textColor: [51, 65, 85] }, // Slate 700
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold', textColor: primaryColor }
    },
    didDrawPage: function (data) {
      // Paginación
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(
        `Página ${data.pageNumber} • Software by Jorman Castro © ${new Date().getFullYear()}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }
  });

  // Pie de página (Firmas)
  const finalY = (doc as any).lastAutoTable.finalY || 200;
  
  if (finalY < pageHeight - 50) {
    doc.setDrawColor(...secondaryColor);
    doc.setLineWidth(0.5);
    
    doc.line(30, finalY + 40, 80, finalY + 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Firma del Cliente", 55, finalY + 45, { align: "center" });

    doc.line(pageWidth - 80, finalY + 40, pageWidth - 30, finalY + 40);
    doc.text(`Firma por ${empresa?.nombre || "Financiera"}`, pageWidth - 55, finalY + 45, { align: "center" });
  }

  doc.save(`Amortizacion_${cliente.nombres}_${prestamo.id.substring(0,6)}.pdf`);
};
