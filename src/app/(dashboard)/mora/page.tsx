"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Eye, Phone } from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { Cuota, Prestamo, Cliente } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

import { useCompany, useBusinessDay } from '@/hooks/use-company';
import { isOverdue, daysOverdue } from '@/lib/business-date';
import { ListPagination, pageItems, LoadError } from '@/components/ListPagination';
import { matchesClient } from '@/lib/client-search';
import { Input } from '@/components/ui/input';

export default function MoraPage() {
  const { userData } = useAuth();
  const company = useCompany();
  const day = useBusinessDay(company?.zonaHoraria);
  const [sources, setSources] = useState<{ cuotas: Cuota[]; prestamos: Prestamo[]; clientes: Cliente[]; ready: string[] }>({ cuotas: [], prestamos: [], clientes: [], ready: [] });
  const [loadError, setLoadError] = useState(''), [search, setSearch] = useState(''), [bucket, setBucket] = useState('todos'), [page, setPage] = useState(0);
  const empresaId = userData?.empresaId;
  useEffect(() => {
    if (!empresaId) return;
    let active = true;
    const stops = (['cuotas', 'prestamos', 'clientes'] as const).map(name => onSnapshot(query(collection(db, name), where('empresaId', '==', empresaId)), snap => {
      if (!active) return;
      setSources(previous => ({ ...previous, [name]: snap.docs.map(d => ({ id: d.id, ...d.data() })), ready: [...new Set([...previous.ready, name])] }));
    }, () => { if (active) setLoadError('No se pudo consultar la cartera completa. Reintenta antes de gestionar la mora.'); }));
    return () => { active = false; stops.forEach(stop => stop()); };
  }, [empresaId]);
  const loading = sources.ready.length !== 3;
  const moraItems = useMemo(() => {
    const loans = new Map(sources.prestamos.map(p => [p.id, p]));
    const clients = new Map(sources.clientes.map(c => [c.id, c]));
    return sources.cuotas.filter(c => isOverdue(c, day)).flatMap(cuota => {
      const prestamo = loans.get(cuota.prestamoId), cliente = clients.get(cuota.clienteId);
      if (!prestamo || !cliente) return [];
      return [{ cuota, prestamo, cliente, diasAtraso: daysOverdue(cuota.fechaVencimiento, day) }];
    }).sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [sources, day]);
  const visible = moraItems.filter(item => matchesClient(item.cliente, search) && (bucket === 'todos' || (bucket === '1-7' ? item.diasAtraso <= 7 : bucket === '8-30' ? item.diasAtraso > 7 && item.diasAtraso <= 30 : item.diasAtraso > 30)));
  const clientsInArrears = new Set(moraItems.map(i => i.cliente.id)).size;
  const balance = moraItems.reduce((sum, i) => sum + Math.max(0, Math.round(i.cuota.totalCuota * 100) - Math.round((i.cuota.montoPagado || 0) * 100)), 0) / 100;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-2">
          <AlertCircle className="h-8 w-8" />
          Control de Mora
        </h2>
        <p className="text-muted-foreground">Listado de clientes con cuotas vencidas y alertas de atraso.</p>
      </div>

      {loadError && <LoadError message={loadError} />}
      <p className="text-sm text-muted-foreground">Corte operativo: {day} · {clientsInArrears} clientes · Saldo vencido ${balance.toFixed(2)}</p>
      <div className="flex flex-wrap gap-3"><Input aria-label="Buscar cartera vencida" className="max-w-sm" placeholder="Cliente, cédula o teléfono" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /><select aria-label="Tramo de atraso" className="min-h-11 rounded-md border bg-background px-3 text-sm" value={bucket} onChange={e => { setBucket(e.target.value); setPage(0); }}><option value="todos">Todos los atrasos</option><option value="1-7">1 a 7 días</option><option value="8-30">8 a 30 días</option><option value="31+">Más de 30 días</option></select></div>
      <div className="space-y-3 md:hidden">
        {loading ? <p role="status">Calculando morosidad…</p> : !visible.length ? <p className="rounded-lg border p-5 text-sm text-muted-foreground">{loadError ? 'La consulta está incompleta.' : 'No hay cuotas vencidas que coincidan con los filtros.'}</p> : pageItems(visible, page).map(item => <article key={item.cuota.id} className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{item.cliente.nombres} {item.cliente.apellidos}</h3><Badge variant="destructive">{item.diasAtraso} días</Badge></div>
          <p className="text-sm text-muted-foreground">Cuota #{item.cuota.numeroCuota} · Vencimiento {item.cuota.fechaVencimiento}</p>
          <p className="text-lg font-semibold">Saldo vencido ${(item.cuota.totalCuota - (item.cuota.montoPagado || 0)).toFixed(2)}</p>
          {item.cliente.telefonoPrincipal && <a className="inline-flex min-h-11 items-center gap-2 text-sm underline" href={`tel:${item.cliente.telefonoPrincipal}`}><Phone className="size-4" aria-hidden />{item.cliente.telefonoPrincipal}</a>}
          <div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm" href={`/prestamos/${item.prestamo.id}`}>Ver crédito</Link><Link className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm" href={`/gestion?cliente=${item.cliente.id}`}>Crear gestión</Link></div>
        </article>)}
      </div>
      <div className="hidden border rounded-md bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Cuota Vencida</TableHead>
              <TableHead>Monto Vencido</TableHead>
              <TableHead>Días de Atraso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Calculando morosidad...
                </TableCell>
              </TableRow>
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {loadError ? 'La consulta está incompleta.' : 'No hay cuotas vencidas que coincidan con los filtros.'}
                </TableCell>
              </TableRow>
            ) : (
              pageItems(visible, page).map((item, index) => (
                <TableRow key={index} className="bg-destructive/5">
                  <TableCell className="font-medium">
                    {item.cliente.nombres} {item.cliente.apellidos}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3" /> {item.cliente.telefonoPrincipal}
                    </div>
                  </TableCell>
                  <TableCell>
                    Cuota #{item.cuota.numeroCuota} <br/>
                    <span className="text-xs text-muted-foreground">{item.cuota.fechaVencimiento}</span>
                  </TableCell>
                  <TableCell className="font-bold text-destructive">
                    ${(item.cuota.totalCuota - (item.cuota.montoPagado || 0)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.diasAtraso > 7 ? 'destructive' : 'outline'} className={item.diasAtraso > 7 ? '' : 'text-amber-600 border-amber-600'}>
                      {item.diasAtraso} días
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/prestamos/${item.prestamo.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="mr-2 h-4 w-4" /> Ver Préstamo
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!loading && !loadError && <ListPagination total={visible.length} page={page} onPage={setPage} />}
    </div>
  );
}
