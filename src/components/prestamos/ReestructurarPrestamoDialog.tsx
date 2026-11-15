"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { generateAmortizationTable } from "@/lib/amortization";
import { useFinanceRequest } from "@/lib/use-finance-request";
import { Prestamo } from "@/types";
import { AlertTriangle, Calculator, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface ReestructurarPrestamoDialogProps {
  prestamo: Prestamo;
  onReestructurado?: (nuevoPrestamoId: string) => void;
  triggerButton?: React.ReactElement;
}

export function ReestructurarPrestamoDialog({
  prestamo,
  onReestructurado,
  triggerButton,
}: ReestructurarPrestamoDialogProps) {
  const { userData } = useAuth();
  const finance = useFinanceRequest();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Valores predeterminados basados en el préstamo a refinanciar
  const [nuevoMonto, setNuevoMonto] = useState<number>(prestamo.saldoRestante || prestamo.monto);
  const [tasaInteres, setTasaInteres] = useState<number>(prestamo.tasaInteres || 10);
  const [periodoTasa, setPeriodoTasa] = useState<"mensual" | "anual">("mensual");
  const [tipoInteres, setTipoInteres] = useState<"fijo" | "saldo_deudor">(prestamo.tipoInteres || "fijo");
  const [frecuenciaPago, setFrecuenciaPago] = useState<"diario" | "semanal" | "quincenal" | "mensual">(
    prestamo.frecuenciaPago || "mensual"
  );
  const [numeroCuotas, setNumeroCuotas] = useState<number>(prestamo.numeroCuotas || 6);

  // Fecha de primer pago por defecto (mañana)
  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [fechaPrimerPago, setFechaPrimerPago] = useState<string>(defaultDate);
  const [motivo, setMotivo] = useState<string>(
    `Convenio de refinanciación por saldo pendiente de $${prestamo.saldoRestante.toFixed(2)}`
  );

  // Cálculo de previsualización en vivo
  const preview = useMemo(() => {
    try {
      if (nuevoMonto <= 0 || numeroCuotas <= 0 || !fechaPrimerPago) return null;
      const installments = generateAmortizationTable({
        monto: nuevoMonto,
        tasaInteres,
        periodoTasa,
        tipoInteres,
        frecuenciaPago,
        numeroCuotas,
        fechaPrimerPago,
      });
      const totalPagar = installments.reduce((acc, c) => acc + c.totalCuota, 0);
      const totalInteres = installments.reduce((acc, c) => acc + c.interes, 0);
      const valorCuotaPromedio = installments.length > 0 ? installments[0].totalCuota : 0;
      return { totalPagar, totalInteres, valorCuotaPromedio, count: installments.length };
    } catch {
      return null;
    }
  }, [nuevoMonto, tasaInteres, periodoTasa, tipoInteres, frecuenciaPago, numeroCuotas, fechaPrimerPago]);

  // Solo dueño, superadmin o admin pueden reestructurar
  const canRefinance =
    userData?.rol === "dueño" || userData?.rol === "superadmin" || userData?.rol === "admin";
  if (!canRefinance) return null;

  // No permitir reestructurar créditos ya cancelados, liquidados o reestructurados
  const isEligible =
    prestamo.estado !== "cancelado" &&
    prestamo.estado !== "completado" &&
    prestamo.estado !== "reestructurado" &&
    prestamo.saldoRestante > 0;

  if (!isEligible) return null;

  const handleRefinance = async () => {
    if (nuevoMonto <= 0) {
      toast.error("El monto a refinanciar debe ser mayor a 0.");
      return;
    }
    if (numeroCuotas <= 0 || numeroCuotas > 360) {
      toast.error("El número de cuotas debe estar entre 1 y 360.");
      return;
    }
    if (!motivo.trim() || motivo.trim().length < 5) {
      toast.error("Por favor ingresa un motivo de al menos 5 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await finance.submit({
        action: "refinance_loan",
        prestamoId: prestamo.id,
        nuevoMonto: Number(nuevoMonto.toFixed(2)),
        tasaInteres: Number(tasaInteres),
        periodoTasa,
        tipoInteres,
        frecuenciaPago,
        numeroCuotas: Number(numeroCuotas),
        fechaPrimerPago,
        motivo: motivo.trim(),
      });

      toast.success("¡Crédito reestructurado exitosamente! Se generó el nuevo cronograma.");
      setOpen(false);
      if (onReestructurado && res?.id) {
        onReestructurado(res.id);
      } else if (res?.id) {
        router.push(`/prestamos/${res.id}`);
      }
    } catch (error: unknown) {
      console.error("Error al reestructurar:", error);
      toast.error(error instanceof Error ? error.message : "Error al reestructurar el crédito.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          triggerButton ?? (
            <Button variant="outline" size="sm" className="gap-1.5 border-primary text-primary hover:bg-primary/10">
              <RefreshCw className="h-4 w-4" />
              Reestructurar / Refinanciar
            </Button>
          )
        }
      />
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Reestructuración y Refinanciamiento</DialogTitle>
              <DialogDescription>
                Cierra el crédito actual por refinanciación y genera un nuevo crédito con condiciones actualizadas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Ficha Resumen del Crédito Actual */}
        <div className="bg-muted/50 p-4 rounded-lg border space-y-2 text-sm">
          <div className="flex justify-between items-center pb-2 border-b">
            <span className="font-medium text-foreground">Cliente: {prestamo.clienteNombre}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Estado: {prestamo.estado.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-muted-foreground">
            <div>
              <p className="text-xs">Monto Original</p>
              <p className="font-semibold text-foreground">${prestamo.monto.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs">Saldo Pendiente a Refinanciar</p>
              <p className="font-bold text-primary">${prestamo.saldoRestante.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs">Frecuencia Anterior</p>
              <p className="font-medium capitalize text-foreground">{prestamo.frecuenciaPago}</p>
            </div>
          </div>
        </div>

        {/* Formulario de Nuevas Condiciones */}
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nuevoMonto">Monto del Nuevo Crédito ($)</Label>
              <Input
                id="nuevoMonto"
                type="number"
                step="0.01"
                min="1"
                value={nuevoMonto}
                onChange={(e) => setNuevoMonto(parseFloat(e.target.value) || 0)}
              />
              <span className="text-xs text-muted-foreground">Prellenado con el saldo insoluto pendiente.</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tasaInteres">Tasa de Interés (%)</Label>
              <div className="flex gap-2">
                <Input
                  id="tasaInteres"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={tasaInteres}
                  onChange={(e) => setTasaInteres(parseFloat(e.target.value) || 0)}
                  className="w-2/3"
                />
                <select
                  className="w-1/3 rounded-md border border-input bg-background px-2 text-sm"
                  value={periodoTasa}
                  onChange={(e) => setPeriodoTasa(e.target.value as "mensual" | "anual")}
                >
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de Interés</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={tipoInteres}
                onChange={(e) => setTipoInteres(e.target.value as "fijo" | "saldo_deudor")}
              >
                <option value="fijo">Interés Fijo</option>
                <option value="saldo_deudor">Saldo Deudor (Francés)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Frecuencia de Pago</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={frecuenciaPago}
                onChange={(e) =>
                  setFrecuenciaPago(e.target.value as "diario" | "semanal" | "quincenal" | "mensual")
                }
              >
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numeroCuotas">Número de Cuotas</Label>
              <Input
                id="numeroCuotas"
                type="number"
                min="1"
                max="360"
                value={numeroCuotas}
                onChange={(e) => setNumeroCuotas(parseInt(e.target.value, 10) || 1)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fechaPrimerPago">Fecha Primer Pago</Label>
              <Input
                id="fechaPrimerPago"
                type="date"
                value={fechaPrimerPago}
                onChange={(e) => setFechaPrimerPago(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo / Acuerdo de Refinanciación</Label>
              <Input
                id="motivo"
                placeholder="Ej. Convenio por dificultad de pago, extensión de plazo..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          </div>

          {/* Tarjeta de Previsualización del Nuevo Cronograma */}
          {preview ? (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Calculator className="h-4 w-4" />
                SIMULACIÓN DE LA NUEVA OPERACIÓN
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div>
                  <p className="text-xs text-muted-foreground">Cuota Estimada</p>
                  <p className="text-base font-bold text-foreground">
                    ${preview.valorCuotaPromedio.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nuevo Interés Total</p>
                  <p className="text-base font-bold text-foreground">${preview.totalInteres.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total a Cobrar</p>
                  <p className="text-base font-bold text-primary">${preview.totalPagar.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Verifica los parámetros (monto, tasa, cuotas y fecha) para calcular la nueva tabla de amortización.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" disabled={loading} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleRefinance}
            disabled={loading || !preview}
            className="gap-1.5 bg-primary hover:bg-primary/90"
          >
            {loading ? (
              "Procesando Reestructuración..."
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Confirmar y Generar Nuevo Crédito
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
