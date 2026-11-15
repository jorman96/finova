"use client";

import { ClientePicker } from "@/components/clientes/ClientePicker";
import { Button } from "@/components/ui/button";
import {
Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { AmortizationInput,CuotaProyectada,generateAmortizationTable } from "@/lib/amortization";
import { businessDate } from "@/lib/business-date";
import { db } from "@/lib/firebase";
import { useFinanceRequest } from "@/lib/use-finance-request";
import { Cliente } from "@/types";
import { collection,getDocs,query,where } from "firebase/firestore";
import { Loader2,Plus } from "lucide-react";
import { useEffect,useState } from "react";
import { toast } from "sonner";

export function NuevoPrestamoDialog({ onPrestamoCreado }: { onPrestamoCreado?: () => void }) {
  const { userData } = useAuth();
  const finance = useFinanceRequest();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  
  // Form State
  const [clienteId, setClienteId] = useState("");
  const [monto, setMonto] = useState("");
  const [tasaInteres, setTasaInteres] = useState("");
  const [periodoTasa, setPeriodoTasa] = useState<'mensual'|'anual'>('mensual');
  const [tipoInteres, setTipoInteres] = useState<'fijo' | 'saldo_deudor'>('fijo');
  const [frecuenciaPago, setFrecuenciaPago] = useState<'diario'|'semanal'|'quincenal'|'mensual'>('mensual');
  const [numeroCuotas, setNumeroCuotas] = useState("");
  const [fechaDesembolso, setFechaDesembolso] = useState(businessDate());
  const [fechaPrimerPago, setFechaPrimerPago] = useState("");
  
  const [simulacion, setSimulacion] = useState<CuotaProyectada[]>([]);

  useEffect(() => {
    if (open && userData?.empresaId) {
      getDocs(query(collection(db, "clientes"), where("empresaId", "==", userData.empresaId))).then(snapshot => {
        setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente)));
      }).catch(() => { setClientes([]); toast.error("No se pudo cargar la lista de clientes. Cierra e intenta de nuevo."); });
    }
  }, [open, userData?.empresaId]);
  const simulationKey = JSON.stringify([monto, tasaInteres, periodoTasa, tipoInteres, frecuenciaPago, numeroCuotas, fechaPrimerPago]);
  const [simulatedKey, setSimulatedKey] = useState("");
  const validSimulation = simulatedKey === simulationKey;

  const handleSimular = () => {
    if (!monto || !tasaInteres || !numeroCuotas || !fechaPrimerPago) {
      toast.error("Llena todos los campos financieros para simular.");
      return;
    }
    
    const input: AmortizationInput = {
      monto: Number(monto),
      tasaInteres: Number(tasaInteres),
      periodoTasa,
      tipoInteres,
      frecuenciaPago,
      numeroCuotas: Number(numeroCuotas),
      fechaPrimerPago
    };
    
    try { setSimulacion(generateAmortizationTable(input)); setSimulatedKey(simulationKey); } catch (error) { toast.error(error instanceof Error ? error.message : "Condiciones inválidas"); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!validSimulation || simulacion.length === 0)) {
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
      await finance.submit({ action: "loan", clienteId, monto: Number(monto), tasaInteres: Number(tasaInteres), periodoTasa, tipoInteres, frecuenciaPago, numeroCuotas: Number(numeroCuotas), fechaDesembolso, fechaPrimerPago });
      toast.success("Préstamo y tabla de amortización creados.");
      setOpen(false);
      onPrestamoCreado?.();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al crear el préstamo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (loading) return; if (value) { finance.reset(); setClienteId(""); setMonto(""); setTasaInteres(""); setNumeroCuotas(""); setFechaPrimerPago(""); setSimulacion([]); setSimulatedKey(""); } setOpen(value); }}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" /> Nuevo Préstamo
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Préstamo</DialogTitle>
          <DialogDescription>
            Configura las condiciones del crédito y genera la tabla de amortización.
            Convención comercial: mes de 30 días y 4 semanas. Los abonos cubren primero intereses y luego capital.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credito-cliente">Cliente</Label>
            <ClientePicker clientes={clientes} value={clienteId} onChange={setClienteId} />
          </div>

          <label className="text-sm">Fecha de desembolso<Input type="date" value={fechaDesembolso} onChange={e => setFechaDesembolso(e.target.value)} required /></label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monto a Prestar ($)</Label>
              <Input type="number" value={monto} onChange={e => setMonto(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Tasa de Interés (%)</Label>
              <div className="flex gap-2">
                <Input type="number" step="0.01" value={tasaInteres} onChange={e => setTasaInteres(e.target.value)} required className="flex-1" />
                <Select value={periodoTasa} onValueChange={val => (val === "mensual" || val === "anual") && setPeriodoTasa(val)}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Interés</Label>
              <Select value={tipoInteres} onValueChange={val => (val === "fijo" || val === "saldo_deudor") && setTipoInteres(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fijo">Interés Fijo (Simple)</SelectItem>
                  <SelectItem value="saldo_deudor">Saldo Deudor (Francés)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frecuencia de Pago</Label>
              <Select value={frecuenciaPago} onValueChange={val => (val === "diario" || val === "semanal" || val === "quincenal" || val === "mensual") && setFrecuenciaPago(val)}>
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

          {(validSimulation && simulacion.length > 0) && (
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
            <Button type="submit" disabled={loading || (!validSimulation || simulacion.length === 0)}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aprobar Préstamo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
