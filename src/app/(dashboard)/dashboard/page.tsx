"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  PiggyBank, 
  TrendingUp, 
  CreditCard, 
  DollarSign, 
  AlertCircle, 
  Loader2, 
  Calendar,
  CalendarRange,
  RotateCcw
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { PagosChart } from "@/components/dashboard/PagosChart";
import { UltimosMovimientos } from "@/components/dashboard/UltimosMovimientos";
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval 
} from "date-fns";
import { es } from "date-fns/locale";

type PeriodoTipo = 'hoy' | 'semana' | 'mes' | 'historico' | 'personalizado';

export default function DashboardPage() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);

  // Estados de datos crudos
  const [empresaData, setEmpresaData] = useState<any>(null);
  const [rawClientes, setRawClientes] = useState<any[]>([]);
  const [rawPrestamos, setRawPrestamos] = useState<any[]>([]);
  const [rawPagos, setRawPagos] = useState<any[]>([]);
  const [rawCuotasVencidas, setRawCuotasVencidas] = useState<any[]>([]);

  // Filtro de fechas (Por defecto: 'mes' -> mes en curso)
  const [periodo, setPeriodo] = useState<PeriodoTipo>('mes');
  const [fechaDesde, setFechaDesde] = useState<string>(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [fechaHasta, setFechaHasta] = useState<string>(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  useEffect(() => {
    if (!userData?.empresaId) return;

    let clientesMap = new Map();

    const unsubEmpresa = onSnapshot(
      doc(db, "empresas", userData.empresaId),
      (snap) => {
        if (snap.exists()) {
          setEmpresaData(snap.data());
        }
      }
    );

    const unsubClientes = onSnapshot(
      query(collection(db, "clientes"), where("empresaId", "==", userData.empresaId)), 
      (snap) => {
        const clientes: any[] = [];
        snap.forEach(d => {
          const cData: any = { id: d.id, ...d.data() };
          clientes.push(cData);
          clientesMap.set(d.id, `${cData.nombres || ''} ${cData.apellidos || ''}`.trim());
        });
        setRawClientes(clientes);
      }
    );

    const unsubPrestamos = onSnapshot(
      query(collection(db, "prestamos"), where("empresaId", "==", userData.empresaId)), 
      (snap) => {
        const prestamos: any[] = [];
        snap.forEach(d => {
          prestamos.push({ id: d.id, ...d.data() });
        });
        setRawPrestamos(prestamos);
      }
    );

    const unsubPagos = onSnapshot(
      query(collection(db, "pagos"), where("empresaId", "==", userData.empresaId), orderBy("fecha", "desc")), 
      (snap) => {
        const pagos: any[] = [];
        snap.forEach(d => {
          const pd = d.data();
          pagos.push({ 
            id: d.id, 
            ...pd,
            clienteNombre: pd.clienteNombre || clientesMap.get(pd.clienteId) || 'Cliente Desconocido'
          });
        });
        setRawPagos(pagos);
      }
    );

    const unsubMora = onSnapshot(
      query(collection(db, "cuotas"), where("empresaId", "==", userData.empresaId), where("estado", "==", "vencida")), 
      (snap) => {
        const cuotas: any[] = [];
        snap.forEach(d => {
          cuotas.push({ id: d.id, ...d.data() });
        });
        setRawCuotasVencidas(cuotas);
        setLoading(false);
      }
    );

    return () => {
      unsubEmpresa();
      unsubPrestamos();
      unsubPagos();
      unsubClientes();
      unsubMora();
    };
  }, [userData?.empresaId]);

  // Cálculo del rango de fecha activo
  const dateRange = useMemo(() => {
    const now = new Date();
    if (periodo === 'hoy') {
      return { start: startOfDay(now), end: endOfDay(now), label: "Hoy" };
    }
    if (periodo === 'semana') {
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), label: "Esta Semana" };
    }
    if (periodo === 'mes') {
      return { 
        start: startOfMonth(now), 
        end: endOfMonth(now), 
        label: `Mes en curso (${format(now, "MMMM yyyy", { locale: es })})` 
      };
    }
    if (periodo === 'personalizado') {
      const s = fechaDesde ? startOfDay(new Date(fechaDesde + "T00:00:00")) : startOfMonth(now);
      const e = fechaHasta ? endOfDay(new Date(fechaHasta + "T23:59:59")) : endOfMonth(now);
      return { start: s, end: e, label: `${format(s, "dd/MM/yyyy")} - ${format(e, "dd/MM/yyyy")}` };
    }
    // Historico
    return { start: null, end: null, label: "Histórico Completo" };
  }, [periodo, fechaDesde, fechaHasta]);

  // Métricas calculadas según el filtro
  const filteredMetrics = useMemo(() => {
    const isWithinRange = (dateInput: any) => {
      if (!dateRange.start || !dateRange.end) return true; // Histórico
      if (!dateInput) return false;
      const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
      if (isNaN(d.getTime())) return false;
      return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
    };

    // Capital Invertido Total (Acumulado en caja)
    const capitalInicial = empresaData?.capitalInicial || 0;
    const totalInyecciones = (empresaData?.inyeccionesCapital || []).reduce((sum: number, item: any) => sum + (item.monto || 0), 0);
    const capitalInvertido = capitalInicial + totalInyecciones;

    // Préstamos filtrados por período
    const prestamosFiltrados = rawPrestamos.filter(p => {
      const f = p.fechaDesembolso ? new Date(p.fechaDesembolso + "T12:00:00") : (p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : null));
      return isWithinRange(f);
    });

    const capitalPrestadoPeriodo = prestamosFiltrados.reduce((sum, p) => sum + (p.monto || 0), 0);
    const interesProyectadoPeriodo = prestamosFiltrados.reduce((sum, p) => sum + (p.totalInteres || 0), 0);

    // Pagos filtrados por período
    const pagosFiltrados = rawPagos.filter(p => isWithinRange(p.fecha));
    const totalRecaudadoPeriodo = pagosFiltrados.reduce((sum, p) => sum + (p.monto || 0), 0);

    // Caja Disponible (Total Histórico Real: Inversión + Total Pagos Históricos - Total Prestado Histórico)
    const totalPrestadoHistorico = rawPrestamos.reduce((sum, p) => sum + (p.monto || 0), 0);
    const totalPagosHistorico = rawPagos.reduce((sum, p) => sum + (p.monto || 0), 0);
    const cajaDisponible = capitalInvertido - totalPrestadoHistorico + totalPagosHistorico;

    // Mora (Riesgo)
    let moraVencido = 0;
    const clientesMora = new Set();
    rawCuotasVencidas.forEach(c => {
      moraVencido += ((c.totalCuota || 0) - (c.montoPagado || 0));
      if (c.clienteId) clientesMora.add(c.clienteId);
    });

    // Retorno bruto del período
    const porcentajeRetorno = capitalPrestadoPeriodo > 0 
      ? ((totalRecaudadoPeriodo / capitalPrestadoPeriodo) * 100).toFixed(1) 
      : "0.0";

    return {
      capitalInvertido,
      cajaDisponible,
      capitalPrestadoPeriodo,
      totalRecaudadoPeriodo,
      interesProyectadoPeriodo,
      moraVencido,
      clientesMoraCount: clientesMora.size,
      porcentajeRetorno,
      pagosFiltrados,
      prestamosFiltradosCount: prestamosFiltrados.length
    };
  }, [empresaData, rawPrestamos, rawPagos, rawCuotasVencidas, dateRange]);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 6 Tarjetas del Dashboard
  const summaryCards = [
    { 
      title: "Capital Invertido", 
      value: `$${filteredMetrics.capitalInvertido.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: PiggyBank, 
      trend: "Inversión total registrada",
      color: "text-blue-500"
    },
    { 
      title: "Caja Disponible", 
      value: `$${filteredMetrics.cajaDisponible.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: Wallet, 
      trend: "Liquidez actual",
      color: "text-emerald-500"
    },
    { 
      title: "Capital Prestado", 
      value: `$${filteredMetrics.capitalPrestadoPeriodo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: CreditCard, 
      trend: periodo === 'historico' ? "Colocación total" : `${filteredMetrics.prestamosFiltradosCount} créditos en el período`,
      color: "text-indigo-500"
    },
    { 
      title: "Total Recaudado", 
      value: `$${filteredMetrics.totalRecaudadoPeriodo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: DollarSign, 
      trend: `${filteredMetrics.porcentajeRetorno}% retorno período`,
      color: "text-emerald-600 dark:text-emerald-400"
    },
    { 
      title: "Interés Proyectado", 
      value: `$${filteredMetrics.interesProyectadoPeriodo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: TrendingUp, 
      trend: "Ganancia esperada período",
      color: "text-purple-500"
    },
    { 
      title: "Mora (Riesgo)", 
      value: `$${filteredMetrics.moraVencido.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: AlertCircle, 
      trend: `${filteredMetrics.clientesMoraCount} clientes en atraso`, 
      alert: filteredMetrics.clientesMoraCount > 0,
      color: "text-rose-500"
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado y Barra de Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Resumen financiero con corte periódico de cartera.
          </p>
        </div>

        {/* Controles de Filtro de Fecha */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Botones de Selección Rápida */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
            <Button 
              type="button" 
              size="sm" 
              variant={periodo === 'hoy' ? 'default' : 'ghost'} 
              className="text-xs h-7 px-2.5"
              onClick={() => setPeriodo('hoy')}
            >
              Hoy
            </Button>
            <Button 
              type="button" 
              size="sm" 
              variant={periodo === 'semana' ? 'default' : 'ghost'} 
              className="text-xs h-7 px-2.5"
              onClick={() => setPeriodo('semana')}
            >
              Semana
            </Button>
            <Button 
              type="button" 
              size="sm" 
              variant={periodo === 'mes' ? 'default' : 'ghost'} 
              className="text-xs h-7 px-2.5 font-semibold"
              onClick={() => {
                const now = new Date();
                setFechaDesde(format(startOfMonth(now), "yyyy-MM-dd"));
                setFechaHasta(format(endOfMonth(now), "yyyy-MM-dd"));
                setPeriodo('mes');
              }}
            >
              Este Mes
            </Button>
            <Button 
              type="button" 
              size="sm" 
              variant={periodo === 'historico' ? 'default' : 'ghost'} 
              className="text-xs h-7 px-2.5"
              onClick={() => setPeriodo('historico')}
            >
              Histórico
            </Button>
            <Button 
              type="button" 
              size="sm" 
              variant={periodo === 'personalizado' ? 'default' : 'ghost'} 
              className="text-xs h-7 px-2.5 flex items-center gap-1"
              onClick={() => setPeriodo('personalizado')}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Rango
            </Button>
          </div>
        </div>
      </div>

      {/* Rango Personalizado Expandible */}
      {periodo === 'personalizado' && (
        <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-lg border shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-medium">Filtrar por Rango:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Desde:</span>
            <Input 
              type="date" 
              value={fechaDesde} 
              onChange={e => setFechaDesde(e.target.value)} 
              className="h-8 text-xs w-[140px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Hasta:</span>
            <Input 
              type="date" 
              value={fechaHasta} 
              onChange={e => setFechaHasta(e.target.value)} 
              className="h-8 text-xs w-[140px]"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {dateRange.label}
          </Badge>
        </div>
      )}

      {/* Indicador del Período Activo */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span>Mostrando métricas para: <strong className="text-foreground capitalize">{dateRange.label}</strong></span>
        </div>
        {periodo !== 'mes' && (
          <Button 
            variant="link" 
            size="sm" 
            className="h-auto p-0 text-xs text-primary"
            onClick={() => setPeriodo('mes')}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Volver al Mes en Curso
          </Button>
        )}
      </div>

      {/* 6 Tarjetas en 1 Sola Fila Horizontal en Pantallas Grandes (lg:grid-cols-6) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card, index) => (
          <Card 
            key={index} 
            className={`transition-all duration-200 hover:shadow-md ${
              card.alert 
                ? "border-destructive/50 bg-destructive/5" 
                : "hover:border-primary/40 bg-card"
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground truncate pr-1">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 shrink-0 ${card.alert ? "text-destructive" : card.color || "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent className="p-3.5 pt-1">
              <div className={`text-lg sm:text-xl xl:text-2xl font-bold tracking-tight truncate ${card.alert ? "text-destructive" : ""}`}>
                {card.value}
              </div>
              <p className={`text-[11px] mt-1 truncate ${card.alert ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {card.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Gráfico y Últimos Movimientos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 pt-2">
        <Card className="col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Evolución de Ingresos (Pagos)</CardTitle>
                <p className="text-xs text-muted-foreground">Comportamiento de recaudación en el período seleccionado.</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {filteredMetrics.pagosFiltrados.length} pagos
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pl-0 pb-2">
            <PagosChart data={filteredMetrics.pagosFiltrados} />
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Últimos Movimientos</CardTitle>
                <p className="text-xs text-muted-foreground">Transacciones recientes registradas.</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {periodo === 'mes' ? 'Este Mes' : dateRange.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <UltimosMovimientos data={filteredMetrics.pagosFiltrados} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

