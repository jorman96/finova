"use client";

import { useEffect, useState, use } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Prestamo, Cuota } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, CheckCircle, AlertCircle, Clock, FileText, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegistrarPagoDialog } from "@/components/pagos/RegistrarPagoDialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function PrestamoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { userData } = useAuth();
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const fetchData = async () => {
    try {
      const docRef = doc(db, "prestamos", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPrestamo({ id: docSnap.id, ...docSnap.data() } as Prestamo);
      } else {
        router.push("/prestamos");
        return;
      }

      // Obtener Cuotas
      const qCuotas = query(collection(db, "cuotas"), where("prestamoId", "==", id), orderBy("numeroCuota", "asc"));
      const cuotasSnap = await getDocs(qCuotas);
      setCuotas(cuotasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Cuota)));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrestamo = async () => {
    if (!prestamo) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);

      // Eliminar Cuotas
      const cuotasSnap = await getDocs(query(collection(db, "cuotas"), where("prestamoId", "==", id)));
      cuotasSnap.forEach(docSnap => batch.delete(docSnap.ref));

      // Eliminar Pagos
      const pagosSnap = await getDocs(query(collection(db, "pagos"), where("prestamoId", "==", id)));
      pagosSnap.forEach(docSnap => batch.delete(docSnap.ref));

      // Eliminar Préstamo
      batch.delete(doc(db, "prestamos", id));

      await batch.commit();
      toast.success("Préstamo eliminado exitosamente.");
      setDeleteModalOpen(false);
      router.push("/prestamos");
    } catch (error) {
      console.error("Error eliminando préstamo:", error);
      toast.error("Error al eliminar el crédito.");
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, router]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando detalles del préstamo...</div>;
  if (!prestamo) return null;

  const cuotasPagadas = cuotas.filter(c => c.estado === 'pagada').length;
  const porcentajePagado = (cuotasPagadas / prestamo.numeroCuotas) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/prestamos">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Préstamo - {prestamo.clienteNombre}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={prestamo.estado === 'moroso' ? 'destructive' : prestamo.estado === 'completado' ? 'secondary' : 'default'}>
                {prestamo.estado.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">{prestamo.frecuenciaPago}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const { generarContratoPrestamo } = await import("@/lib/pdfGenerator");
                const { getDoc, doc } = await import("firebase/firestore");
                const empresaSnap = await getDoc(doc(db, "empresas", prestamo.empresaId));
                const clienteSnap = await getDoc(doc(db, "clientes", prestamo.clienteId));
                
                const prestamoFormatted = {
                  ...prestamo,
                  id: prestamo.id,
                  montoOriginal: prestamo.monto,
                  totalDevolver: prestamo.totalPagar,
                  plazoMeses: prestamo.numeroCuotas
                };

                const cuotasFormatted = cuotas.map(c => ({
                  numero: c.numeroCuota,
                  fechaVencimiento: c.fechaVencimiento,
                  monto: c.totalCuota,
                  capital: c.capital,
                  interes: c.interes,
                  saldoPendienteAntes: c.saldoPendiente
                }));

                await generarContratoPrestamo(prestamoFormatted, clienteSnap.data(), empresaSnap.data(), cuotasFormatted);
              } catch (error) {
                console.error(error);
              }
            }}
          >
            <FileText className="mr-2 h-4 w-4" /> Imprimir Contrato
          </Button>
          {prestamo.estado !== 'completado' && (
            <RegistrarPagoDialog prestamo={prestamo} cuotas={cuotas} onPagoRegistrado={fetchData} />
          )}
          {(userData?.rol === 'dueño' || userData?.rol === 'admin' || userData?.rol === 'superadmin') && (
            <Button variant="destructive" onClick={() => setDeleteModalOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar Crédito
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground text-sm">Fecha Otorgamiento</span>
              <span className="font-medium">{prestamo.fechaDesembolso || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground text-sm">Monto Solicitado</span>
              <span className="font-medium">${prestamo.monto.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground text-sm">Tasa de Interés</span>
              <span className="font-medium">{prestamo.tasaInteres}% ({prestamo.tipoInteres})</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground text-sm">Total a Pagar</span>
              <span className="font-medium">${prestamo.totalPagar.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground text-sm">Saldo Restante</span>
              <span className="font-bold text-primary">${prestamo.saldoRestante.toFixed(2)}</span>
            </div>
            
            <div className="pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Progreso ({cuotasPagadas}/{prestamo.numeroCuotas})</span>
                <span>{porcentajePagado.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${porcentajePagado}%` }}></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tabla de Amortización</CardTitle>
            <CardDescription>Detalle de cuotas y estado de pagos.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="border rounded-md overflow-hidden bg-card/50">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 font-medium">#</th>
                      <th className="p-3 font-medium">Vencimiento</th>
                      <th className="p-3 font-medium">Cuota</th>
                      <th className="p-3 font-medium">Capital / Interés</th>
                      <th className="p-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotas.map((cuota) => (
                      <tr key={cuota.id} className="border-t hover:bg-muted/50 transition-colors">
                        <td className="p-3">{cuota.numeroCuota}</td>
                        <td className="p-3">{cuota.fechaVencimiento}</td>
                        <td className="p-3 font-medium">${cuota.totalCuota.toFixed(2)}</td>
                        <td className="p-3 text-muted-foreground text-xs">
                          C: ${cuota.capital.toFixed(2)} <br />
                          I: ${cuota.interes.toFixed(2)}
                        </td>
                        <td className="p-3">
                          <Badge variant={cuota.estado === 'pagada' ? 'secondary' : cuota.estado === 'vencida' ? 'destructive' : 'outline'}>
                            {cuota.estado === 'pagada' ? <CheckCircle className="mr-1 h-3 w-3" /> : cuota.estado === 'vencida' ? <AlertCircle className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}
                            {cuota.estado}
                          </Badge>
                          {cuota.montoPagado > 0 && cuota.montoPagado < cuota.totalCuota && (
                            <div className="text-[10px] mt-1 text-muted-foreground">Pagado: ${cuota.montoPagado}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">¿Eliminar este préstamo por completo?</DialogTitle>
            <DialogDescription>
              Esta acción es <strong>irreversible</strong>. Se eliminará el préstamo, junto con todas sus cuotas y cualquier pago registrado, desapareciendo del sistema por completo. Úselo solo para corregir créditos creados por error.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeletePrestamo} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Sí, eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
