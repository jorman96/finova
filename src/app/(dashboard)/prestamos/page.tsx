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

import { useAuth } from "@/contexts/AuthContext";

export default function PrestamosPage() {
  const { userData } = useAuth();
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.empresaId) return;

    const q = query(
      collection(db, "prestamos"), 
      where("empresaId", "==", userData.empresaId),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prestamo));
      setPrestamos(data);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener préstamos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.empresaId]);

  const filteredPrestamos = prestamos.filter(p => 
    p.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Préstamos</h2>
          <p className="text-muted-foreground">Administra la cartera de créditos y monitorea su estado.</p>
        </div>
        {(userData?.rol === 'dueño' || userData?.rol === 'superadmin' || userData?.rol === 'admin') && (
          <div className="flex gap-2">
            <NotificarMorososButton />
            <NuevoPrestamoDialog />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-md bg-card">
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
                  No se encontraron préstamos.
                </TableCell>
              </TableRow>
            ) : (
              filteredPrestamos.map((prestamo) => (
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
    </div>
  );
}
