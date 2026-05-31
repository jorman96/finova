import { adminDb } from "@/lib/firebase-admin";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreGauge } from "@/components/clientes/ScoreGauge";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LogOut, Calendar, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

export default async function PortalClienteDashboard({ params }: { params: Promise<{ empresaId: string, clienteId: string }> }) {
  const resolvedParams = await params;
  const { empresaId, clienteId } = resolvedParams;

  // Fetch Empresa
  const empresaSnap = await adminDb.collection("empresas").doc(empresaId).get();
  if (!empresaSnap.exists || empresaSnap.data()?.estado !== 'activa') {
    notFound();
  }
  const empresa = empresaSnap.data() as any;

  // Fetch Cliente
  const clienteSnap = await adminDb.collection("clientes").doc(clienteId).get();
  if (!clienteSnap.exists || clienteSnap.data()?.empresaId !== empresaId) {
    redirect(`/portal/${empresaId}`);
  }
  const cliente = clienteSnap.data() as any;

  // Fetch Todos los Préstamos
  const todosPrestamosSnap = await adminDb.collection("prestamos")
    .where("clienteId", "==", clienteId)
    .get();
  
  const todosPrestamos = todosPrestamosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const prestamosActivos = todosPrestamos.filter((p: any) => p.estado === 'activo' || p.estado === 'moroso');
  const prestamosPasados = todosPrestamos.filter((p: any) => p.estado === 'completado' || p.estado === 'cancelado');

  // Para cada préstamo activo, buscar la próxima cuota pendiente
  const prestamosConCuotas = await Promise.all(prestamosActivos.map(async (p: any) => {
    const cuotasSnap = await adminDb.collection("cuotas")
      .where("prestamoId", "==", p.id)
      .where("estado", "in", ["pendiente", "vencida", "parcial"])
      .orderBy("numeroCuota", "asc")
      .limit(1)
      .get();
    
    return {
      ...p,
      proximaCuota: cuotasSnap.empty ? null : cuotasSnap.docs[0].data()
    };
  }));

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: empresa.moneda || "USD" }).format(amount);
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      {/* Header Corporativo */}
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {empresa.logoUrl ? (
              <img src={empresa.logoUrl} alt="Logo" className="h-8 object-contain" />
            ) : (
              <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="font-bold text-primary">{empresa.nombre.charAt(0)}</span>
              </div>
            )}
            <span className="font-bold text-lg hidden sm:block">{empresa.nombre}</span>
          </div>
          
          <Link href={`/portal/${empresaId}`} className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Salir
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 space-y-6 mt-4">
        {/* Saludo y Score */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-primary/20 shadow-md bg-gradient-to-br from-card to-primary/5">
            <CardHeader>
              <CardTitle className="text-2xl">Hola, {cliente.nombres}</CardTitle>
              <CardDescription>Bienvenido a tu portal de autogestión financiera.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded-lg p-4 border shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">Préstamos Activos</p>
                  <p className="text-3xl font-bold">{prestamosActivos.length}</p>
                </div>
                <div className="bg-background rounded-lg p-4 border shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">Saldo Total Pendiente</p>
                  <p className="text-3xl font-bold text-primary">
                    {formatMoney(prestamosActivos.reduce((acc, p: any) => acc + (p.saldoRestante || 0), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md flex flex-col items-center justify-center py-6">
            <CardHeader className="pb-2 text-center w-full">
              <CardTitle className="text-lg">Tu Score Crediticio</CardTitle>
            </CardHeader>
            <CardContent className="pb-0">
              <ScoreGauge score={cliente.score || 50} />
            </CardContent>
          </Card>
        </div>

        {/* Detalle de Préstamos */}
        <h3 className="text-xl font-bold mt-8 mb-4">Tus Préstamos Vigentes</h3>
        
        {prestamosConCuotas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h4 className="text-lg font-bold">¡Todo al día!</h4>
              <p className="text-muted-foreground">No tienes préstamos activos o pendientes en este momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prestamosConCuotas.map((p: any) => (
              <Card key={p.id} className={`shadow-sm border-l-4 ${p.estado === 'moroso' ? 'border-l-destructive' : 'border-l-primary'}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">Crédito {formatMoney(p.monto)}</CardTitle>
                      <CardDescription>Otorgado el {format(new Date(p.createdAt?.toDate?.() || p.fechaAprobacion || new Date()), "dd MMM yyyy", { locale: es })}</CardDescription>
                    </div>
                    <Badge variant={p.estado === 'moroso' ? 'destructive' : 'default'}>{p.estado.toUpperCase()}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span className="text-muted-foreground">Saldo Restante</span>
                      <span className="font-bold">{formatMoney(p.saldoRestante)}</span>
                    </div>
                    
                    {p.proximaCuota ? (
                      <div className={`rounded-lg p-4 ${p.proximaCuota.estado === 'vencida' ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {p.proximaCuota.estado === 'vencida' ? <AlertCircle className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                          <span className="font-semibold text-sm">
                            {p.proximaCuota.estado === 'vencida' ? 'Cuota Vencida' : 'Próximo Pago'} (N° {p.proximaCuota.numeroCuota})
                          </span>
                        </div>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-xs opacity-80">Fecha límite</p>
                            <p className="font-medium">{format(new Date(p.proximaCuota.fechaVencimiento), "dd/MM/yyyy")}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs opacity-80">Monto a pagar</p>
                            <p className="text-lg font-bold">${(p.proximaCuota.totalCuota - (p.proximaCuota.montoPagado || 0)).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                       <div className="bg-green-500/10 text-green-700 rounded-lg p-3 text-center text-sm font-medium flex items-center justify-center gap-2">
                         <CheckCircle className="h-4 w-4" />
                         Todas las cuotas generadas están pagadas
                       </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Historial de Préstamos */}
        {prestamosPasados.length > 0 && (
          <>
            <h3 className="text-xl font-bold mt-8 mb-4">Historial de Préstamos Pagados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prestamosPasados.map((p: any) => (
                <Card key={p.id} className="shadow-sm border-l-4 border-l-muted bg-muted/20 opacity-80">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">Crédito {formatMoney(p.monto)}</CardTitle>
                        <CardDescription>Otorgado el {format(new Date(p.createdAt?.toDate?.() || p.fechaAprobacion || new Date()), "dd MMM yyyy", { locale: es })}</CardDescription>
                      </div>
                      <Badge variant={p.estado === 'cancelado' ? 'destructive' : 'secondary'}>{p.estado.toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm border-b pb-2">
                        <span className="text-muted-foreground">Monto Financiado</span>
                        <span className="font-medium">{formatMoney(p.montoTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-1">
                        <span className="text-muted-foreground">Cuotas Totales</span>
                        <span className="font-medium">{p.numeroCuotas}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
      
      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-muted-foreground">
        <p>Plataforma gestionada por Finova Capital</p>
      </footer>
    </div>
  );
}
