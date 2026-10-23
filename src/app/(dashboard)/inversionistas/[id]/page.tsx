"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore";
import { InversionContrato, CuotaInversionista, PagoInversionista, Inversionista } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, 
  Landmark, 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  ExternalLink,
  Loader2,
  Building2,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { RegistrarPagoInversionistaDialog } from "@/components/inversionistas/RegistrarPagoInversionistaDialog";
import { format } from "date-fns";

export default function ContratoInversionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const contratoId = resolvedParams.id;

  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);

  const [contrato, setContrato] = useState<InversionContrato | null>(null);
  const [inversionista, setInversionista] = useState<Inversionista | null>(null);
  const [cuotas, setCuotas] = useState<CuotaInversionista[]>([]);
  const [pagos, setPagos] = useState<PagoInversionista[]>([]);

  useEffect(() => {
    if (!contratoId || !userData?.empresaId) return;

    setLoading(true);

    const unsubContrato = onSnapshot(doc(db, "inversion_contratos", contratoId), snap => {
      if (snap.exists()) {
        const cData = { id: snap.id, ...snap.data() } as InversionContrato;
        setContrato(cData);

        // Cargar datos del inversionista
        if (cData.inversionistaId) {
          onSnapshot(doc(db, "inversionistas", cData.inversionistaId), invSnap => {
            if (invSnap.exists()) {
              setInversionista({ id: invSnap.id, ...invSnap.data() } as Inversionista);
            }
          });
        }
      }
      setLoading(false);
    });

    const unsubCuotas = onSnapshot(
      query(collection(db, "cuotas_inversionistas"), where("empresaId", "==", userData.empresaId), where("inversionContratoId", "==", contratoId)),
      snap => {
        const list: CuotaInversionista[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as CuotaInversionista));
        list.sort((a, b) => a.numeroCuota - b.numeroCuota);
        setCuotas(list);
      }
    );

    const unsubPagos = onSnapshot(
      query(collection(db, "pagos_inversionistas"), where("empresaId", "==", userData.empresaId), where("inversionContratoId", "==", contratoId)),
      snap => {
        const list: PagoInversionista[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as PagoInversionista));
        setPagos(list);
      }
    );

    return () => {
      unsubContrato();
      unsubCuotas();
      unsubPagos();
    };
  }, [contratoId, userData?.empresaId]);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contrato) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Contrato de inversión no encontrado.</p>
        <Link href="/inversionistas">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Volver a Inversionistas
          </Button>
        </Link>
      </div>
    );
  }

  const pctCartera = contrato.montoTotal > 0 ? ((contrato.montoCartera / contrato.montoTotal) * 100).toFixed(0) : "0";
  const pctOtros = contrato.montoTotal > 0 ? ((contrato.montoOtros / contrato.montoTotal) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-6">
      {/* Botón Volver y Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <Link href="/inversionistas">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground p-0 h-auto hover:bg-transparent">
              <ArrowLeft className="h-3.5 w-3.5" /> Volver al listado de inversionistas
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Contrato: {contrato.inversionistaNombre}
            </h1>
            <Badge variant={contrato.estado === 'activo' ? 'default' : 'secondary'}>
              {contrato.estado === 'activo' ? 'Contrato Activo' : 'Liquidado Totalmente'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Cédula/RUC: {contrato.inversionistaIdentificacion || "N/A"} • Plazo: {contrato.plazoMeses} meses • Inicio: {contrato.fechaInicio}
          </p>
        </div>

        <RegistrarPagoInversionistaDialog
          contrato={contrato}
          triggerButton={
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <DollarSign className="h-4 w-4" /> Liquidar Abono / Cuota
            </Button>
          }
        />
      </div>

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold text-muted-foreground">Capital Inyectado</CardDescription>
            <CardTitle className="text-2xl font-bold">
              ${contrato.montoTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-[11px]">
                <span className="text-emerald-600 font-medium">Cartera: ${contrato.montoCartera.toFixed(2)} ({pctCartera}%)</span>
                <span className="text-amber-600 font-medium">Otros: ${contrato.montoOtros.toFixed(2)} ({pctOtros}%)</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${pctCartera}%` }} />
                <div className="bg-amber-500 h-full" style={{ width: `${pctOtros}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold text-purple-700 dark:text-purple-400">Rendimiento Pactado</CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              ${(contrato.totalInteresPagar || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-muted-foreground">
              {contrato.tieneInteres ? `${contrato.tasaInteresMensual}% mensual pactado` : "Sin interés (0%)"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Total Liquidado a la Fecha</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ${(contrato.totalPagado || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-muted-foreground">
              {pagos.length} liquidaciones registradas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-l-4 border-l-indigo-500">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold text-muted-foreground">Saldo Pendiente por Devolver</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              ${(contrato.saldoPendiente || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs text-muted-foreground">
              Total Contrato: ${(contrato.totalPagar || contrato.montoTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Datos Bancarios del Inversionista */}
      {inversionista?.banco && (
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Cuenta para Liquidaciones del Inversionista:</p>
                <p className="text-muted-foreground">
                  {inversionista.banco} • Cuenta de {inversionista.tipoCuenta}: <strong>{inversionista.numeroCuenta}</strong> • Titular: {inversionista.titularCuenta || inversionista.nombres}
                </p>
              </div>
            </div>
            <div className="text-muted-foreground">
              Teléfono: <strong>{inversionista.telefono}</strong>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla del Cronograma de Liquidaciones */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Cronograma de Liquidaciones Acordado
          </CardTitle>
          <CardDescription className="text-xs">
            Detalle mes a mes de las fechas en que se deben transferir los intereses y el capital al inversionista.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-16 text-center text-xs">#</TableHead>
                <TableHead className="text-xs">Fecha Vencimiento</TableHead>
                <TableHead className="text-right text-xs">Capital</TableHead>
                <TableHead className="text-right text-xs">Rendimiento / Interés</TableHead>
                <TableHead className="text-right text-xs font-bold">Total Cuota</TableHead>
                <TableHead className="text-right text-xs">Pagado</TableHead>
                <TableHead className="text-right text-xs">Saldo</TableHead>
                <TableHead className="text-center text-xs">Estado</TableHead>
                <TableHead className="text-right text-xs">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuotas.map(c => {
                const isVencida = c.estado !== 'pagada' && new Date(c.fechaVencimiento) < new Date();
                return (
                  <TableRow key={c.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="text-center font-bold">#{c.numeroCuota}</TableCell>
                    <TableCell className="font-medium">
                      <span className={isVencida ? "text-red-600 dark:text-red-400 font-bold" : ""}>
                        {c.fechaVencimiento}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">${c.capital.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-purple-600 dark:text-purple-400 font-medium">
                      ${c.interes.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-bold">${c.totalCuota.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                      ${(c.montoPagado || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ${(c.saldoRestante || (c.totalCuota - (c.montoPagado || 0))).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={c.estado === 'pagada' ? 'default' : isVencida ? 'destructive' : 'outline'}
                        className="text-[10px]"
                      >
                        {c.estado === 'pagada' ? 'Liquidada' : isVencida ? 'Por Liquidar' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.estado !== 'pagada' && (
                        <RegistrarPagoInversionistaDialog
                          contrato={contrato}
                          cuota={c}
                          triggerButton={
                            <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                              <DollarSign className="h-3 w-3" /> Liquidar
                            </Button>
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Historial de Pagos de este Contrato */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Liquidaciones Realizadas en este Contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-xs">Fecha</TableHead>
                <TableHead className="text-center text-xs">Cuota</TableHead>
                <TableHead className="text-right text-xs">Monto Liquidado</TableHead>
                <TableHead className="text-xs">Método / Cuenta</TableHead>
                <TableHead className="text-xs">Observaciones</TableHead>
                <TableHead className="text-xs">Registrado Por</TableHead>
                <TableHead className="text-center text-xs">Comprobante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-xs text-muted-foreground">
                    Aún no hay liquidaciones registradas para este contrato.
                  </TableCell>
                </TableRow>
              ) : (
                pagos.map(p => {
                  const fechaStr = p.fecha?.toDate ? p.fecha.toDate().toLocaleDateString() : (p.fecha ? new Date(p.fecha).toLocaleDateString() : "Reciente");
                  return (
                    <TableRow key={p.id} className="text-xs">
                      <TableCell className="font-medium">{fechaStr}</TableCell>
                      <TableCell className="text-center">{p.numeroCuota ? `#${p.numeroCuota}` : "Abono"}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                        ${p.monto.toFixed(2)}
                      </TableCell>
                      <TableCell className="capitalize">{p.metodo} ({p.cuentaOrigen})</TableCell>
                      <TableCell className="text-muted-foreground">{p.observaciones || "—"}</TableCell>
                      <TableCell>{p.registradoPor}</TableCell>
                      <TableCell className="text-center">
                        {p.comprobanteUrl ? (
                          <a href={p.comprobanteUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-primary">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
