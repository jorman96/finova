import { Resend } from "resend";
import { ApiError } from "./server-auth";
export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
export function emailConfigured() { return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL; }
export async function sendEmail(to: string, subject: string, html: string, key: string) {
  if (!emailConfigured()) throw new ApiError(503, "El servicio de correo no está configurado. Contacta al administrador.");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({ from: process.env.RESEND_FROM_EMAIL!, to, subject, html }, { idempotencyKey: key });
  if (result.error) throw new ApiError(502, "No se pudo entregar la solicitud al servicio de correo.");
  return result.data;
}
