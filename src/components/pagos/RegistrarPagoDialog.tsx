"use client";

import { Button } from "@/components/ui/button";
import {
Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { apiPost } from "@/lib/api-client";
import { businessDate } from "@/lib/business-date";
import { db } from "@/lib/firebase";
import { allocatePayment } from "@/lib/payment-allocation";
import { uploadFileToStorage } from "@/lib/storage";
import { useFinanceRequest } from "@/lib/use-finance-request";
import { Cuota,Prestamo } from "@/types";
import { DollarSign,Loader2 } from "lucide-react";
import { useEffect,useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";

export function RegistrarPagoDialog({ prestamo, cuotas, onPagoRegistrado }: { prestamo: Prestamo, cuotas: Cuota[], onPagoRegistrado: () => void }) {
  const { userData } = useAuth();
  const finance = useFinanceRequest();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [cuentasBancarias, setCuentasBancarias] = useState<{ id: string, banco: string, numero: string, tipo: string, titular?: string }[]>([]);
  const [cuentaDestino, setCuentaDestino] = useState("");

  useEffect(() => {
    if (open && userData?.empresaId) {
      import("firebase/firestore").then(({ doc, getDoc }) => {
        getDoc(doc(db, "empresas", userData.empresaId)).then((snap) => {
          if (snap.exists()) {
            setCuentasBancarias(snap.data().cuentasBancarias || []);
          }
        });
      });
    }
  }, [open, userData?.empresaId]);
  
  // Find next pending cuota
  const proximaCuota = cuotas.find(c => c.estado === 'pendiente' || c.estado === 'vencida' || c.estado === 'parcial');
  
  const [monto, setMonto] = useState(proximaCuota ? (proximaCuota.totalCuota - proximaCuota.montoPagado).toFixed(2) : "");
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [observaciones, setObservaciones] = useState("");
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proximaCuota) {
      toast.error("No hay cuotas pendientes.");
      return;
    }

    const montoPago = Number(monto);
    if (!Number.isFinite(montoPago) || montoPago <= 0 || montoPago > prestamo.saldoRestante) {
      toast.error("El monto debe ser mayor a 0.");
      return;
    }

    if ((metodoPago === 'transferencia' || metodoPago === 'deposito') && !cuentaDestino) {
      toast.error("Debes seleccionar a qué cuenta llegó el dinero.");
      return;
    }

    if (!userData?.empresaId) {
       toast.error("Sesión inválida.");
       return;
    }

    setLoading(true);
    try {
      let comprobanteUrl = null;
      if (comprobanteFile) {
        setUploading(true);
        comprobanteUrl = await uploadFileToStorage(comprobanteFile, `pagos/${crypto.randomUUID()}/${comprobanteFile.name}`, setUploadProgress);
        setUploading(false);
      }
      const result = await finance.submit({ action: "payment", prestamoId: prestamo.id, monto: montoPago, metodo: metodoPago, cuentaDestino, observaciones, comprobanteUrl });
      apiPost("/api/email/recibo", { reciboId: result.id }).catch(() => toast.warning("Pago guardado. El correo queda pendiente; puedes reenviarlo desde el historial."));
      toast.success("Pago registrado exitosamente");
      setOpen(false);
      setComprobanteFile(null);
      setUploadProgress(0);
      onPagoRegistrado();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al registrar el pago");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  let preview = null;
  try { preview = allocatePayment(cuotas, Number(monto), businessDate()); } catch { /* Invalid preview is shown inline. */ }

  return (
    <Dialog open={open} onOpenChange={value => { if (loading) return; if (value) { finance.reset(); setCuentaDestino(""); setMonto(proximaCuota ? (proximaCuota.totalCuota - proximaCuota.montoPagado).toFixed(2) : ""); } setOpen(value); }}>
      <DialogTrigger render={<Button />}>
        <DollarSign className="mr-2 h-4 w-4" /> Registrar Pago
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            {proximaCuota ? `La próxima cuota sugerida a pagar es la #${proximaCuota.numeroCuota}.` : "El préstamo ya está pagado en su totalidad."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded border p-3 text-sm space-y-1">
          <p className="font-medium">Vista previa del abono · interés primero</p>
          {preview ? <><p>Capital: ${preview.reduce((n, c) => n + c.capital, 0).toFixed(2)} · Interés: ${preview.reduce((n, c) => n + c.interes, 0).toFixed(2)}</p><p>Cuotas: {preview.map(c => `#${c.numeroCuota}`).join(", ")} · Saldo posterior: ${Math.max(0, prestamo.saldoRestante - Number(monto)).toFixed(2)}</p></> : <p>Introduce un monto dentro del saldo pendiente.</p>}
          <p className="text-xs text-muted-foreground">El servidor confirmará los saldos actuales al guardar.</p>
        </div>
        {proximaCuota ? (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Monto a Pagar ($)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={monto} 
                onChange={e => setMonto(e.target.value)} 
                required 
                max={prestamo.saldoRestante}
              />
              <p className="text-xs text-muted-foreground">Saldo del préstamo: ${prestamo.saldoRestante.toFixed(2)}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={metodoPago} onValueChange={(val) => val && setMetodoPago(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                  <SelectItem value="deposito">Depósito</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(metodoPago === 'transferencia' || metodoPago === 'deposito') && (
              <div className="space-y-2">
                <Label>Cuenta Destino (Banco)</Label>
                <Select value={cuentaDestino} onValueChange={(v) => setCuentaDestino(v || "")}>
                  <SelectTrigger><SelectValue placeholder="Seleccione una cuenta..." /></SelectTrigger>
                  <SelectContent>
                    {cuentasBancarias.length === 0 ? (
                      <SelectItem value="ninguna" disabled>No hay cuentas configuradas</SelectItem>
                    ) : (
                      cuentasBancarias.map(c => (
                        <SelectItem key={c.id} value={`${c.banco} - ${c.numero} (${c.titular || 'Sin titular'})`}>
                          {c.banco} ({c.tipo}) - {c.numero} {c.titular && `- ${c.titular}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {cuentasBancarias.length === 0 && (
                  <p className="text-xs text-destructive">Debe configurar cuentas bancarias en Configuración para usar este método.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Comprobante (Opcional)</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="file" 
                  onChange={e => setComprobanteFile(e.target.files?.[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  disabled={loading || uploading}
                />
              </div>
              {uploading && (
                 <div className="w-full bg-secondary rounded-full h-1 mt-1">
                   <div className="bg-primary h-1 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                 </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Observaciones / N° Recibo</Label>
              <Input 
                value={observaciones} 
                onChange={e => setObservaciones(e.target.value)} 
                placeholder="Ej. Transferencia #12345" 
                disabled={loading || uploading}
              />
            </div>
            
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading || uploading}>Cancelar</Button>
              <Button type="submit" disabled={loading || uploading}>
                {(loading || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Pago
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            Este préstamo no tiene cuotas pendientes.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
