"use client";

import { auth } from "@/lib/firebase";
import { useState, useEffect, useRef, useId } from "react";
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
import { apiPost } from '@/lib/api-client';
import { capitalPost } from '@/lib/capital/client';
import { amount, previewReceipt } from '@/lib/capital/core';

export function RegistrarPagoDialog({ prestamo, cuotas, onPagoRegistrado, onReceiptStatus }: { prestamo: Prestamo, cuotas: Cuota[], onPagoRegistrado: (id: string) => void; onReceiptStatus?: (id: string, state: 'pending' | 'accepted') => void }) {
  const { userData } = useAuth();
  const fieldId = useId();
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
  const proximaCuota = [...cuotas].sort((a, b) => a.numeroCuota - b.numeroCuota).find(c => c.totalCuota > (c.montoPagado || 0));

  const [monto, setMonto] = useState(proximaCuota ? (proximaCuota.totalCuota - proximaCuota.montoPagado).toFixed(2) : "");
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [observaciones, setObservaciones] = useState("");
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const cachedProof = useRef<{ file: File; url: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  let review: ReturnType<typeof previewReceipt> | null = null;
  try { review = previewReceipt(cuotas, amount(monto)); } catch { /* Invalid or incomplete amounts are not offered for confirmation. */ }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed || !review) { toast.error('Revisa el resumen y confirma que el dinero fue recibido.'); return; }
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
      if (process.env.NEXT_PUBLIC_CAPITAL_PAYMENTS_ENABLED === 'true') {
        const summary = await apiPost<{ enabled: boolean }>('/api/capital/summary', {});
        if (summary.enabled) {
          const bank = cuentasBancarias.find(b => `${b.banco} - ${b.numero} (${b.titular || 'Sin titular'})` === cuentaDestino);
          let proofUrl: string | undefined;
          if (comprobanteFile) {
            setUploading(true);
            proofUrl = cachedProof.current?.file === comprobanteFile ? cachedProof.current.url : await uploadFileToStorage(comprobanteFile, `pagos/${crypto.randomUUID()}/${comprobanteFile.name}`, setUploadProgress);
            cachedProof.current = { file: comprobanteFile, url: proofUrl };
            setUploading(false);
          }
          const result = await capitalPost<{ id: string; verified: boolean }>(userData.empresaId, 'receive:' + prestamo.id, { type: 'receive', loanId: prestamo.id, cents: amount(monto), method: metodoPago, ...(bank ? { bankId: bank.id } : {}), note: observaciones, ...(proofUrl ? { proofUrl } : {}) });
          toast.success('Cobro registrado en el servidor.');
          if (!result.verified) toast.warning('El cobro quedó guardado, pero sus intereses requieren conciliación y no se pueden reservar.');
          onPagoRegistrado(result.id);
          fetch('/api/email/recibo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` }, body: JSON.stringify({ reciboId: result.id }) }).then(r => { onReceiptStatus?.(result.id, r.ok ? 'accepted' : 'pending'); if (!r.ok) toast.warning('El cobro está guardado; no se pudo enviar el recibo por correo.'); }).catch(() => toast.warning('El cobro está guardado; no se pudo enviar el recibo por correo.'));
          setOpen(false); setComprobanteFile(null); cachedProof.current = null; setUploadProgress(0);
          return;
        }
      }
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

      onPagoRegistrado(pagoRef.id);
      // Trigger Email Silencioso
      fetch("/api/email/recibo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
        body: JSON.stringify({
          empresaId: userData.empresaId,
          clienteId: prestamo.clienteId,
          clienteNombre: prestamo.clienteNombre,
          monto: montoPago,
          metodo: metodoPago,
          fecha: new Date().toISOString(),
          reciboId: pagoRef.id
        })
      }).then(res => { onReceiptStatus?.(pagoRef.id, res.ok ? 'accepted' : 'pending'); if (!res.ok) toast.warning("Pago guardado. El recibo por correo no pudo enviarse."); }).catch(() => toast.warning("Pago guardado. El recibo por correo no pudo enviarse."));

      toast.success("Pago registrado exitosamente");
      setOpen(false);
      setComprobanteFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al registrar el pago");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!loading && !uploading) { if (next) { setConfirmed(false); setMonto(proximaCuota ? (proximaCuota.totalCuota - (proximaCuota.montoPagado || 0)).toFixed(2) : ''); } setOpen(next); } }}>
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
            <p className="text-sm font-medium">{prestamo.clienteNombre}</p>
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-0`}> Monto a Pagar ($)</Label>
              <Input id={`${fieldId}-0`} type="number"
                step="0.01"
                value={monto}
                onChange={e => { setMonto(e.target.value); setConfirmed(false); }}
                required
                max={prestamo.saldoRestante}
              />
              <p className="text-xs text-muted-foreground">Saldo del préstamo: ${prestamo.saldoRestante.toFixed(2)}</p>
            </div>

            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={metodoPago} onValueChange={(val) => { if (val) { setMetodoPago(val); setConfirmed(false); } }}>
                <SelectTrigger aria-label="Método de Pago"><SelectValue /></SelectTrigger>
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
                <Select value={cuentaDestino} onValueChange={(v) => { setCuentaDestino(v || ""); setConfirmed(false); }}>
                  <SelectTrigger aria-label="Cuenta Destino (Banco)"><SelectValue placeholder="Seleccione una cuenta..." /></SelectTrigger>
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
              <Label htmlFor={`${fieldId}-1`}> Observaciones / N° Recibo</Label>
              <Input id={`${fieldId}-1`} value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Ej. Transferencia #12345"
                disabled={loading || uploading}
              />
            </div>

            {review && <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2"><p>Recibido: ${Number(monto).toFixed(2)} · {metodoPago}</p><p>Cuotas a abonar: {review.installments.join(', ')}</p><p>Saldo resultante: ${Math.max(0, prestamo.saldoRestante - Number(monto)).toFixed(2)}</p>{review.verified && process.env.NEXT_PUBLIC_CAPITAL_PAYMENTS_ENABLED === 'true' ? <p>Distribución proporcional estimada: capital ${((review.capital || 0) / 100).toFixed(2)} · intereses ${((review.interest || 0) / 100).toFixed(2)}. El servidor vuelve a comprobar los saldos.</p> : <p>La distribución definitiva se consulta en el recibo. Los abonos históricos sin desglose verificable requieren conciliación.</p>}</div>}
            <label className="flex items-start gap-3 text-sm"><input className="mt-1 size-4 shrink-0" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo que revisé el resumen y que el dinero ya fue recibido en la caja o cuenta indicada.</label>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading || uploading}>Cancelar</Button>
              <Button type="submit" disabled={loading || uploading || !confirmed || !review}>
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
