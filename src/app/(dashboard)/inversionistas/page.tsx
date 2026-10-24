"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { Inversionista, InversionContrato, CuotaInversionista, PagoInversionista } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Landmark, 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ArrowUpRight, 
  ExternalLink,
  Loader2,
  FileText
} from "lucide-react";
import Link from "next/link";
import { NuevaInversionDialog } from "@/components/inversionistas/NuevaInversionDialog";
import { NuevoInversionistaDialog } from "@/components/inversionistas/NuevoInversionistaDialog";
import { RegistrarPagoInversionistaDialog } from "@/components/inversionistas/RegistrarPagoInversionistaDialog";
import { format, isThisMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function InversionistasPage() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);

  const [inversionistas, setInversionistas] = useState<Inversionista[]>([]);
  const [contratos, setContratos] = useState<InversionContrato[]>([]);
  const [cuotas, setCuotas] = useState<CuotaInversionista[]>([]);
  const [pagos, setPagos] = useState<PagoInversionista[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  // Suscripciones en tiempo real
  useEffect(() => {
    if (!userData?.empresaId) return;

    setLoading(true);

    const unsubInversionistas = onSnapshot(
      query(collection(db, "inversionistas"), where("empresaId", "==", userData.empresaId)),
      snap => {
        const list: Inversionista[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as Inversionista));
        setInversionistas(list);
      }
    );

    const unsubContratos = onSnapshot(
      query(collection(db, "inversion_contratos"), where("empresaId", "==", userData.empresaId), orderBy("createdAt", "desc")),
      snap => {
        const list: InversionContrato[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as InversionContrato));
        setContratos(list);
        setLoading(false);
      },
      err => {
        // Fallback sin orderBy si falta índice
        const unsubFallback = onSnapshot(
          query(collection(db, "inversion_contratos"), where("empresaId", "==", userData.empresaId)),
          s => {
            const list: InversionContrato[] = [];
            s.forEach(d => list.push({ id: d.id, ...d.data() } as InversionContrato));
            setContratos(list);
            setLoading(false);
          }
        );
      }
    );

    const unsubCuotas = onSnapshot(
      query(collection(db, "cuotas_inversionistas"), where("empresaId", "==", userData.empresaId)),
      snap => {
        const list: CuotaInversionista[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as CuotaInversionista));
        setCuotas(list);
      }
    );

    const unsubPagos = onSnapshot(
      query(collection(db, "pagos_inversionistas"), where("empresaId", "==", userData.empresaId)),
      snap => {
        const list: PagoInversionista[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as PagoInversionista));
        setPagos(list);
      }
    );

    return () => {
      unsubInversionistas();
      unsubContratos();
      unsubCuotas();
      unsubPagos();
    };
  }, [userData?.empresaId]);

  // Cálculos consolidados para KPIs
  const metrics = useMemo(() => {
    let totalCaptado = 0;
    let totalCartera = 0;
    let totalOtros = 0;
    let totalPendiente = 0;
    let totalLiquidado = 0;

    contratos.forEach(c => {
      totalCaptado += (c.montoTotal || 0);
      totalCartera += (c.montoCartera || 0);
      totalOtros += (c.montoOtros || 0);
      totalPendiente += (c.saldoPendiente || 0);
      totalLiquidado += (c.totalPagado || 0);
    });

    // Cuotas pendientes de este mes
    const cuotasEsteMes = cuotas.filter(c => {
      if (c.estado === 'pagada') return false;
      try {
        const f = parseISO(c.fechaVencimiento);
        return isThisMonth(f);
      } catch {
        return false;
      }
    });

    const compromisoMes = cuotasEsteMes.reduce((sum, c) => sum + (c.saldoRestante || (c.totalCuota - c.montoPagado)), 0);

    return {
      totalCaptado,
      totalCartera,
      totalOtros,
      totalPendiente,
      totalLiquidado,
      compromisoMes,
      cuotasEsteMesCount: cuotasEsteMes.length
    };
  }, [contratos, cuotas]);

  // Filtrado de contratos
  const contratosFiltrados = useMemo(() => {
    return contratos.filter(c => {
      const matchSearch = (c.inversionistaNombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.inversionistaIdentificacion || "").includes(searchTerm);
      const matchEstado = filtroEstado === "todos" || c.estado === filtroEstado;
      return matchSearch && matchEstado;
    });
  }, [contratos, searchTerm, filtroEstado]);

  // Próximas cuotas ordenadas por fecha
  const cuotasOrdenadas = useMemo(() => {
    return [...cuotas]
      .filter(c => c.estado !== 'pagada')
      .sort((a, b) => (a.fechaVencimiento > b.fechaVencimiento ? 1 : -1));
  }, [cuotas]);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando módulo de inversionistas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6 text-emerald-600" />
            Inversionistas y Fondeo de Capital
          </h1>
          <p className="text-sm text-muted-foreground">
            Control de capital inyectado por terceros, asignación de fondos y liquidación mensual de rendimientos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <NuevoInversionistaDialog />
          <NuevaInversionDialog />
        </div>
      </div>

      {/* Tarjetas de Métricas (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-card shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">Total Fondeo Captado</CardDescription>
            <CardTitle className="text-xl font-bold">
              ${metrics.totalCaptado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-[11px] text-muted-foreground">
              {contratos.length} contrato{contratos.length !== 1 ? 's' : ''} registrado{contratos.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-emerald-700 dark:text-emerald-400">
              Asignado a Cartera
            </CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              ${metrics.totalCartera.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Fondo prestable activo</span>
              <Badge variant="outline" className="text-[10px] text-emerald-600">
                {metrics.totalCaptado > 0 ? ((metrics.totalCartera / metrics.totalCaptado) * 100).toFixed(0) : 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-l-4 border-l-amber-500">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-amber-700 dark:text-amber-400">
              Asignado a Otros Gastos
            </CardDescription>
            <CardTitle className="text-xl font-bold text-amber-600 dark:text-amber-400">
              ${metrics.totalOtros.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Gastos / Operativo</span>
              <Badge variant="outline" className="text-[10px] text-amber-600">
                {metrics.totalCaptado > 0 ? ((metrics.totalOtros / metrics.totalCaptado) * 100).toFixed(0) : 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-l-4 border-l-indigo-500">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">Por Devolver a Inversionistas</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">
              ${metrics.totalPendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-[11px] text-muted-foreground">
              Liquidado: ${metrics.totalLiquidado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-purple-700 dark:text-purple-400">
              Compromiso Este Mes
            </CardDescription>
            <CardTitle className="text-xl font-bold text-purple-600 dark:text-purple-400">
              ${metrics.compromisoMes.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-[11px] text-muted-foreground">
              {metrics.cuotasEsteMesCount} cuota{metrics.cuotasEsteMesCount !== 1 ? 's' : ''} a pagar en {format(new Date(), "MMMM", { locale: es })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pestañas de Gestión */}
      <Tabs defaultValue="contratos" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto w-full max-w-xl">
          <TabsTrigger value="contratos" className="text-xs">Contratos ({contratos.length})</TabsTrigger>
          <TabsTrigger value="cronograma" className="text-xs">Próximos Pagos ({cuotasOrdenadas.length})</TabsTrigger>
          <TabsTrigger value="directorio" className="text-xs">Inversionistas ({inversionistas.length})</TabsTrigger>
          <TabsTrigger value="liquidaciones" className="text-xs">Historial Pagos ({pagos.length})</TabsTrigger>
        </TabsList>

        {/* Tab 1: Contratos de Inversión */}
        <TabsContent value="contratos" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-card p-3 rounded-lg border">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar inversionista..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant={filtroEstado === "todos" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFiltroEstado("todos")}
                className="text-xs h-8"
              >
                Todos
              </Button>
              <Button
                variant={filtroEstado === "activo" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFiltroEstado("activo")}
                className="text-xs h-8"
              >
                Activos
              </Button>
              <Button
                variant={filtroEstado === "liquidado" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFiltroEstado("liquidado")}
                className="text-xs h-8"
              >
                Liquidados
              </Button>
            </div>
          </div>

          {contratosFiltrados.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Landmark className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="font-medium">No se encontraron contratos de inversión</p>
              <p className="text-xs mt-1">Registra tu primer fondeo haciendo clic en "Nueva Inversión".</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contratosFiltrados.map(c => {
                const pctCartera = c.montoTotal > 0 ? ((c.montoCartera / c.montoTotal) * 100).toFixed(0) : "0";
                const pctOtros = c.montoTotal > 0 ? ((c.montoOtros / c.montoTotal) * 100).toFixed(0) : "0";
                const cuotasContrato = cuotas.filter(cu => cu.inversionContratoId === c.id);
                const proximaCuota = cuotasContrato.find(cu => cu.estado !== 'pagada');

                return (
                  <Card key={c.id} className="hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-primary" />
                    
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <CardTitle className="text-base font-bold text-foreground">
                            {c.inversionistaNombre}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            C.I./RUC: {c.inversionistaIdentificacion || "N/A"} • Plazo: {c.plazoMeses} meses
                          </CardDescription>
                        </div>
                        <Badge variant={c.estado === 'activo' ? 'default' : 'secondary'} className="text-[10px]">
                          {c.estado === 'activo' ? 'Activo' : 'Liquidado'}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3 text-xs">
                      {/* Cifra Total */}
                      <div className="flex justify-between items-baseline border-b pb-2">
                        <span className="text-muted-foreground">Capital Total:</span>
                        <span className="text-lg font-bold text-foreground">
                          ${c.montoTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Desglose Cartera vs Otros */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Cartera: ${c.montoCartera.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({pctCartera}%)
                          </span>
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            Otros: ${c.montoOtros.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({pctOtros}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${pctCartera}%` }} />
                          <div className="bg-amber-500 h-full" style={{ width: `${pctOtros}%` }} />
                        </div>
                      </div>

                      {/* Condiciones */}
                      <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2 rounded-md">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Rendimiento:</span>
                          <span className="font-semibold">
                            {c.tieneInteres ? `${c.tasaInteresMensual}% mensual` : "Sin interés (0%)"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Saldo por Pagar:</span>
                          <span className="font-bold text-foreground">
                            ${(c.saldoPendiente || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Próximo pago */}
                      {proximaCuota && (
                        <div className="text-[11px] flex items-center justify-between p-2 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Próx. Cuota #{proximaCuota.numeroCuota} ({proximaCuota.fechaVencimiento}):
                          </span>
                          <span className="font-bold">${proximaCuota.totalCuota.toFixed(2)}</span>
                        </div>
                      )}
                    </CardContent>

                    <div className="p-4 pt-0 border-t flex items-center justify-between gap-2 mt-2">
                      <Link href={`/inversionistas/${c.id}`} className="w-full">
                        <Button variant="outline" size="sm" className="w-full text-xs gap-1">
                          Ver Cronograma y Detalles <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>

                      {c.estado === 'activo' && proximaCuota && (
                        <RegistrarPagoInversionistaDialog
                          contrato={c}
                          cuota={proximaCuota}
                          triggerButton={
                            <Button size="sm" className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                              <DollarSign className="h-3.5 w-3.5" /> Liquidar
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Próximos Pagos y Cronograma General */}
        <TabsContent value="cronograma" className="space-y-3">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-500" />
                Cronograma de Liquidaciones Pendientes
              </CardTitle>
              <CardDescription className="text-xs">
                Todas las cuotas programadas para devolver capital o pagar rendimientos a inversionistas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs">Vencimiento</TableHead>
                    <TableHead className="text-xs">Inversionista</TableHead>
                    <TableHead className="text-center text-xs">Cuota #</TableHead>
                    <TableHead className="text-right text-xs">Capital</TableHead>
                    <TableHead className="text-right text-xs">Rendimiento</TableHead>
                    <TableHead className="text-right text-xs font-bold">Total Cuota</TableHead>
                    <TableHead className="text-center text-xs">Estado</TableHead>
                    <TableHead className="text-right text-xs">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cuotasOrdenadas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-xs text-muted-foreground">
                        No hay cuotas pendientes con inversionistas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cuotasOrdenadas.map(cu => {
                      const contrato = contratos.find(c => c.id === cu.inversionContratoId);
                      const inv = inversionistas.find(i => i.id === cu.inversionistaId);
                      const isVencida = new Date(cu.fechaVencimiento) < new Date();

                      return (
                        <TableRow key={cu.id} className="text-xs hover:bg-muted/40">
                          <TableCell className="font-medium flex items-center gap-1.5">
                            {isVencida && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                            <span className={isVencida ? "text-red-600 dark:text-red-400 font-bold" : ""}>
                              {cu.fechaVencimiento}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {contrato?.inversionistaNombre || inv?.nombres || "Inversionista"}
                          </TableCell>
                          <TableCell className="text-center">#{cu.numeroCuota}</TableCell>
                          <TableCell className="text-right">${cu.capital.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                            ${cu.interes.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-bold">${cu.totalCuota.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={isVencida ? "destructive" : "outline"} className="text-[10px]">
                              {isVencida ? "Por Liquidar" : "Pendiente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {contrato && (
                              <RegistrarPagoInversionistaDialog
                                contrato={contrato}
                                cuota={cu}
                                triggerButton={
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700">
                                    <DollarSign className="h-3 w-3" /> Pagar
                                  </Button>
                                }
                              />
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
        </TabsContent>

        {/* Tab 3: Directorio de Inversionistas */}
        <TabsContent value="directorio" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inversionistas.length === 0 ? (
              <Card className="col-span-full p-8 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p>No hay inversionistas registrados</p>
              </Card>
            ) : (
              inversionistas.map(inv => {
                const contratosInv = contratos.filter(c => c.inversionistaId === inv.id);
                const totalInvertido = contratosInv.reduce((sum, c) => sum + (c.montoTotal || 0), 0);
                const totalPendiente = contratosInv.reduce((sum, c) => sum + (c.saldoPendiente || 0), 0);

                return (
                  <Card key={inv.id} className="p-4 space-y-3 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{inv.nombres} {inv.apellidos}</h4>
                        <p className="text-muted-foreground text-[11px]">C.I./RUC: {inv.identificacion}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-emerald-600">
                        {contratosInv.length} contrato{contratosInv.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded-md">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Total Aportado:</span>
                        <span className="font-bold text-foreground">
                          ${totalInvertido.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Saldo Pendiente:</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          ${totalPendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-muted-foreground text-[11px] border-t pt-2">
                      <p><strong>Teléfono:</strong> {inv.telefono}</p>
                      {inv.correo && <p><strong>Correo:</strong> {inv.correo}</p>}
                      {inv.banco && (
                        <p><strong>Banco:</strong> {inv.banco} ({inv.tipoCuenta}) • {inv.numeroCuenta}</p>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Tab 4: Historial de Pagos / Liquidaciones Realizadas */}
        <TabsContent value="liquidaciones" className="space-y-3">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Historial de Liquidaciones a Inversionistas
              </CardTitle>
              <CardDescription className="text-xs">
                Bitácora de pagos y devoluciones realizadas a fondeadores.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Inversionista</TableHead>
                    <TableHead className="text-center text-xs">Cuota</TableHead>
                    <TableHead className="text-right text-xs">Monto Pagado</TableHead>
                    <TableHead className="text-xs">Método / Cuenta</TableHead>
                    <TableHead className="text-xs">Registrado Por</TableHead>
                    <TableHead className="text-center text-xs">Comprobante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-xs text-muted-foreground">
                        Aún no se han registrado liquidaciones a inversionistas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagos.map(p => {
                      const fechaStr = p.fecha?.toDate ? p.fecha.toDate().toLocaleDateString() : (p.fecha ? new Date(p.fecha).toLocaleDateString() : "Reciente");
                      return (
                        <TableRow key={p.id} className="text-xs">
                          <TableCell className="font-medium">{fechaStr}</TableCell>
                          <TableCell className="font-semibold">{p.inversionistaNombre || "Inversionista"}</TableCell>
                          <TableCell className="text-center">{p.numeroCuota ? `#${p.numeroCuota}` : "Abono"}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                            ${p.monto.toFixed(2)}
                          </TableCell>
                          <TableCell className="capitalize">{p.metodo} ({p.cuentaOrigen})</TableCell>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
