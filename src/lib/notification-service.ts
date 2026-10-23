import { businessDate,isOverdue } from "./business-date";
import { escapeHtml,sendEmail } from "./email";
import { adminDb } from "./firebase-admin";
import { cents } from "./money";
import { ApiError } from "./server-auth";

export async function sendNotification(empresaId: string, kind: "recibo" | "cobranza", id: string) {
  const company = (await adminDb.collection("empresas").doc(empresaId).get()).data();
  if (company?.estado !== "activa") throw new ApiError(403, "Empresa no activa.");
  const ref = adminDb.collection(kind === "recibo" ? "pagos" : "cuotas").doc(id);
  const record = (await ref.get()).data();
  if (!record || record.empresaId !== empresaId || record.anulado) throw new ApiError(404, "Registro no disponible.");
  const [clientSnap, loanSnap] = await Promise.all([
    adminDb.collection("clientes").doc(record.clienteId).get(),
    adminDb.collection("prestamos").doc(record.prestamoId).get(),
  ]);
  const client = clientSnap.data(), loan = loanSnap.data();
  if (!client || client.empresaId !== empresaId || loan?.empresaId !== empresaId || loan.clienteId !== record.clienteId || loan.estado === "cancelado") throw new ApiError(403, "Relaciones de documentos inválidas.");
  if (!client.correo) throw new ApiError(400, "El cliente no tiene correo registrado.");
  const today = businessDate(new Date(), company.zonaHoraria);
  if (kind === "cobranza" && !isOverdue(record as { fechaVencimiento: string; totalCuota: number; montoPagado?: number }, today)) throw new ApiError(409, "La cuota no está vencida o ya fue pagada.");
  const jobKey = `${kind}_${id}_${kind === "recibo" ? "original" : today}`;
  const job = adminDb.collection("email_jobs").doc(jobKey);
  const claimed = await adminDb.runTransaction(async tx => {
    const current = (await tx.get(job)).data();
    if (current?.status === "sent") return false;
    if (current?.leaseUntil > Date.now()) throw new ApiError(409, "El correo se está procesando.");
    tx.set(job, { empresaId, kind, origenId: id, status: "processing", leaseUntil: Date.now() + 60_000, attempts: (current?.attempts || 0) + 1, updatedAt: new Date() }, { merge: true });
    return true;
  });
  if (!claimed) return { success: true, alreadySent: true };
  try {
    const amount = kind === "recibo" ? record.monto : (cents(record.totalCuota) - cents(record.montoPagado || 0)) / 100;
    const formatted = new Intl.NumberFormat("es-EC", { style: "currency", currency: company.moneda || "USD" }).format(amount);
    const subject = `${kind === "recibo" ? "Comprobante de pago" : "Recordatorio de cuota vencida"} · ${String(company.nombre).replace(/[\r\n]/g, " ")}`;
    const html = `<html lang="es"><body><h1>${kind === "recibo" ? "Pago recibido" : "Cuota vencida"}</h1><p>Hola ${escapeHtml(client.nombres)}.</p><p>${escapeHtml(company.nombre)}</p><p>${kind === "recibo" ? "Monto registrado" : "Saldo pendiente"}: <strong>${escapeHtml(formatted)}</strong></p><p>Referencia: ${escapeHtml(id)}</p><p>${kind === "recibo" ? "Método: " + escapeHtml(record.metodo) : "Vencimiento: " + escapeHtml(record.fechaVencimiento)}</p><p>Consulta tu portal habitual para revisar el detalle. Si tienes dudas, comunícate con tu financiera.</p></body></html>`;
    await sendEmail(client.correo, subject, html, jobKey);
    await job.update({ status: "sent", leaseUntil: 0, sentAt: new Date(), updatedAt: new Date() });
    if (kind === "cobranza") await ref.update({ ultimoRecordatorio: new Date().toISOString() });
    return { success: true };
  } catch (error) {
    await job.update({ status: "pending", leaseUntil: 0, updatedAt: new Date() });
    throw error;
  }
}
