"use client";

import { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, DollarSign, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pago } from "@/types";
import { collection, query, orderBy, onSnapshot, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { useListFilter } from '@/hooks/use-list-filter';
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { matchesText } from '@/lib/client-search';
import { ListPagination, pageItems, LoadError } from '@/components/ListPagination';
import { businessDate } from '@/lib/business-date';

export default function PagosPage() {
  const { userData } = useAuth();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useListFilter('receipts-search');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(''), [method, setMethod] = useListFilter('receipts-method', 'todos'), [from, setFrom] = useListFilter('receipts-from'), [until, setUntil] = useListFilter('receipts-until'), [page, setPage] = useState(0);

  useEffect(() => {
    if (!userData?.empresaId) return;

    // Fetch clients to map names for older payments that don't have clienteNombre
    getDocs(query(collection(db, "clientes"), where("empresaId", "==", userData.empresaId))).then(snap => {
      const map: Record<string, string> = {};
      snap.forEach(doc => {
        const data = doc.data();
        map[doc.id] = `${data.nombres} ${data.apellidos}`;
      });
      setClientesMap(map);
    }).catch(() => setLoadError('No se pudieron cargar los nombres de clientes. Reintenta la consulta.'));

    const q = query(
      collection(db, "pagos"),
      where("empresaId", "==", userData.empresaId),
      orderBy("fecha", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pago));
      setPagos(data);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener pagos en tiempo real:", error);
      setLoadError('No se pudo cargar el historial de cobros. Los importes visibles pueden estar incompletos.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.empresaId]);

  const filteredPagos = pagos.filter(p => {
    const date = p.fechaStr || (p.fecha?.toDate ? businessDate(p.fecha.toDate()) : '');
    return matchesText(`${p.clienteNombre || clientesMap[p.clienteId] || ''} ${p.observaciones || ''} ${p.metodo || ''} ${p.id}`, searchTerm) && (method === 'todos' || p.metodo === method) && (!from || date >= from) && (!until || date <= until);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Registro de Pagos</h2>
          <p className="text-muted-foreground">Historial completo de todos los pagos recibidos.</p>
        </div>
      </div>

      {loadError && <LoadError message={loadError} />}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar cobros" placeholder="Cliente, recibo, método u observación"
            className="pl-8"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          />
        </div>
        <select aria-label="Método de cobro" className="min-h-11 rounded-md border bg-background px-3 text-sm" value={method} onChange={e => { setMethod(e.target.value); setPage(0); }}><option value="todos">Todos los métodos</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="deposito">Depósito</option><option value="otro">Otro</option></select>
        <label className="space-y-1 text-sm">Desde<Input type="date" value={from} max={until || undefined} onChange={e => { setFrom(e.target.value); setPage(0); }} /></label>
        <label className="space-y-1 text-sm">Hasta<Input type="date" value={until} min={from || undefined} onChange={e => { setUntil(e.target.value); setPage(0); }} /></label>
      </div>

      <div className="space-y-3 md:hidden">{loading ? <p role="status">Cargando cobros…</p> : !filteredPagos.length ? <p className="rounded-lg border border-dashed p-5 text-sm">{loadError ? 'No se pudo consultar el historial.' : 'No hay cobros que coincidan con los filtros.'}</p> : pageItems(filteredPagos, page).map(pago => <article key={pago.id} className="rounded-xl border bg-card p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{pago.clienteNombre || clientesMap[pago.clienteId] || 'Cliente por revisar'}</h3><strong>${pago.monto.toFixed(2)}</strong></div><p className="text-sm">{pago.fecha?.toDate ? businessDate(pago.fecha.toDate()) : pago.fechaStr || 'Fecha por revisar'} · {pago.metodo}</p><p className="text-xs break-all text-muted-foreground">Referencia: {pago.id}</p>{pago.observaciones && <p className="text-sm">{pago.observaciones}</p>}<Link className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm" href={'/prestamos/' + pago.prestamoId + '#recibo-' + pago.id}>Ver cobro y recibo</Link></article>)}</div>
      <div className="hidden border rounded-md bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Observación</TableHead>
              <TableHead className="text-right">Comprobante</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Cargando historial de pagos...
                </TableCell>
              </TableRow>
            ) : filteredPagos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron pagos registrados.
                </TableCell>
              </TableRow>
            ) : (
              pageItems(filteredPagos, page).map((pago) => (
                <TableRow key={pago.id}>
                  <TableCell className="font-medium">
                    {pago.fecha?.toDate ? pago.fecha.toDate().toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{pago.clienteNombre || clientesMap[pago.clienteId] || 'Cliente Desconocido'}</div>
                    <div className="text-xs text-muted-foreground">{pago.clienteId.slice(0,8)}...</div>
                  </TableCell>
                  <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                    +${pago.monto.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <Badge variant="outline" className="capitalize">
                        {pago.metodo}
                      </Badge>
                      {pago.cuentaDestino && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={pago.cuentaDestino}>
                          Bco: {pago.cuentaDestino.split(' - ')[0]}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {pago.observaciones || 'Sin detalles'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {pago.comprobanteUrl && (
                        <a href={pago.comprobanteUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" title="Ver Comprobante Subido">
                            <FileText className="h-4 w-4 text-blue-500" />
                          </Button>
                        </a>
                      )}
                      {pago.prestamoId && (
                        <Link href={`/prestamos/${pago.prestamoId}`}>
                          <Button variant="outline" size="sm" title="Ver Detalle de Préstamo para Eliminar Pago">
                            Ver Préstamo
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const { generarReciboPago } = await import("@/lib/pdfGenerator");
                          const { getDoc, doc } = await import("firebase/firestore");
                          try {
                            const empresaSnap = await getDoc(doc(db, "empresas", userData?.empresaId || ""));
                            const clienteSnap = await getDoc(doc(db, "clientes", pago.clienteId));
                            let prestamo = null;
                            if (pago.prestamoId) {
                              const prestamoSnap = await getDoc(doc(db, "prestamos", pago.prestamoId));
                              prestamo = prestamoSnap.data();
                            }
                            const pagoFormatted = {
                              ...pago,
                              fecha: pago.fecha?.toDate ? pago.fecha.toDate().toISOString() : new Date().toISOString()
                            };
                            await generarReciboPago(pagoFormatted, prestamo, clienteSnap.data(), empresaSnap.data());
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Recibo
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!loading && !loadError && <ListPagination total={filteredPagos.length} page={page} onPage={setPage} />}
    </div>
  );
}
