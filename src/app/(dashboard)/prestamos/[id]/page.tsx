"use client";

import { useEffect, useState, use } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy, writeBatch, onSnapshot } from "firebase/firestore";
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
import { LoadError } from "@/components/ListPagination";
import { collectors } from "@/lib/permissions";

export default function PrestamoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { userData } = useAuth();
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lastReceipt, setLastReceipt] = useState<{ id: string; mail: 'pending' | 'accepted' } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!id || !userData?.empresaId) return;

    const ready = new Set<string>();
    const mark = (name: string) => { ready.add(name); if (ready.size === 3) setLoading(false); };
    const failed = () => { setLoadError('No se pudo cargar el detalle completo del crédito.'); setLoading(false); };
    const unsubPrestamo = onSnapshot(doc(db, "prestamos", id), (docSnap) => {
      if (docSnap.exists()) {
        setPrestamo({ id: docSnap.id, ...docSnap.data() } as Prestamo); mark("credito");
      } else {
        router.push("/prestamos");
      }
    }, failed);

    const unsubCuotas = onSnapshot(query(collection(db, "cuotas"), where("empresaId", "==", userData.empresaId), where("prestamoId", "==", id)), (snap) => {
      setCuotas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cuota)).sort((a,b) => a.numeroCuota - b.numeroCuota)); mark("cuotas");
    }, failed);

    const unsubPagos = onSnapshot(query(collection(db, "pagos"), where("empresaId", "==", userData!.empresaId), where("prestamoId", "==", id)), (snap) => {
      const pagosData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      pagosData.sort((a: any, b: any) => {
        const dateA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const dateB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setPagos(pagosData); mark("pagos");
    }, (error) => {
      console.error("Error al obtener pagos:", error);
      failed();
    });

    return () => {
      unsubPrestamo();
      unsubCuotas();
      unsubPagos();
    };
  }, [id, router, userData?.empresaId]);

  const fetchData = (receiptId: string) => setLastReceipt({ id: receiptId, mail: 'pending' });
  const receiptStatus = (receiptId: string, mail: 'pending' | 'accepted') => setLastReceipt(previous => previous?.id === receiptId ? { id: receiptId, mail } : previous);
  if (loadError) return <LoadError message={loadError} />;

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando detalles del préstamo...</div>;
  if (!prestamo) return null;

  const cuotasPagadas = cuotas.filter(c => c.estado === 'pagada').length;
  const totalCuotas = prestamo.numeroCuotas || cuotas.length;
  const porcentajePagado = totalCuotas > 0 ? Math.min(100, (cuotasPagadas / totalCuotas) * 100) : 0;

  return (
    <div className="space-y-6">
      {lastReceipt && <div role="status" className="rounded-xl border bg-card p-4 text-sm space-y-2"><p className="font-semibold">Cobro guardado · Referencia {lastReceipt.id}</p><p>{lastReceipt.mail === 'accepted' ? 'La solicitud de correo fue aceptada. Su entrega depende del proveedor.' : 'El correo está pendiente o no pudo enviarse. El cobro ya está registrado; no lo registres nuevamente.'}</p><a className="underline" href={'#recibo-' + lastReceipt.id}>Consultar recibo en el historial</a></div>}

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
        <div className="flex flex-wrap gap-2 sm:justify-end">
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
          {prestamo.estado !== 'completado' && userData && collectors.includes(userData.rol) && (
            <RegistrarPagoDialog prestamo={prestamo} cuotas={cuotas} onPagoRegistrado={fetchData} onReceiptStatus={receiptStatus} />
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

            <div className="pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Progreso ({cuotasPagadas}/{totalCuotas})</span>
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
             <div className="min-w-0 max-w-full border rounded-md overflow-auto max-h-[500px] bg-card/50">
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
            <div className="border rounded-md overflow-auto max-h-[400px] bg-card/50">
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
                    <tr key={p.id} id={"recibo-" + p.id} className="border-t hover:bg-muted/50 target:bg-muted">
                      <td className="p-3">{p.fecha?.toDate ? new Date(p.fecha.toDate()).toLocaleString() : 'N/A'}</td>
                      <td className="p-3 font-bold text-green-600">${p.monto.toFixed(2)}</td>
                      <td className="p-3 capitalize">{p.metodo || p.metodoPago || 'Efectivo'}</td>
                      <td className="p-3 text-muted-foreground">{p.registradoPor || 'Sistema'}</td>
                      <td className="p-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={async () => {
                          try {
                            const { generarReciboPago } = await import("@/lib/pdfGenerator");
                            const empresaSnap = await getDoc(doc(db, "empresas", prestamo.empresaId));
                            const clienteSnap = await getDoc(doc(db, "clientes", prestamo.clienteId));
                            await generarReciboPago({ ...p, fecha: p.fecha?.toDate ? p.fecha.toDate().toISOString() : new Date().toISOString() }, prestamo, clienteSnap.data(), empresaSnap.data());
                          } catch (e) {
                            console.error(e); toast.error("No se pudo generar el recibo. El cobro permanece registrado.");
                          }
                        }}>
                          <FileText className="h-4 w-4 mr-2" /> Recibo
                        </Button>

                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <details className="rounded-lg border bg-card p-4 text-sm"><summary className="cursor-pointer font-medium">Correcciones del historial financiero</summary><p className="mt-3 text-muted-foreground">Los créditos y cobros se conservan. Para corregir un registro, crea una gestión administrativa y adjunta la referencia; los reversos requieren revisión y conciliación.</p><Link className="mt-3 inline-block underline" href={'/gestion?cliente=' + prestamo.clienteId}>Crear gestión de revisión</Link></details>
    </div>
  );
}
