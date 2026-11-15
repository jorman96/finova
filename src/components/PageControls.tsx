"use client";
import { Button } from "./ui/button";
export function PageControls({ page, hasNext, loading, next, previous, refresh }: { page: number; hasNext: boolean; loading: boolean; next: () => void; previous: () => void; refresh: () => void }) {
  return <div className="flex flex-wrap items-center gap-3 text-sm"><Button variant="outline" disabled={loading || !page} onClick={previous}>Anterior</Button><span>Página {page + 1} · hasta 50 registros · búsqueda en esta página</span><Button variant="outline" disabled={loading || !hasNext} onClick={next}>Siguiente</Button><Button variant="ghost" disabled={loading} onClick={refresh}>Actualizar</Button></div>;
}
