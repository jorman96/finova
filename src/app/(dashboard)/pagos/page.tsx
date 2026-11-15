"use client";

import { PageControls } from "@/components/PageControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
Table,TableBody,TableCell,TableHead,TableHeader,TableRow
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { useTenantPage } from "@/lib/use-tenant-page";
import { Pago } from "@/types";
import { FileText,Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function PagosPage() {
  const { userData } = useAuth();
  const paging = useTenantPage<Pago>("pagos", userData?.empresaId, "fecha");
  const pagos = paging.rows;

  const [searchTerm, setSearchTerm] = useState("");
  const loading = paging.loading;

  const filteredPagos = pagos.filter(p => 
    p.observaciones?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.metodo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.includes(searchTerm) || (p.clienteNombre || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Registro de Pagos</h2>
          <p className="text-muted-foreground">Historial paginado de cobros y anulaciones.</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por observación o método..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {paging.error && <p role="alert" className="text-destructive">{paging.error}</p>}
      <PageControls {...paging} />
      <div className="border rounded-md bg-card">
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
              filteredPagos.map((pago) => (
                <TableRow key={pago.id}>
                  <TableCell className="font-medium">
                    {pago.fecha?.toDate ? pago.fecha.toDate().toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{pago.clienteNombre || 'Cliente Desconocido'}</div>
                    <div className="text-xs text-muted-foreground">{pago.clienteId.slice(0,8)}...</div>
                  </TableCell>
                  <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                    +${pago.monto.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <Badge variant="outline" className="capitalize">
                        {pago.anulado ? "ANULADO · " : ""}{pago.metodo}
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
    </div>
  );
}
