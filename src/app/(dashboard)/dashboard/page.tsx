"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, DollarSign, AlertCircle, Loader2 } from "lucide-react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Prestamo, Cliente } from "@/types";

import { useAuth } from "@/contexts/AuthContext";
import { PagosChart } from "@/components/dashboard/PagosChart";
import { UltimosMovimientos } from "@/components/dashboard/UltimosMovimientos";

export default function DashboardPage() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    capitalPrestado: 0,
    capitalRecuperado: 0,
    clientesActivos: 0,
    moraVencido: 0,
    clientesMoraCount: 0
  });
  const [pagosList, setPagosList] = useState<any[]>([]);

  useEffect(() => {
    if (!userData?.empresaId) return;

    let clientesMap = new Map();

    const unsubClientes = onSnapshot(
      query(collection(db, "clientes"), where("empresaId", "==", userData.empresaId)), 
      (snap) => {
        let activos = 0;
        snap.forEach(d => {
          if (d.data().estado === "activo") activos++;
          clientesMap.set(d.id, `${d.data().nombres || ''} ${d.data().apellidos || ''}`.trim());
        });
        setStats(s => ({ ...s, clientesActivos: activos }));
        
        // Refrescar pagos si ya están cargados para que tomen el nombre actualizado
        setPagosList(prev => prev.map(p => ({
          ...p,
          clienteNombre: p.clienteNombre || clientesMap.get(p.clienteId) || 'Cliente Desconocido'
        })));
      }
    );

    const unsubPrestamos = onSnapshot(
      query(collection(db, "prestamos"), where("empresaId", "==", userData.empresaId)), 
      (snap) => {
        let cp = 0;
        snap.forEach(d => cp += d.data().monto);
        setStats(s => ({ ...s, capitalPrestado: cp }));
      }
    );

    const unsubPagos = onSnapshot(
      query(collection(db, "pagos"), where("empresaId", "==", userData.empresaId), orderBy("fecha", "desc")), 
      (snap) => {
        let cr = 0;
        const pagosData: any[] = [];
        snap.forEach(d => {
          const pd = d.data();
          cr += pd.monto;
          pagosData.push({ 
            id: d.id, 
            ...pd,
            clienteNombre: pd.clienteNombre || clientesMap.get(pd.clienteId) || 'Cliente Desconocido'
          });
        });
        setStats(s => ({ ...s, capitalRecuperado: cr }));
        setPagosList(pagosData);
      }
    );

    const unsubMora = onSnapshot(
      query(collection(db, "cuotas"), where("empresaId", "==", userData.empresaId), where("estado", "==", "vencida")), 
      (snap) => {
        let mv = 0;
        const cMora = new Set();
        snap.forEach(d => {
          const data = d.data();
          mv += (data.totalCuota - data.montoPagado);
          cMora.add(data.clienteId);
        });
        setStats(s => ({ ...s, moraVencido: mv, clientesMoraCount: cMora.size }));
        setLoading(false);
      }
    );

    return () => {
      unsubPrestamos();
      unsubPagos();
      unsubClientes();
      unsubMora();
    };
  }, []);

  if (loading) {
    return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const summaryCards = [
    { title: "Capital Prestado", value: `$${stats.capitalPrestado.toFixed(2)}`, icon: CreditCard, trend: "Acumulado histórico" },
    { title: "Capital Recuperado", value: `$${stats.capitalRecuperado.toFixed(2)}`, icon: DollarSign, trend: `${stats.capitalPrestado > 0 ? ((stats.capitalRecuperado / stats.capitalPrestado)*100).toFixed(1) : 0}% del capital` },
    { title: "Clientes Activos", value: stats.clientesActivos.toString(), icon: Users, trend: "Actualmente" },
    { title: "Mora (Vencido)", value: `$${stats.moraVencido.toFixed(2)}`, icon: AlertCircle, trend: `${stats.clientesMoraCount} clientes en rojo`, alert: stats.clientesMoraCount > 0 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Resumen general de tu cartera de préstamos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card, index) => (
          <Card key={index} className={card.alert ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.alert ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.alert ? "text-destructive" : ""}`}>{card.value}</div>
              <p className={`text-xs mt-1 ${card.alert ? "text-destructive/80" : "text-muted-foreground"}`}>
                {card.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Evolución de Ingresos (Pagos)</CardTitle>
          </CardHeader>
          <CardContent className="pl-0 pb-2">
            <PagosChart data={pagosList} />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Últimos Movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <UltimosMovimientos data={pagosList} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
