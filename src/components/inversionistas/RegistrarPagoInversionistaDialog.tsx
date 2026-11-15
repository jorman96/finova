"use client";
import { errorMessage } from "@/lib/errors";

import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFileToStorage } from "@/lib/storage";
import { useFinanceRequest } from "@/lib/use-finance-request";
import { CuotaInversionista,InversionContrato } from "@/types";
import { CheckCircle2,DollarSign,FileUp,Landmark,Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RegistrarPagoInversionistaDialogProps {
  contrato: InversionContrato;
  cuota?: CuotaInversionista;
  onPagoCompletado?: () => void;
  triggerButton?: React.ReactElement;
}

export function RegistrarPagoInversionistaDialog({
  contrato,
  cuota,
  onPagoCompletado,
  triggerButton
}: RegistrarPagoInversionistaDialogProps) {
  const { userData } = useAuth();
  const finance = useFinanceRequest();
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
      let comprobanteUrl = null;
      if (comprobanteFile) comprobanteUrl = await uploadFileToStorage(comprobanteFile, `inversionistas/${contrato.inversionistaId}/pagos/${crypto.randomUUID()}_${comprobanteFile.name}`);
      await finance.submit({ action: "investor_payment", contratoId: contrato.id, ...(cuota ? { cuotaId: cuota.id } : {}), monto: montoPago, metodo: metodoPago, cuentaOrigen: cuentaOrigen || "Caja General", observaciones, comprobanteUrl });
      toast.success("Liquidación registrada exitosamente");
      setOpen(false);
      if (onPagoCompletado) {
        onPagoCompletado();
      }
    } catch (err: unknown) {
      console.error("Error al registrar pago a inversionista:", err);
      toast.error("Error al registrar: " + errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (loading) return; if (value) { finance.reset(); setMontoPago(saldoPendienteCuota); } setOpen(value); }}>
      <DialogTrigger render={triggerButton ? triggerButton : <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" />}>
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
              max={saldoPendienteCuota}
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
