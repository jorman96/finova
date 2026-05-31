import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { empresaId, clienteId, prestamoId, cuotaId } = await request.json();

    if (!empresaId || !clienteId || !prestamoId || !cuotaId) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'tu_resend_api_key') {
      console.warn("RESEND_API_KEY no configurada. Simulando envío de cobranza.");
      return NextResponse.json({ success: true, simulated: true });
    }

    // Obtener datos
    const empresaSnap = await adminDb.collection("empresas").doc(empresaId).get();
    const empresa = empresaSnap.data() || { nombre: "Financiera", moneda: "USD" };

    const clienteSnap = await adminDb.collection("clientes").doc(clienteId).get();
    const cliente = clienteSnap.data();
    if (!cliente || !cliente.correo) {
      return NextResponse.json({ error: "Cliente sin correo configurado" }, { status: 400 });
    }

    const cuotaSnap = await adminDb.collection("cuotas").doc(cuotaId).get();
    const cuota = cuotaSnap.data();
    if (!cuota) return NextResponse.json({ error: "Cuota no encontrada" }, { status: 404 });

    const formatMoney = (amount: number) => {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: empresa.moneda || "USD" }).format(amount);
    };

    const saldoPendiente = cuota.totalCuota - (cuota.montoPagado || 0);
    const esVencida = new Date(cuota.fechaVencimiento) < new Date();
    
    const logoHtml = empresa.logoUrl 
      ? `<img src="${empresa.logoUrl}" alt="${empresa.nombre}" style="max-height: 60px; margin-bottom: 20px;" />` 
      : `<h2 style="color: #0f172a;">${empresa.nombre}</h2>`;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://finova.com'}/portal/${empresaId}`;

    const headerColor = esVencida ? "#ef4444" : "#f59e0b";
    const headerTitle = esVencida ? "Aviso de Cuota Vencida" : "Recordatorio de Próximo Pago";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-w-xl; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-bottom: 1px solid #e2e8f0;">
          ${logoHtml}
          <h1 style="color: ${headerColor}; margin: 0;">${headerTitle}</h1>
          <p style="color: #64748b; margin-top: 10px;">Hola ${cliente.nombres},</p>
        </div>
        
        <div style="padding: 30px;">
          <p>Te escribimos de parte de <strong>${empresa.nombre}</strong> para recordarte el estado de tu financiamiento.</p>
          
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Número de Cuota:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right;">${cuota.numeroCuota}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Fecha de Vencimiento:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right; color: ${headerColor};">${new Date(cuota.fechaVencimiento).toLocaleDateString()}</td>
              </tr>
              <tr style="border-top: 1px solid #cbd5e1;">
                <td style="padding: 12px 0 0 0; color: #0f172a; font-weight: bold;">Monto a Pagar:</td>
                <td style="padding: 12px 0 0 0; font-weight: bold; text-align: right; color: ${headerColor}; font-size: 18px;">
                  ${formatMoney(saldoPendiente)}
                </td>
              </tr>
            </table>
          </div>
          
          <p>Para evitar recargos o afectaciones en tu Score Crediticio, te invitamos a realizar el pago lo antes posible.</p>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="${portalUrl}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver Estado de Cuenta Completo</a>
          </p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          <p>Si ya realizaste tu pago, por favor ignora este mensaje.</p>
        </div>
      </div>
    `;

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'notificaciones@finova.com'; 

    const { data, error } = await resend.emails.send({
      from: `${empresa.nombre} <onboarding@resend.dev>`,
      to: [cliente.correo],
      subject: `${headerTitle} - ${empresa.nombre}`,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Registrar en Firestore que se envió el recordatorio hoy para no enviarlo doble
    await adminDb.collection("cuotas").doc(cuotaId).update({
      ultimoRecordatorio: new Date().toISOString()
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Cobranza email error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
