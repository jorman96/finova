"use client";

import { RegistrarPagoDialog } from "@/components/pagos/RegistrarPagoDialog";
import { EliminarPrestamoDialog } from "@/components/prestamos/EliminarPrestamoDialog";
import { ReestructurarPrestamoDialog } from "@/components/prestamos/ReestructurarPrestamoDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost } from "@/lib/api-client";
import { db } from "@/lib/firebase";
import { collectors } from "@/lib/permissions";
import { useFinanceRequest } from "@/lib/use-finance-request";
import { Cuota, Prestamo } from "@/types";
import type { DocumentData } from "firebase/firestore";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { AlertCircle, ArrowLeft, CheckCircle, Clock, FileText, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";

export default function PrestamoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { userData } = useAuth();
  const finance = useFinanceRequest();
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [pagos, setPagos] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!id || !userData?.empresaId) return;

    const unsubPrestamo = onSnapshot(doc(db, "prestamos", id), (docSnap) => {
      if (docSnap.exists()) {
        setPrestamo({ id: docSnap.id, ...docSnap.data() } as Prestamo);
      } else {
        router.push("/prestamos");
      }
    });

    const unsubCuotas = onSnapshot(query(collection(db, "cuotas"), where("empresaId", "==", userData.empresaId), where("prestamoId", "==", id), orderBy("numeroCuota", "asc")), (snap) => {
      setCuotas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cuota)));
    });

    const unsubPagos = onSnapshot(query(collection(db, "pagos"), where("empresaId", "==", userData.empresaId), where("prestamoId", "==", id)), (snap) => {
      const pagosData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      pagosData.sort((a: DocumentData, b: DocumentData) => {
        const dateA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const dateB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setPagos(pagosData);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener pagos:", error);
      setLoading(false);
    });

    return () => {
      unsubPrestamo();
      unsubCuotas();
      unsubPagos();
    };
  }, [id, router, userData?.empresaId]);

  const fetchData = () => {
    // Mantenemos la función para refrescos
  };

  const handleDeletePrestamo = async () => {
    if (!prestamo) return;
    setIsDeleting(true);
    try {
      await finance.submit({ action: "cancel_loan", prestamoId: id, motivo: motivoAnulacion });
      toast.success("Crédito anulado; historial conservado.");
      setDeleteModalOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo anular"); }
    finally { setIsDeleting(false); }
  };

  const handleDeletePago = async (pago: { id: string; anulado?: boolean }) => {
    if (pago.anulado) return;
    const motivo = window.prompt("Motivo de la anulación (mínimo 10 caracteres). Se conservará el pago original.");
    if (!motivo) return;
    try { await finance.submit({ action: "reverse_payment", pagoId: pago.id, motivo }); toast.success("Pago anulado con movimiento compensatorio."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo anular"); }
  };

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
              <Badge variant={prestamo.estado === 'moroso' ? 'destructive' : prestamo.estado === 'completado' ? 'secondary' : prestamo.estado === 'cancelado' ? 'outline' : 'default'}>
                {prestamo.estado.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">{prestamo.frecuenciaPago}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

          {userData && collectors.includes(userData.rol) && !['completado', 'cancelado'].includes(prestamo.estado) && (
            <RegistrarPagoDialog prestamo={prestamo} cuotas={cuotas} onPagoRegistrado={fetchData} />
          )}

          {(userData?.rol === 'dueño' || userData?.rol === 'admin' || userData?.rol === 'superadmin') && (
            <>
              {prestamo.estado !== 'cancelado' && prestamo.estado !== 'completado' && prestamo.estado !== 'reestructurado' && prestamo.saldoRestante > 0 && (
                <ReestructurarPrestamoDialog
                  prestamo={prestamo}
                  onReestructurado={(newId) => router.push(`/prestamos/${newId}`)}
                />
              )}
              {prestamo.estado !== 'cancelado' && prestamo.estado !== 'reestructurado' && (
                <Button 
                  variant="outline" 
                  className="text-amber-600 border-amber-600/30 hover:bg-amber-500/10" 
                  onClick={() => { finance.reset(); setMotivoAnulacion(""); setDeleteModalOpen(true); }}
                >
                  Anular Crédito
                </Button>
              )}
              <EliminarPrestamoDialog 
                prestamo={prestamo} 
                onDeleted={() => router.push("/prestamos")} 
              />
            </>
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
              <span className="text-muted-foreground text-sm">Total Pagado</span>
              <span className="font-medium text-green-600">${(prestamo.totalPagar - prestamo.saldoRestante).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground text-sm">Saldo Restante</span>
              <span className="font-bold text-primary">${prestamo.saldoRestante.toFixed(2)}</span>
            </div>
            {prestamo.nuevoPrestamoId && (
              <div className="flex justify-between border-b pb-2 text-sm bg-primary/5 p-2 rounded">
                <span className="text-muted-foreground">Reestructurado En:</span>
                <Link href={`/prestamos/${prestamo.nuevoPrestamoId}`} className="text-primary hover:underline font-semibold">
                  Nuevo Crédito #{prestamo.nuevoPrestamoId.slice(-6)} →
                </Link>
              </div>
            )}
            {prestamo.prestamoOrigenId && (
              <div className="flex justify-between border-b pb-2 text-sm bg-primary/5 p-2 rounded">
                <span className="text-muted-foreground">Origen (Reestructuración):</span>
                <Link href={`/prestamos/${prestamo.prestamoOrigenId}`} className="text-primary hover:underline font-semibold">
                  Crédito Anterior #{prestamo.prestamoOrigenId.slice(-6)} →
                </Link>
              </div>
            )}
            
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
             <div className="border rounded-md overflow-y-auto max-h-[500px] bg-card/50">
                <table className="w-full text-sm text-left relative">
                  <thead className="bg-muted sticky top-0 z-10 shadow-sm">
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
                          <Badge variant={cuota.estado === 'pagada' ? 'secondary' : cuota.estado === 'vencida' ? 'destructive' : 'outline'} className="mb-1">
                            {cuota.estado === 'pagada' ? <CheckCircle className="mr-1 h-3 w-3" /> : cuota.estado === 'vencida' ? <AlertCircle className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}
                            {cuota.estado}
                          </Badge>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            Pagado: <span className={cuota.montoPagado > 0 ? "text-green-600 font-medium" : ""}>${cuota.montoPagado.toFixed(2)}</span> <br />
                            Resta: ${(cuota.totalCuota - cuota.montoPagado).toFixed(2)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 mt-4">
          <CardHeader>
            <CardTitle>Historial de Pagos</CardTitle>
            <CardDescription>Registro de abonos y comprobantes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-y-auto max-h-[400px] bg-card/50">
              <table className="w-full text-sm text-left relative">
                <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 font-medium">Fecha</th>
                    <th className="p-3 font-medium">Monto</th>
                    <th className="p-3 font-medium">Método</th>
                    <th className="p-3 font-medium">Registrado por</th>
                    <th className="p-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No hay pagos registrados.</td></tr>
                  ) : pagos.map(p => (
                    <tr key={p.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">{p.fecha?.toDate ? new Date(p.fecha.toDate()).toLocaleString() : 'N/A'}</td>
                      <td className="p-3 font-bold text-green-600">${p.monto.toFixed(2)}</td>
                      <td className="p-3 capitalize">{p.anulado ? 'ANULADO · ' : ''}{p.metodo || p.metodoPago || 'Efectivo'}</td>
                      <td className="p-3 text-muted-foreground">{p.registradoPor || 'Sistema'}</td>
                      <td className="p-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={async () => {
                          try {
                            const { generarReciboPago } = await import("@/lib/pdfGenerator");
                            const empresaSnap = await getDoc(doc(db, "empresas", prestamo.empresaId));
                            const clienteSnap = await getDoc(doc(db, "clientes", prestamo.clienteId));
                            await generarReciboPago({ ...p, fecha: p.fecha?.toDate ? p.fecha.toDate().toISOString() : new Date().toISOString() }, prestamo, clienteSnap.data(), empresaSnap.data());
                          } catch (e) {
                            console.error(e);
                          }
                        }}>
                          <FileText className="h-4 w-4 mr-2" /> Recibo
                        </Button>
                        {!p.anulado && <Button variant="outline" size="sm" onClick={async () => { try { await apiPost("/api/email/recibo", { reciboId: p.id }); toast.success("Recibo enviado o ya entregado."); } catch (e) { toast.error(e instanceof Error ? e.message : "Correo pendiente"); } }}>Reenviar correo</Button>}
                        {(userData?.rol === 'dueño' || userData?.rol === 'admin' || userData?.rol === 'superadmin') && (
                          <Button size="sm" variant="destructive" disabled={p.anulado} onClick={() => handleDeletePago({ id: p.id, anulado: p.anulado })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
            <DialogTitle className="text-amber-600">¿Anular este préstamo?</DialogTitle>
            <DialogDescription>
              El préstamo y sus cuotas conservarán el historial como anulados. Se generará una compensación del desembolso en caja. Solo procede si no hay cobros vigentes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="motivoAnulacionInput" className="text-xs font-semibold">
              Motivo de la anulación (mínimo 10 caracteres) *
            </Label>
            <Input
              id="motivoAnulacionInput"
              placeholder="Indica la razón por la cual se anula el préstamo..."
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              className="text-xs"
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeletePrestamo} disabled={isDeleting || motivoAnulacion.trim().length < 10}>
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Sí, anular crédito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
