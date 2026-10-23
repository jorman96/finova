import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { adminAuth,adminDb } from "./firebase-admin";
import type { Role } from "./permissions";
import { roles } from "./permissions";
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface Actor { uid: string; empresaId: string; rol: Role; nombre: string }
export async function requireActor(request: Request, allowed: readonly Role[] = roles): Promise<Actor> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError(401, "Inicia sesión para continuar.");
  const decoded = await adminAuth.verifyIdToken(token, true).catch(() => { throw new ApiError(401, "Sesión vencida o revocada."); });
  const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
  const user = snap.data();
  if (!user || user.activo === false || !allowed.includes(user.rol)) throw new ApiError(403, "No tienes permiso para esta operación.");
  if (user.rol !== "superadmin") {
    const empresa = await adminDb.collection("empresas").doc(user.empresaId).get();
    if (empresa.data()?.estado !== "activa") throw new ApiError(403, "Empresa suspendida o no disponible.");
  }
  return { uid: decoded.uid, empresaId: user.empresaId, rol: user.rol, nombre: user.nombre || decoded.uid };
}
export function assertTenant(actor: Actor, empresaId: unknown) {
  if (actor.empresaId !== empresaId) throw new ApiError(403, "El registro no pertenece a tu empresa.");
}
export function apiError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Datos inválidos. Revisa los campos enviados." }, { status: 400 });
  console.error("Operación de servidor fallida", error instanceof Error ? error.message : "Error desconocido");
  return NextResponse.json({ error: "No se completó la operación. Intenta nuevamente." }, { status: 500 });
}
