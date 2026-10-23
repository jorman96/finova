import { adminAuth,adminDb } from "@/lib/firebase-admin";
import { canAssignRole,roles } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { ApiError,apiError,requireActor } from "@/lib/server-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido.')), password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres.').max(128), nombre: z.string().trim().min(2, 'Escribe el nombre completo.').max(100),
  documento: z.string().max(40).optional(), telefono: z.string().max(30).optional(),
  empresaId: z.string().min(1).max(120).regex(/^[\w-]+$/), rol: z.enum(roles).default("cajero"),
});
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, ["superadmin", "dueño"]);
    await rateLimit("users:" + actor.uid, 20, 60_000);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      const fields = Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]));
      return NextResponse.json({ error: 'Revisa los campos indicados para crear la cuenta.', fields }, { status: 400 });
    }
    const data = parsed.data;
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
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
    if (code === 'auth/email-already-exists') return NextResponse.json({ error: 'Este correo ya tiene una cuenta. No se modificó su acceso. Usa un correo distinto o revisa la cuenta existente.', fields: { email: 'El correo ya está registrado.' } }, { status: 409 });
    if (code === 'auth/invalid-password' || code === 'auth/password-does-not-meet-requirements') return NextResponse.json({ error: 'La contraseña no cumple los requisitos de seguridad.', fields: { password: 'Usa al menos 12 caracteres y revisa la política de contraseñas.' } }, { status: 400 });
    return apiError(error);
  }
}
