import type { Usuario } from "../types";
export const roles = ["superadmin", "admin", "dueño", "gestor", "cobrador", "cajero", "consulta"] as const;
export type Role = Usuario["rol"];
export const managers: Role[] = ["superadmin", "dueño", "admin"];
export const collectors: Role[] = [...managers, "cajero", "cobrador"];
export function canAssignRole(caller: Role, target: Role) {
  return caller === "superadmin" || (caller === "dueño" && !["superadmin", "dueño"].includes(target));
}
export function canAccessPage(role: Role, path: string) {
  if (path.startsWith("/master")) return role === "superadmin";
  if (["/configuracion", "/inversionistas", "/reportes", "/tesoreria"].some(p => path.startsWith(p))) return managers.includes(role);
  return true;
}
