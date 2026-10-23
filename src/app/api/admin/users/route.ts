import { adminAuth,adminDb } from "@/lib/firebase-admin";
import { canAssignRole,roles } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { ApiError,apiError,requireActor } from "@/lib/server-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
const schema = z.object({
  email: z.email(), password: z.string().min(12).max(128), nombre: z.string().trim().min(2).max(100),
  documento: z.string().max(40).optional(), telefono: z.string().max(30).optional(),
  empresaId: z.string().min(1).max(120).regex(/^[\w-]+$/), rol: z.enum(roles).default("cajero"),
});
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["superadmin", "dueño"]);
    await rateLimit("users:" + actor.uid, 20, 60_000);
    const data = schema.parse(await request.json());
    if (!canAssignRole(actor.rol, data.rol) || (actor.rol !== "superadmin" && actor.empresaId !== data.empresaId)) throw new ApiError(403, "No puedes asignar este rol o empresa.");
    const empresa = await adminDb.collection("empresas").doc(data.empresaId).get();
    if (empresa.data()?.estado !== "activa") throw new ApiError(403, "La empresa no está activa.");
    const user = await adminAuth.createUser({ email: data.email, password: data.password, displayName: data.nombre });
    try {
      const batch = adminDb.batch();
      batch.set(adminDb.collection("usuarios").doc(user.uid), { uid: user.uid, nombre: data.nombre, email: data.email, documento: data.documento || "", telefono: data.telefono || "", empresaId: data.empresaId, rol: data.rol, activo: true, createdAt: new Date() });
      batch.set(adminDb.collection("auditoria").doc(), { empresaId: data.empresaId, accion: "crear_usuario", usuarioId: actor.uid, destinoId: user.uid, rol: data.rol, fecha: new Date() });
      await batch.commit();
    } catch (error) { await adminAuth.deleteUser(user.uid); throw error; }
    return NextResponse.json({ success: true, uid: user.uid });
  } catch (error) { return apiError(error); }
}
