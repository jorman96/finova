"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Loader2, Landmark, CheckCircle2, FileUp } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, collection, writeBatch, serverTimestamp, increment } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CuotaInversionista, InversionContrato } from "@/types";
import { uploadFileToStorage } from "@/lib/storage";

interface RegistrarPagoInversionistaDialogProps {
  contrato: InversionContrato;
  cuota?: CuotaInversionista;
  onPagoCompletado?: () => void;
  triggerButton?: React.ReactNode;
}

export function RegistrarPagoInversionistaDialog({
  contrato,
  cuota,
  onPagoCompletado,
  triggerButton
}: RegistrarPagoInversionistaDialogProps) {
  const { userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const saldoPendienteCuota = cuota ? (cuota.totalCuota - (cuota.montoPagado || 0)) : (contrato.saldoPendiente || 0);

  const [montoPago, setMontoPago] = useState<number>(saldoPendienteCuota);
  const [metodoPago, setMetodoPago] = useState<string>("transferencia");
  const [cuentaOrigen, setCuentaOrigen] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>(
    cuota ? `Liquidación cuota #${cuota.numeroCuota} a inversionista` : "Abono / Liquidación a inversionista"
  );
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);

  // Estimación de división Capital vs Interés para este pago
  const interesCuota = cuota ? cuota.interes : 0;
  const capitalCuota = cuota ? cuota.capital : montoPago;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!montoPago || montoPago <= 0) {
      toast.error("Ingrese un monto válido para liquidar");
      return;
    }
    if (!userData?.empresaId) {
      toast.error("Error: Empresa no identificada");
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const pagoRef = doc(collection(db, "pagos_inversionistas"));

      let comprobanteUrl: string | null = null;
      if (comprobanteFile) {
        const path = `inversionistas/${contrato.inversionistaId}/pagos/${Date.now()}_${comprobanteFile.name}`;
        comprobanteUrl = await uploadFileToStorage(comprobanteFile, path);
      }

      // 1. Crear documento de pago al inversionista
      const pagoData = {
        empresaId: userData.empresaId,
        inversionContratoId: contrato.id,
        inversionistaId: contrato.inversionistaId,
        inversionistaNombre: contrato.inversionistaNombre,
        cuotaInversionistaId: cuota?.id || null,
        numeroCuota: cuota?.numeroCuota || null,
        monto: montoPago,
        montoCapital: cuota ? Math.min(capitalCuota, montoPago) : montoPago,
        montoInteres: cuota ? Math.max(0, montoPago - capitalCuota) : 0,
        metodo: metodoPago,
        cuentaOrigen: cuentaOrigen.trim() || "Caja General",
        observaciones: observaciones.trim(),
        comprobanteUrl,
        fecha: serverTimestamp(),
        registradoPor: userData.nombre || "Dueño"
      };
      batch.set(pagoRef, pagoData);

      // 2. Si es pago de una cuota específica, actualizarla
      if (cuota?.id) {
        const cuotaRef = doc(db, "cuotas_inversionistas", cuota.id);
        const nuevoMontoPagado = (cuota.montoPagado || 0) + montoPago;
        const nuevoEstado = nuevoMontoPagado >= (cuota.totalCuota - 0.01) ? 'pagada' : 'parcial';
        batch.update(cuotaRef, {
          montoPagado: nuevoMontoPagado,
          saldoRestante: Math.max(0, cuota.totalCuota - nuevoMontoPagado),
          estado: nuevoEstado,
          fechaPago: new Date().toISOString()
        });
      }

      // 3. Actualizar contrato de inversión
      const nuevoTotalPagado = (contrato.totalPagado || 0) + montoPago;
      const nuevoSaldoContrato = Math.max(0, (contrato.totalPagar || contrato.montoTotal) - nuevoTotalPagado);
      const estadoContrato = nuevoSaldoContrato <= 0.01 ? 'liquidado' : contrato.estado;

      const contratoRef = doc(db, "inversion_contratos", contrato.id);
      batch.update(contratoRef, {
        totalPagado: nuevoTotalPagado,
        saldoPendiente: nuevoSaldoContrato,
        estado: estadoContrato
      });

      // 4. Actualizar totales del Inversionista
      const inversionistaRef = doc(db, "inversionistas", contrato.inversionistaId);
      batch.update(inversionistaRef, {
        totalPagado: increment(montoPago),
        saldoPendiente: increment(-montoPago)
      });

      await batch.commit();

      toast.success("Liquidación registrada exitosamente");
      setOpen(false);
      if (onPagoCompletado) {
        onPagoCompletado();
      }
    } catch (err: any) {
      console.error("Error al registrar pago a inversionista:", err);
      toast.error("Error al registrar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerButton ? (triggerButton as any) : <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" />}>
        {!triggerButton && (
          <>
            <DollarSign className="h-4 w-4" />
            Liquidar Cuota
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-emerald-600" />
            Registrar Pago al Inversionista
          </DialogTitle>
          <DialogDescription>
            {contrato.inversionistaNombre} • {cuota ? `Cuota #${cuota.numeroCuota}` : "Liquidación de Contrato"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {cuota && (
            <div className="bg-muted/40 p-3 rounded-lg border text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vencimiento:</span>
                <span className="font-semibold">{cuota.fechaVencimiento}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capital en esta cuota:</span>
                <span className="font-medium">${cuota.capital.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rendimiento / Interés:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">${cuota.interes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold text-sm">
                <span>Total Cuota a Liquidar:</span>
                <span>${cuota.totalCuota.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="montoPago">Monto a Liquidar / Pagar ($ USD) *</Label>
            <Input
              id="montoPago"
              type="number"
              step="0.01"
              min="0.01"
              value={montoPago || ""}
              onChange={e => setMontoPago(parseFloat(e.target.value) || 0)}
              className="text-lg font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Método de Pago</Label>
              <Select value={metodoPago} onValueChange={(val) => setMetodoPago(val || "transferencia")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                  <SelectItem value="efectivo">Efectivo de Caja</SelectItem>
                  <SelectItem value="deposito">Depósito Bancario</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cuentaOrigen">Cuenta de Origen / Caja</Label>
              <Input
                id="cuentaOrigen"
                value={cuentaOrigen}
                onChange={e => setCuentaOrigen(e.target.value)}
                placeholder="Ej. Banco Pichincha / Caja"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Input
              id="observaciones"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comprobante" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileUp className="h-3.5 w-3.5" /> Adjuntar Comprobante de Transferencia (Opcional)
            </Label>
            <Input
              id="comprobante"
              type="file"
              accept="image/*,application/pdf"
              onChange={e => setComprobanteFile(e.target.files ? e.target.files[0] : null)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar Liquidación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
