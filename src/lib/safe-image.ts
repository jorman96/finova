/** Only our own Firebase Storage tenant objects may be fetched by the server. */
export function validateImageUrl(raw: string, empresaId: string, bucket: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== "firebasestorage.googleapis.com" || url.port || url.username || url.password) throw new Error("Origen de imagen no permitido");
  const path = decodeURIComponent(url.pathname);
  if (!bucket || !path.startsWith(`/v0/b/${bucket}/o/empresas/${empresaId}/`)) throw new Error("La imagen no pertenece a esta empresa");
  return url;
}
