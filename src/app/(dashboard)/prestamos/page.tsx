"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, FileText, CheckCircle } from "lucide-react";
import { Prestamo } from "@/types";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { NuevoPrestamoDialog } from "@/components/prestamos/NuevoPrestamoDialog";
import { NotificarMorososButton } from "@/components/prestamos/NotificarMorososButton";
import Link from "next/link";

import { useListFilter } from '@/hooks/use-list-filter';
import { useAuth } from "@/contexts/AuthContext";
import { matchesText } from '@/lib/client-search';
import { ListPagination, pageItems, LoadError } from '@/components/ListPagination';

export default function PrestamosPage() {
  const { userData } = useAuth();
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [searchTerm, setSearchTerm] = useListFilter('loans-search');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(''), [status, setStatus] = useListFilter('loans-status', 'todos'), [page, setPage] = useState(0);

  useEffect(() => {
    if (!userData?.empresaId) return;

    const q = query(
      collection(db, "prestamos"),
      where("empresaId", "==", userData.empresaId),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prestamo));
      setLoadError(''); setPrestamos(data);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener préstamos:", error);
      setLoadError('No se pudieron cargar los créditos. Reintenta antes de tomar decisiones.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.empresaId]);

  const filteredPrestamos = prestamos.filter(p =>
    matchesText(`${p.clienteNombre || ''} ${p.id}`, searchTerm) && (status === 'todos' || p.estado === status)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Préstamos</h2>
          <p className="text-muted-foreground">Administra la cartera de créditos y monitorea su estado.</p>
        </div>
        {(userData?.rol === 'dueño' || userData?.rol === 'superadmin' || userData?.rol === 'admin') && (
          <div className="flex flex-wrap gap-2">
            <NotificarMorososButton />
            <NuevoPrestamoDialog />
          </div>
        )}
      </div>

      {loadError && <LoadError message={loadError} />}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar créditos" placeholder="Nombre del cliente o referencia del crédito"
            className="pl-8"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          />
        </div>
        <select aria-label="Estado del crédito" className="min-h-11 rounded-md border bg-background px-3 text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="todos">Todos los estados</option><option value="activo">Activo</option><option value="moroso">Moroso</option><option value="completado">Completado</option><option value="cancelado">Cancelado</option></select>
      </div>

      <div className="space-y-3 md:hidden">{loading ? <p role="status">Cargando créditos…</p> : !filteredPrestamos.length ? <p className="rounded-lg border border-dashed p-5 text-sm">{loadError ? 'No se pudo consultar la cartera.' : 'No hay créditos que coincidan con los filtros.'}</p> : pageItems(filteredPrestamos, page).map(prestamo => <article key={prestamo.id} className="rounded-xl border bg-card p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{prestamo.clienteNombre}</h3><Badge variant={prestamo.estado === 'moroso' ? 'destructive' : 'secondary'}>{prestamo.estado}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm"><p>Monto entregado<strong className="block">${prestamo.monto.toFixed(2)}</strong></p><p>Saldo pendiente<strong className="block">${prestamo.saldoRestante.toFixed(2)}</strong></p></div><p className="text-xs text-muted-foreground">Desembolso: {prestamo.fechaDesembolso || 'Por revisar'} · {prestamo.frecuenciaPago}</p><Link className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm" href={'/prestamos/' + prestamo.id}>Ver crédito</Link></article>)}</div>
      <div className="hidden border rounded-md bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha Otorgamiento</TableHead>
              <TableHead>Monto Inicial</TableHead>
              <TableHead>Saldo Restante</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Cargando préstamos...
                </TableCell>
              </TableRow>
            ) : filteredPrestamos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {loadError ? 'La lista no está disponible.' : 'No hay créditos que coincidan con la búsqueda y el estado.'}
                </TableCell>
              </TableRow>
            ) : (
              pageItems(filteredPrestamos, page).map((prestamo) => (
                <TableRow key={prestamo.id}>
                  <TableCell className="font-medium">
                    {prestamo.clienteNombre}
                  </TableCell>
                  <TableCell>{prestamo.fechaDesembolso || 'N/A'}</TableCell>
                  <TableCell>${prestamo.monto.toFixed(2)}</TableCell>
                  <TableCell className="font-bold text-primary">
                    ${prestamo.saldoRestante.toFixed(2)}
                  </TableCell>
                  <TableCell className="capitalize">{prestamo.frecuenciaPago}</TableCell>
                  <TableCell>
                    <Badge variant={prestamo.estado === 'moroso' ? 'destructive' : prestamo.estado === 'completado' ? 'secondary' : 'default'}>
                      {prestamo.estado.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/prestamos/${prestamo.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="mr-2 h-4 w-4" /> Ver
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!loading && !loadError && <ListPagination total={filteredPrestamos.length} page={page} onPage={setPage} />}
    </div>
  );
}
