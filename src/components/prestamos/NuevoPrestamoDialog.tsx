"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { collection, addDoc, serverTimestamp, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cliente } from "@/types";
import { generateAmortizationTable, AmortizationInput, CuotaProyectada } from "@/lib/amortization";
import { useAuth } from "@/contexts/AuthContext";

export function NuevoPrestamoDialog() {
  const { userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  
  // Form State
  const [clienteId, setClienteId] = useState("");
  const [monto, setMonto] = useState("");
  const [tasaInteres, setTasaInteres] = useState("");
  const [tipoInteres, setTipoInteres] = useState<'fijo' | 'saldo_deudor'>('fijo');
  const [frecuenciaPago, setFrecuenciaPago] = useState<'diario'|'semanal'|'quincenal'|'mensual'>('mensual');
  const [numeroCuotas, setNumeroCuotas] = useState("");
  const [fechaDesembolso, setFechaDesembolso] = useState(new Date().toISOString().split("T")[0]);
  const [fechaPrimerPago, setFechaPrimerPago] = useState("");
  
  const [simulacion, setSimulacion] = useState<CuotaProyectada[]>([]);

  useEffect(() => {
    if (open && userData?.empresaId) {
      getDocs(query(collection(db, "clientes"), where("empresaId", "==", userData.empresaId))).then(snapshot => {
        setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente)));
      });
    }
  }, [open, userData?.empresaId]);

  const handleSimular = () => {
    if (!monto || !tasaInteres || !numeroCuotas || !fechaPrimerPago) {
      toast.error("Llena todos los campos financieros para simular.");
      return;
    }
    
    const input: AmortizationInput = {
      monto: Number(monto),
      tasaInteres: Number(tasaInteres),
      tipoInteres,
      frecuenciaPago,
      numeroCuotas: Number(numeroCuotas),
      fechaPrimerPago
    };
    
    const resultado = generateAmortizationTable(input);
    setSimulacion(resultado);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (simulacion.length === 0) {
      toast.error("Por favor simula el préstamo antes de crearlo.");
      return;
    }
    if (!clienteId) {
      toast.error("Selecciona un cliente.");
      return;
    }
    if (!userData?.empresaId) {
      toast.error("Error de sesión: empresa no identificada.");
      return;
    }

    setLoading(true);
    try {
      const clienteSeleccionado = clientes.find(c => c.id === clienteId);
      const totalInteres = simulacion.reduce((acc, c) => acc + c.interes, 0);
      const totalPagar = simulacion.reduce((acc, c) => acc + c.totalCuota, 0);

      // Crear préstamo
      const prestamoData = {
        empresaId: userData.empresaId,
        clienteId,
        clienteNombre: `${clienteSeleccionado?.nombres} ${clienteSeleccionado?.apellidos}`,
        monto: Number(monto),
        tasaInteres: Number(tasaInteres),
        tipoInteres,
        frecuenciaPago,
        numeroCuotas: Number(numeroCuotas),
        fechaDesembolso,
        fechaPrimerPago,
        totalInteres,
        totalPagar,
        saldoRestante: totalPagar,
        estado: 'activo',
        createdAt: serverTimestamp()
      };

      const prestamoRef = await addDoc(collection(db, "prestamos"), prestamoData);

      // Crear cuotas en Batch
      const batch = writeBatch(db);
      simulacion.forEach(cuota => {
        const cuotaRef = doc(collection(db, "cuotas"));
        batch.set(cuotaRef, {
          prestamoId: prestamoRef.id,
          empresaId: userData.empresaId,
          clienteId,
          numeroCuota: cuota.numeroCuota,
          fechaVencimiento: cuota.fechaVencimiento,
          capital: cuota.capital,
          interes: cuota.interes,
          totalCuota: cuota.totalCuota,
          saldoPendiente: cuota.saldoPendiente,
          estado: 'pendiente',
          montoPagado: 0,
        });
      });
      
      // Actualizar estado del cliente a activo si estaba como nuevo
      if (clienteSeleccionado?.estado === 'nuevo') {
         const clienteRef = doc(db, "clientes", clienteId);
         batch.update(clienteRef, { estado: 'activo' });
      }

      await batch.commit();

      toast.success("Préstamo y tabla de amortización creados.");
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Error al crear el préstamo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" /> Nuevo Préstamo
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Préstamo</DialogTitle>
          <DialogDescription>
            Configura las condiciones del crédito y genera la tabla de amortización.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={(val) => val && setClienteId(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nombres} {c.apellidos} - {c.cedula}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monto a Prestar ($)</Label>
              <Input type="number" value={monto} onChange={e => setMonto(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Tasa de Interés (%)</Label>
              <Input type="number" step="0.01" value={tasaInteres} onChange={e => setTasaInteres(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Interés</Label>
              <Select value={tipoInteres} onValueChange={(val: any) => val && setTipoInteres(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fijo">Interés Fijo (Simple)</SelectItem>
                  <SelectItem value="saldo_deudor">Saldo Deudor (Francés)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frecuencia de Pago</Label>
              <Select value={frecuenciaPago} onValueChange={(val: any) => val && setFrecuenciaPago(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diario</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número de Cuotas</Label>
              <Input type="number" value={numeroCuotas} onChange={e => setNumeroCuotas(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Fecha de Primer Pago</Label>
              <Input type="date" value={fechaPrimerPago} onChange={e => setFechaPrimerPago(e.target.value)} required />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" variant="secondary" onClick={handleSimular}>
              Simular Cuotas
            </Button>
          </div>

          {simulacion.length > 0 && (
            <div className="mt-4 border rounded-md max-h-48 overflow-y-auto bg-muted/20">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Capital</th>
                    <th className="p-2">Interés</th>
                    <th className="p-2">Cuota</th>
                    <th className="p-2">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {simulacion.map((c, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{c.numeroCuota}</td>
                      <td className="p-2">{c.fechaVencimiento}</td>
                      <td className="p-2">${c.capital}</td>
                      <td className="p-2">${c.interes}</td>
                      <td className="p-2 font-medium">${c.totalCuota}</td>
                      <td className="p-2">${c.saldoPendiente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading || simulacion.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aprobar Préstamo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
