"use client";

import { useState, useEffect } from "react";
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
import { useAuth } from "@/contexts/AuthContext";

export default function ClientesPage() {
  const { userData } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.empresaId) return;

    const q = query(
      collection(db, "clientes"), 
      where("empresaId", "==", userData.empresaId),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
      setClientes(data);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener clientes en tiempo real:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.empresaId]);

  const filteredClientes = clientes.filter(c => 
    (c.nombres || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.apellidos || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cedula || "").includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-muted-foreground">Gestiona la cartera de clientes y su historial.</p>
        </div>
        {userData?.rol !== 'cobrador' && (
          <NuevoClienteDialog />
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre, apellido o cédula..." 
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
              <TableHead>Nombre Completo</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Score</TableHead>
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
                  No se encontraron clientes.
                </TableCell>
              </TableRow>
            ) : (
              filteredClientes.map((cliente) => (
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
                          className={`h-1.5 rounded-full ${(!cliente.score || cliente.score >= 75) ? 'bg-green-500' : cliente.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                          style={{ width: `${cliente.score || 50}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold">{cliente.score || 50}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cliente.estado === 'moroso' ? 'destructive' : cliente.estado === 'activo' ? 'default' : 'secondary'}>
                      {cliente.estado?.toUpperCase() || 'DESCONOCIDO'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`/clientes/${cliente.id}`} />}>
                          <Eye className="mr-2 h-4 w-4" /> Ver Perfil
                        </DropdownMenuItem>
                        <EditarClienteDialog cliente={cliente} />
                      </DropdownMenuContent>
                    </DropdownMenu>
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
