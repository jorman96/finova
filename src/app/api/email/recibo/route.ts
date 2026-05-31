import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { empresaId, clienteId, clienteNombre, monto, fecha, metodo, reciboId } = await request.json();

    if (!empresaId || !clienteId || !monto) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'tu_resend_api_key') {
      console.warn("RESEND_API_KEY no configurada. Simulando envío de correo.");
      return NextResponse.json({ success: true, simulated: true });
    }

    // Obtener datos de la empresa para personalizar el correo
    const empresaSnap = await adminDb.collection("empresas").doc(empresaId).get();
    const empresa = empresaSnap.data() || { nombre: "Financiera", moneda: "USD" };

    // Obtener correo del cliente
    const clienteSnap = await adminDb.collection("clientes").doc(clienteId).get();
    const cliente = clienteSnap.data();
    
    if (!cliente || !cliente.correo) {
      return NextResponse.json({ error: "El cliente no tiene correo electrónico configurado" }, { status: 400 });
    }
    const clienteCorreo = cliente.correo;

    const formatMoney = (amount: number) => {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: empresa.moneda || "USD" }).format(amount);
    };

    const logoHtml = empresa.logoUrl 
      ? `<img src="${empresa.logoUrl}" alt="${empresa.nombre}" style="max-height: 60px; margin-bottom: 20px;" />` 
      : `<h2 style="color: #0f172a;">${empresa.nombre}</h2>`;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://finova.com'}/portal/${empresaId}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-w-xl; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-bottom: 1px solid #e2e8f0;">
          ${logoHtml}
          <h1 style="color: #10b981; margin: 0;">¡Pago Recibido!</h1>
          <p style="color: #64748b; margin-top: 10px;">Gracias por tu pago, ${clienteNombre}.</p>
        </div>
        
        <div style="padding: 30px;">
          <p>Hemos procesado tu pago exitosamente. Aquí tienes los detalles de la transacción:</p>
          
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Recibo N°:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right;">${reciboId.slice(-6).toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Fecha:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right;">${new Date(fecha).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Método:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right;">${metodo.toUpperCase()}</td>
              </tr>
              <tr style="border-top: 1px solid #cbd5e1;">
                <td style="padding: 12px 0 0 0; color: #0f172a; font-weight: bold;">Monto Pagado:</td>
                <td style="padding: 12px 0 0 0; font-weight: bold; text-align: right; color: #10b981; font-size: 18px;">
                  ${formatMoney(monto)}
                </td>
              </tr>
            </table>
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="${portalUrl}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver Estado de Cuenta</a>
          </p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          <p>Este es un correo automático generado por ${empresa.nombre}. Por favor no respondas a este mensaje.</p>
        </div>
      </div>
    `;

    // Para evitar errores en desarrollo si no tienes dominio verificado, se usa 'onboarding@resend.dev' en From por defecto.
    // Idealmente debes configurar un email real y verificado en tu cuenta de Resend.
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'notificaciones@finova.com'; 

    const { data, error } = await resend.emails.send({
      from: `${empresa.nombre} <onboarding@resend.dev>`, // Usando dominio temporal de Resend
      to: [clienteCorreo],
      subject: `Comprobante de Pago - ${empresa.nombre}`,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Email route error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
