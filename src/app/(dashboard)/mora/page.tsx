"use client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost } from "@/lib/api-client";
import { useResource } from "@/lib/use-resource";
import Link from "next/link";
import { useState } from "react";
type Cursor = { date: string; id: string } | null;
interface Result { rows: { id: string; prestamoId: string; clienteNombre: string; telefono: string; numeroCuota: number; fechaVencimiento: string; saldo: number; diasAtraso: number }[]; next: Cursor; today: string }
export default function MoraPage() {
  const { userData } = useAuth();
  const [cursors, setCursors] = useState<Cursor[]>([null]), [page, setPage] = useState(0), [revision, setRevision] = useState(0);
  const { data: result, error, loading } = useResource<Result>(JSON.stringify([userData?.empresaId, cursors[page], revision]), () => apiPost<Result>("/api/mora", { cursor: cursors[page] }));
  return <div className="space-y-5"><h1 className="text-3xl font-bold">Agenda de cobranza vencida</h1><p className="text-muted-foreground">Ordenada por antigüedad. Corte: {result?.today || "cargando"}.</p>
    <div className="flex gap-3"><Button variant="outline" disabled={!page || loading} onClick={() => setPage(p => p - 1)}>Anterior</Button><span>Página {page + 1}</span><Button variant="outline" disabled={!result?.next || loading} onClick={() => { setCursors(c => [...c.slice(0, page + 1), result!.next]); setPage(p => p + 1); }}>Siguiente</Button><Button variant="ghost" onClick={() => setRevision(n => n + 1)}>Actualizar</Button></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}{loading && <p role="status">Calculando vencimientos…</p>}
    {!loading && !error && result && (result.rows.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-3">Cliente</th><th>Contacto</th><th>Cuota / vencimiento</th><th>Saldo vencido</th><th>Días de atraso</th><th>Acción</th></tr></thead><tbody>{result.rows.map(r => <tr key={r.id} className="border-b"><td className="p-3">{r.clienteNombre}</td><td><a className="underline" href={`tel:${r.telefono}`}>{r.telefono}</a></td><td>#{r.numeroCuota} · {r.fechaVencimiento}</td><td>{r.saldo.toFixed(2)}</td><td>{r.diasAtraso}</td><td><Link className="underline" href={`/prestamos/${r.prestamoId}`}>Ver préstamo</Link></td></tr>)}</tbody></table></div> : <p>Sin cuotas vencidas en esta página.</p>)}
  </div>;
}
