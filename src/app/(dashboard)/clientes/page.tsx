"use client";

import { useState, useEffect } from "react";
import { EliminarClienteDialog } from "@/components/clientes/EliminarClienteDialog";
import { managers } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreVertical, Eye, FileEdit } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Cliente } from "@/types";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { NuevoClienteDialog } from "@/components/clientes/NuevoClienteDialog";
import { EditarClienteDialog } from "@/components/clientes/EditarClienteDialog";
import { useListFilter } from '@/hooks/use-list-filter';
import { useAuth } from "@/contexts/AuthContext";
import { matchesClient } from '@/lib/client-search';
import { ListPagination, pageItems, LoadError } from '@/components/ListPagination';

export default function ClientesPage() {
  const { userData } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useListFilter('clients-search');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(''), [status, setStatus] = useListFilter('clients-status', 'todos'), [page, setPage] = useState(0);

  useEffect(() => {
    if (!userData?.empresaId) return;

    const q = query(
      collection(db, "clientes"),
      where("empresaId", "==", userData.empresaId),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
      setLoadError(''); setClientes(data);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener clientes en tiempo real:", error);
      setLoadError('No se pudieron cargar los clientes. La lista puede estar incompleta.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.empresaId]);

  const filteredClientes = clientes.filter(c => matchesClient(c, searchTerm) && (status === 'todos' || c.estado === status));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-muted-foreground">Gestiona la cartera de clientes y su historial.</p>
        </div>
        {userData && ['superadmin','dueño','admin','cajero'].includes(userData.rol) && (
          <NuevoClienteDialog />
        )}
      </div>

      {loadError && <LoadError message={loadError} />}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar clientes" placeholder="Nombre completo, cédula, teléfono o correo"
            className="pl-8"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          />
        </div>
        <select aria-label="Estado del cliente" className="min-h-11 rounded-md border bg-background px-3 text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="todos">Todos los estados</option><option value="nuevo">Nuevo</option><option value="activo">Activo</option><option value="moroso">Moroso</option><option value="cerrado">Cerrado</option></select>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? <p role="status">Cargando clientes…</p> : !filteredClientes.length ? <p className="rounded-lg border border-dashed p-5 text-sm">{loadError ? 'No se pudo consultar el listado.' : 'No hay clientes que coincidan con los filtros.'}</p> : pageItems(filteredClientes, page).map(cliente => <article key={cliente.id} className="rounded-xl border bg-card p-4 space-y-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><Link href={'/clientes/' + cliente.id} className="font-semibold underline underline-offset-4">{cliente.nombres} {cliente.apellidos}</Link><p className="mt-1 text-sm text-muted-foreground">{cliente.cedula}</p></div><Badge variant={cliente.estado === 'moroso' ? 'destructive' : 'secondary'}>{cliente.estado || 'Sin estado'}</Badge></div><p className="break-all text-sm">{cliente.telefonoPrincipal}<br />{cliente.correo}</p><p className="text-xs text-muted-foreground">Indicador interno: {cliente.score ?? 'Sin evaluar'}</p><div className="flex flex-wrap items-center justify-between gap-2">{userData && ['superadmin','dueño','admin','cajero'].includes(userData.rol) && <EditarClienteDialog cliente={cliente} standalone />}{userData && managers.includes(userData.rol) && <EliminarClienteDialog cliente={cliente} onDeleted={() => {}} />}</div></article>)}
      </div>
      <div className="hidden border rounded-md bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre Completo</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Indicador interno</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Cargando clientes...
                </TableCell>
              </TableRow>
            ) : filteredClientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {loadError ? 'La lista no está disponible. Reintenta la consulta.' : clientes.length ? 'No hay coincidencias. Revisa la búsqueda o el filtro.' : 'Todavía no hay clientes registrados.'}
                </TableCell>
              </TableRow>
            ) : (
              pageItems(filteredClientes, page).map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">
                    {cliente.nombres} {cliente.apellidos}
                  </TableCell>
                  <TableCell>{cliente.cedula}</TableCell>
                  <TableCell>
                    <div className="text-sm">{cliente.telefonoPrincipal}</div>
                    <div className="text-xs text-muted-foreground">{cliente.correo}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-secondary rounded-full h-1.5 max-w-[50px]">
                        <div
                          className={`h-1.5 rounded-full ${cliente.score == null ? 'bg-muted-foreground' : cliente.score >= 75 ? 'bg-green-500' : cliente.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${cliente.score ?? 0}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium">{cliente.score ?? 'Sin evaluar'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cliente.estado === 'moroso' ? 'destructive' : cliente.estado === 'activo' ? 'default' : 'secondary'}>
                      {cliente.estado?.toUpperCase() || 'DESCONOCIDO'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {userData && managers.includes(userData.rol) && <EliminarClienteDialog cliente={cliente} onDeleted={() => {}} />}
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" className="size-11 p-0" aria-label={`Acciones de ${cliente.nombres} ${cliente.apellidos}`} />}>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`/clientes/${cliente.id}`} />}>
                          <Eye className="mr-2 h-4 w-4" /> Ver Perfil
                        </DropdownMenuItem>
                        {userData && ['superadmin','dueño','admin','cajero'].includes(userData.rol) && <EditarClienteDialog cliente={cliente} />}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!loading && !loadError && <ListPagination total={filteredClientes.length} page={page} onPage={setPage} />}
    </div>
  );
}
