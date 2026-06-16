"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2, UploadCloud } from "lucide-react";
import { collection, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Prestamo, Cuota } from "@/types";
import { uploadFileToStorage } from "@/lib/storage";

import { useAuth } from "@/contexts/AuthContext";

export function RegistrarPagoDialog({ prestamo, cuotas, onPagoRegistrado }: { prestamo: Prestamo, cuotas: Cuota[], onPagoRegistrado: () => void }) {
  const { userData } = useAuth();
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
    } else {
      setCuentaDestino("");
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
    if (montoPago <= 0) {
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
      const batch = writeBatch(db);
      let montoRestante = montoPago;

      // Iterar sobre cuotas pendientes/vencidas para saldarlas en orden
      const cuotasPendientes = cuotas.filter(c => c.estado !== 'pagada');
      const cuotasAplicadas = [];
      
      for (const cuota of cuotasPendientes) {
        if (montoRestante <= 0) break;

        const saldoCuota = cuota.totalCuota - cuota.montoPagado;
        const montoAAplicar = Math.min(saldoCuota, montoRestante);
        const nuevoMontoPagado = cuota.montoPagado + montoAAplicar;
        const nuevoEstado = (nuevoMontoPagado + 0.01) >= cuota.totalCuota ? 'pagada' : 'parcial';

        const cuotaRef = doc(db, "cuotas", cuota.id);
        batch.update(cuotaRef, {
          montoPagado: nuevoMontoPagado,
          estado: nuevoEstado,
          fechaPago: new Date().toISOString()
        });

        cuotasAplicadas.push({
          cuotaId: cuota.id,
          numeroCuota: cuota.numeroCuota,
          montoAbonado: montoAAplicar,
          valorCuota: cuota.totalCuota,
          saldoAnterior: saldoCuota,
          saldoRestante: saldoCuota - montoAAplicar,
          interes: cuota.interes,
          capital: cuota.capital
        });

        montoRestante -= montoAAplicar;
      }

      // Actualizar Préstamo
      const nuevoSaldoRestante = Math.max(0, prestamo.saldoRestante - montoPago);
      const prestamoEstado = nuevoSaldoRestante <= 0.01 ? 'completado' : prestamo.estado;
      
      const prestamoRef = doc(db, "prestamos", prestamo.id);
      batch.update(prestamoRef, {
        saldoRestante: nuevoSaldoRestante,
        estado: prestamoEstado
      });

      // Si se completó el préstamo, recompensar al cliente con +10 puntos de score
      if (prestamoEstado === 'completado') {
        const { getDoc } = await import("firebase/firestore");
        const clienteRef = doc(db, "clientes", prestamo.clienteId);
        const clienteSnap = await getDoc(clienteRef);
        if (clienteSnap.exists()) {
          const currentScore = clienteSnap.data().score || 50;
          const newScore = Math.min(100, currentScore + 10);
          batch.update(clienteRef, { score: newScore });
        }
      }

      // Registrar el Pago Histórico
      const pagoRef = doc(collection(db, "pagos"));
      
      let comprobanteUrl = null;
      if (comprobanteFile) {
         setUploading(true);
         const path = `pagos/${pagoRef.id}/comprobantes/${Date.now()}_${comprobanteFile.name}`;
         comprobanteUrl = await uploadFileToStorage(comprobanteFile, path, (progress) => {
            setUploadProgress(progress);
         });
         setUploading(false);
      }

      batch.set(pagoRef, {
        empresaId: userData.empresaId,
        prestamoId: prestamo.id,
        clienteId: prestamo.clienteId,
        clienteNombre: prestamo.clienteNombre,
        monto: montoPago,
        metodo: metodoPago,
        cuentaDestino: (metodoPago === 'transferencia' || metodoPago === 'deposito') ? cuentaDestino : null,
        observaciones,
        comprobanteUrl,
        cuotasAplicadas,
        fecha: serverTimestamp(),
        registradoPor: userData.nombre || "Sistema"
      });

      await batch.commit();

      // Trigger Email Silencioso
      fetch("/api/email/recibo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId: userData.empresaId,
          clienteId: prestamo.clienteId,
          clienteNombre: prestamo.clienteNombre,
          monto: montoPago,
          metodo: metodoPago,
          fecha: new Date().toISOString(),
          reciboId: pagoRef.id
        })
      }).catch(err => console.error("Error trigger email:", err));

      toast.success("Pago registrado exitosamente");
      setOpen(false);
      setComprobanteFile(null);
      setUploadProgress(0);
      onPagoRegistrado();
    } catch (error) {
      console.error(error);
      toast.error("Error al registrar el pago");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                  <SelectItem value="otro">Otro</SelectItem>
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
