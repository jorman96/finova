import { adminDb } from "@/lib/firebase-admin";
import { validateImageUrl } from "@/lib/safe-image";
import { apiError,ApiError,requireActor } from "@/lib/server-auth";
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const raw = new URL(request.url).searchParams.get("url");
    if (!raw) throw new ApiError(400, "Falta la imagen.");
    let url;
    try { url = validateImageUrl(raw, actor.empresaId, process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "", (await adminDb.collection("empresas").doc(actor.empresaId).get()).data()?.logoUrl); }
    catch { throw new ApiError(400, "Imagen no permitida."); }
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000), cache: "no-store" });
    const type = response.headers.get("content-type")?.split(";")[0];
    if (!response.ok || !["image/png", "image/jpeg", "image/webp"].includes(type || "")) throw new ApiError(400, "Formato de imagen inválido.");
    if (Number(response.headers.get("content-length")) > 5 * 1024 * 1024) throw new ApiError(413, "Imagen demasiado grande.");
    const reader = response.body?.getReader();
    if (!reader) throw new ApiError(400, "Imagen vacía.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 5 * 1024 * 1024) { await reader.cancel(); throw new ApiError(413, "Imagen demasiado grande."); } chunks.push(value); }
    return new Response(Buffer.concat(chunks), { headers: { "Content-Type": type!, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
