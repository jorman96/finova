"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Eye, Phone } from "lucide-react";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { Cuota, Prestamo, Cliente } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export default function MoraPage() {
  const { userData } = useAuth();
  const [moraItems, setMoraItems] = useState<{cuota: Cuota, prestamo: Prestamo, cliente: Cliente, diasAtraso: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.empresaId) return;

    const qCuotas = query(
      collection(db, "cuotas"), 
      where("empresaId", "==", userData.empresaId),
      where("estado", "in", ["pendiente", "vencida", "parcial"])
    );
    
    const unsubscribe = onSnapshot(qCuotas, async (snapshot) => {
      setLoading(true);
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const vencidas = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Cuota))
          .filter(c => c.fechaVencimiento < todayStr);

        const prestamosIds = [...new Set(vencidas.map(c => c.prestamoId))];
        const prestamosMap = new Map<string, Prestamo>();
        const clientesMap = new Map<string, Cliente>();

        // Optimizamos obteniendo todos los prestamos y clientes de los IDs necesarios
        for (const pid of prestamosIds) {
           const pSnap = await getDocs(query(collection(db, "prestamos"), where("empresaId", "==", userData.empresaId))); 
           const pDoc = pSnap.docs.find(d => d.id === pid);
           if (pDoc) {
             const prestamo = { id: pDoc.id, ...pDoc.data() } as Prestamo;
             prestamosMap.set(pid, prestamo);
             
             if (!clientesMap.has(prestamo.clienteId)) {
                const cSnap = await getDocs(query(collection(db, "clientes"), where("empresaId", "==", userData.empresaId))); 
                const cDoc = cSnap.docs.find(d => d.id === prestamo.clienteId);
                if (cDoc) {
                  clientesMap.set(prestamo.clienteId, { id: cDoc.id, ...cDoc.data() } as Cliente);
                }
             }
           }
        }

        const items = vencidas.map(cuota => {
          const prestamo = prestamosMap.get(cuota.prestamoId)!;
          const cliente = clientesMap.get(cuota.clienteId)!;
          
          if (!prestamo || !cliente) return null;

          const vDate = new Date(cuota.fechaVencimiento);
          const tDate = new Date();
          const diasAtraso = Math.floor((tDate.getTime() - vDate.getTime()) / (1000 * 3600 * 24));
          
          return { cuota, prestamo, cliente, diasAtraso };
        }).filter(Boolean) as {cuota: Cuota, prestamo: Prestamo, cliente: Cliente, diasAtraso: number}[];

        items.sort((a, b) => b.diasAtraso - a.diasAtraso);
        setMoraItems(items);
      } catch (error) {
        console.error("Error procesando mora:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-2">
          <AlertCircle className="h-8 w-8" />
          Control de Mora
        </h2>
        <p className="text-muted-foreground">Listado de clientes con cuotas vencidas y alertas de atraso.</p>
      </div>

      <div className="border rounded-md bg-card">
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
            ) : moraItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay clientes en estado de mora. ¡Excelente!
                </TableCell>
              </TableRow>
            ) : (
              moraItems.map((item, index) => (
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
                    ${(item.cuota.totalCuota - item.cuota.montoPagado).toFixed(2)}
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
    </div>
  );
}
