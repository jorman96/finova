"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchPicker } from '@/components/SearchPicker';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Loader2, DollarSign, Calendar, TrendingUp, Briefcase, AlertCircle, Percent } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, doc, writeBatch, serverTimestamp, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Inversionista, ModalidadPagoInversionista } from "@/types";
import { generarCronogramaInversion } from "@/lib/calculadoraInversion";
import { format, addMonths } from "date-fns";
import { NuevoInversionistaDialog } from "./NuevoInversionistaDialog";

interface NuevaInversionDialogProps {
  onInversionCreada?: () => void;
  triggerButton?: React.ReactNode;
}

export function NuevaInversionDialog({ onInversionCreada, triggerButton }: NuevaInversionDialogProps) {
  const { userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inversionistas, setInversionistas] = useState<Inversionista[]>([]);
  const [loadingInversionistas, setLoadingInversionistas] = useState(false);

  // Form states
  const [inversionistaId, setInversionistaId] = useState("");
  const [montoTotal, setMontoTotal] = useState<number>(0);
  const [montoCartera, setMontoCartera] = useState<number>(0);
  const [montoOtros, setMontoOtros] = useState<number>(0);
  const [tieneInteres, setTieneInteres] = useState(false);
  const [tasaInteresMensual, setTasaInteresMensual] = useState<number>(0);
  const [modalidadPago, setModalidadPago] = useState<ModalidadPagoInversionista>('interes_mensual_capital_al_vencimiento');
  const [plazoMeses, setPlazoMeses] = useState<number>(6);
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fechaPrimerPago, setFechaPrimerPago] = useState(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [observaciones, setObservaciones] = useState("");

  // Cargar lista de inversionistas
  const fetchInversionistas = async () => {
    if (!userData?.empresaId) return;
    setLoadingInversionistas(true);
    try {
      const q = query(collection(db, "inversionistas"), where("empresaId", "==", userData.empresaId));
      const snap = await getDocs(q);
      const list: Inversionista[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Inversionista));
      setInversionistas(list);
    } catch (e: any) {
      console.error("Error al cargar inversionistas:", e);
    } finally {
      setLoadingInversionistas(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchInversionistas();
    }
  }, [open, userData?.empresaId]);

  // Manejo de cambio de Monto Total
  const handleMontoTotalChange = (nuevoTotal: number) => {
    const val = Math.max(0, nuevoTotal);
    setMontoTotal(val);
    // Si la suma no coincide o montoCartera supera el total, ajustar montoOtros
    if (montoCartera > val) {
      setMontoCartera(val);
      setMontoOtros(0);
    } else {
      setMontoOtros(Number((val - montoCartera).toFixed(2)));
    }
  };

  // Manejo de cambio de Monto a Cartera
  const handleMontoCarteraChange = (nuevoCartera: number) => {
    const val = Math.max(0, Math.min(montoTotal, nuevoCartera));
    setMontoCartera(val);
    setMontoOtros(Number((montoTotal - val).toFixed(2)));
  };

  // Manejo de cambio de Monto a Otros
  const handleMontoOtrosChange = (nuevoOtros: number) => {
    const val = Math.max(0, Math.min(montoTotal, nuevoOtros));
    setMontoOtros(val);
    setMontoCartera(Number((montoTotal - val).toFixed(2)));
  };

  // Cronograma proyectado en vivo
  const resumenCronograma = useMemo(() => {
    if (montoTotal <= 0 || plazoMeses <= 0 || !fechaPrimerPago) {
      return { cuotas: [], totalCapital: 0, totalInteres: 0, totalPagar: 0 };
    }
    return generarCronogramaInversion({
      montoTotal,
      tieneInteres,
      tasaInteresMensual: tieneInteres ? tasaInteresMensual : 0,
      modalidadPago: tieneInteres ? modalidadPago : 'devolucion_capital_en_cuotas',
      plazoMeses,
      fechaPrimerPago
    });
  }, [montoTotal, tieneInteres, tasaInteresMensual, modalidadPago, plazoMeses, fechaPrimerPago]);

  const porcentajeCartera = montoTotal > 0 ? ((montoCartera / montoTotal) * 100).toFixed(1) : "0";
  const porcentajeOtros = montoTotal > 0 ? ((montoOtros / montoTotal) * 100).toFixed(1) : "0";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inversionistaId) {
      toast.error("Seleccione un inversionista o cree uno nuevo");
      return;
    }
    if (montoTotal <= 0) {
      toast.error("El monto total debe ser mayor a 0");
      return;
    }
    if (Math.abs((montoCartera + montoOtros) - montoTotal) > 0.01) {
      toast.error("La suma de Cartera y Otros debe ser exactamente igual al Monto Total");
      return;
    }
    if (!userData?.empresaId) {
      toast.error("Empresa no identificada");
      return;
    }

    const inversionistaSel = inversionistas.find(inv => inv.id === inversionistaId);
    const inversionistaNombre = inversionistaSel ? `${inversionistaSel.nombres} ${inversionistaSel.apellidos || ''}`.trim() : "Inversionista";

    setLoading(true);
    try {
      const batch = writeBatch(db);

      // 1. Crear documento de Contrato de Inversión
      const contratoRef = doc(collection(db, "inversion_contratos"));
      const contratoData = {
        empresaId: userData.empresaId,
        inversionistaId,
        inversionistaNombre,
        inversionistaIdentificacion: inversionistaSel?.identificacion || "",
        montoTotal,
        montoCartera,
        montoOtros,
        tieneInteres,
        tasaInteresMensual: tieneInteres ? tasaInteresMensual : 0,
        modalidadPago: tieneInteres ? modalidadPago : 'devolucion_capital_en_cuotas',
        plazoMeses,
        fechaInicio,
        fechaPrimerPago,
        totalInteresPagar: resumenCronograma.totalInteres,
        totalPagar: resumenCronograma.totalPagar,
        totalPagado: 0,
        saldoPendiente: resumenCronograma.totalPagar,
        estado: 'activo',
        observaciones: observaciones.trim(),
        createdAt: serverTimestamp()
      };
      batch.set(contratoRef, contratoData);

      // 2. Crear las cuotas proyectadas del inversionista
      resumenCronograma.cuotas.forEach(c => {
        const cuotaRef = doc(collection(db, "cuotas_inversionistas"));
        batch.set(cuotaRef, {
          empresaId: userData.empresaId,
          inversionContratoId: contratoRef.id,
          inversionistaId,
          numeroCuota: c.numeroCuota,
          fechaVencimiento: c.fechaVencimiento,
          capital: c.capital,
          interes: c.interes,
          totalCuota: c.totalCuota,
          montoPagado: 0,
          saldoRestante: c.totalCuota,
          estado: 'pendiente'
        });
      });

      // 3. Actualizar estadísticas del Inversionista
      const inversionistaRef = doc(db, "inversionistas", inversionistaId);
      batch.update(inversionistaRef, {
        totalInvertido: increment(montoTotal),
        saldoPendiente: increment(resumenCronograma.totalPagar)
      });

      await batch.commit();

      toast.success("¡Inversión registrada y cronograma generado exitosamente!");
      setOpen(false);
      if (onInversionCreada) {
        onInversionCreada();
      }
    } catch (err: any) {
      console.error("Error al registrar inversión:", err);
      toast.error("Error al registrar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerButton ? (triggerButton as any) : <Button className="gap-2 " />}>
        {!triggerButton && (
          <>
            <PlusCircle className="h-4 w-4" />
            Nueva Inversión
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Briefcase className="h-5 w-5 text-emerald-600" />
            Registrar Fondeo de Inversionista
          </DialogTitle>
          <DialogDescription>
            Registra el capital inyectado por un tercero, desglosa el destino de los fondos y genera el cronograma de liquidaciones.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <p className="rounded-lg border bg-muted/30 p-3 text-sm">Registra este financiamiento una sola vez. Si ya ingresaste el dinero como aporte en Pagos de capital, solicita su vinculación y conciliación antes de crear otro registro de fondeo.</p>
          {/* Selección de Inversionista */}
          <div className="space-y-1.5 bg-muted/30 p-3 rounded-lg border">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-sm">Inversionista Fondeador *</Label>
              <NuevoInversionistaDialog
                onInversionistaCreado={(id) => {
                  fetchInversionistas();
                  setInversionistaId(id);
                }}
                triggerButton={
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-primary font-medium">
                    + Registrar Nuevo Inversionista
                  </Button>
                }
              />
            </div>
            {loadingInversionistas ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando inversionistas...
              </div>
            ) : inversionistas.length === 0 ? (
              <div className="text-xs text-amber-600 dark:text-amber-400 py-1 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> No hay inversionistas registrados. Haz clic arriba para registrar el primero.
              </div>
            ) : (
              <SearchPicker label="Inversionista fondeador" value={inversionistaId} onChange={setInversionistaId} items={inversionistas.map(inv => ({ id: inv.id, label: `${inv.nombres} ${inv.apellidos || ''} — ${inv.identificacion}`, search: inv.banco || '' }))} />
            )}
          </div>

          {/* Monto Total y Distribución de Fondos */}
          <div className="space-y-3 bg-card p-4 rounded-lg border shadow-sm">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Monto y Destino del Capital
            </h4>

            <div className="space-y-1.5">
              <Label htmlFor="montoTotal" className="text-xs font-medium text-muted-foreground">
                Monto Total Inyectado ($ USD) *
              </Label>
              <Input
                id="montoTotal"
                type="number"
                step="0.01"
                min="1"
                value={montoTotal || ""}
                onChange={e => handleMontoTotalChange(parseFloat(e.target.value) || 0)}
                className="text-lg font-bold"
                required
              />
            </div>

            {/* Barra de Distribución Visual */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>Cartera Préstamos: {porcentajeCartera}% (${montoCartera.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
                <span>Otros Gastos/Operativo: {porcentajeOtros}% (${montoOtros.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, parseFloat(porcentajeCartera)))}%` }}
                  title="Destinado a Cartera de Créditos"
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, parseFloat(porcentajeOtros)))}%` }}
                  title="Destinado a Otros Gastos"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1 p-2.5 rounded-md border bg-emerald-500/5 border-emerald-500/20">
                <Label htmlFor="montoCartera" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Destinado a Cartera de Créditos
                </Label>
                <Input
                  id="montoCartera"
                  type="number"
                  step="0.01"
                  min="0"
                  max={montoTotal}
                  value={montoCartera || ""}
                  onChange={e => handleMontoCarteraChange(parseFloat(e.target.value) || 0)}
                  className="bg-background text-sm font-semibold"
                />
                <p className="text-[11px] text-muted-foreground">
                  Suma a la <strong>Caja de Préstamos</strong> para colocar créditos a prestatarios.
                </p>
              </div>

              <div className="space-y-1 p-2.5 rounded-md border bg-amber-500/5 border-amber-500/20">
                <Label htmlFor="montoOtros" className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Destinado a Otros Gastos / Operativo
                </Label>
                <Input
                  id="montoOtros"
                  type="number"
                  step="0.01"
                  min="0"
                  max={montoTotal}
                  value={montoOtros || ""}
                  onChange={e => handleMontoOtrosChange(parseFloat(e.target.value) || 0)}
                  className="bg-background text-sm font-semibold"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se registra para trazabilidad pero <strong>NO infla</strong> la caja de colocación.
                </p>
              </div>
            </div>
          </div>

          {/* Condiciones de Retorno / Rendimiento */}
          <div className="space-y-3 bg-card p-4 rounded-lg border shadow-sm">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              Condiciones de Pago al Inversionista
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">¿Paga Interés / Rendimiento?</Label>
                <Select value={tieneInteres ? "si" : "no"} onValueChange={v => setTieneInteres(v === "si")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Con Interés / Rendimiento</SelectItem>
                    <SelectItem value="no">Sin Interés (Solo Capital)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tieneInteres ? (
                <div className="space-y-1.5">
                  <Label htmlFor="tasaInteres" className="text-xs font-medium flex items-center gap-1">
                    <Percent className="h-3 w-3" /> Tasa Mensual Acordada (%)
                  </Label>
                  <Input
                    id="tasaInteres"
                    type="number"
                    step="0.1"
                    min="0"
                    value={tasaInteresMensual || ""}
                    onChange={e => setTasaInteresMensual(parseFloat(e.target.value) || 0)}
                    placeholder="Ej. 2.5"
                  />
                </div>
              ) : (
                <div className="space-y-1.5 opacity-50">
                  <Label className="text-xs font-medium">Tasa Mensual</Label>
                  <Input disabled value="0.0% (Sin interés)" />
                </div>
              )}
            </div>

            {tieneInteres && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Modalidad de Pago del Inversionista</Label>
                <Select value={modalidadPago} onValueChange={(v) => v && setModalidadPago(v as ModalidadPagoInversionista)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interes_mensual_capital_al_vencimiento">
                      Interés mensual + Devolución de capital al vencimiento (Recomendado)
                    </SelectItem>
                    <SelectItem value="cuota_amortizada_mensual">
                      Cuota amortizada mensual (Capital + Interés mes a mes)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {modalidadPago === 'interes_mensual_capital_al_vencimiento'
                    ? "El inversionista recibe solo intereses mensualmente (pagados con los cobros de tus prestatarios) y al finalizar el plazo se devuelve el capital completo."
                    : "Cada mes se paga una fracción del capital junto con el rendimiento pactado."}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plazoMeses" className="text-xs font-medium">Plazo (Meses)</Label>
                <Input
                  id="plazoMeses"
                  type="number"
                  min="1"
                  max="120"
                  value={plazoMeses || ""}
                  onChange={e => setPlazoMeses(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fechaInicio" className="text-xs font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Fecha de Ingreso
                </Label>
                <Input
                  id="fechaInicio"
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fechaPrimerPago" className="text-xs font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Fecha 1er Pago
                </Label>
                <Input
                  id="fechaPrimerPago"
                  type="date"
                  value={fechaPrimerPago}
                  onChange={e => setFechaPrimerPago(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Resumen del Contrato y Previsualización de Cuotas */}
          <div className="space-y-3 bg-muted/20 p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Resumen de Liquidación Proyectada
              </h4>
              <div className="text-xs space-x-2">
                <span className="text-muted-foreground">Total Rendimiento:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ${resumenCronograma.totalInteres.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-muted-foreground ml-2">Total a Devolver:</span>
                <span className="font-bold text-foreground">
                  ${resumenCronograma.totalPagar.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden bg-card max-h-[220px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-12 text-center text-xs">#</TableHead>
                    <TableHead className="text-xs">Fecha Pago</TableHead>
                    <TableHead className="text-right text-xs">Capital</TableHead>
                    <TableHead className="text-right text-xs">Rendimiento</TableHead>
                    <TableHead className="text-right text-xs font-bold">Cuota Mensual</TableHead>
                    <TableHead className="text-right text-xs">Saldo Deudor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumenCronograma.cuotas.map(c => (
                    <TableRow key={c.numeroCuota} className="text-xs">
                      <TableCell className="text-center font-medium">{c.numeroCuota}</TableCell>
                      <TableCell>{c.fechaVencimiento}</TableCell>
                      <TableCell className="text-right">${c.capital.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                        ${c.interes.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold">${c.totalCuota.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">${c.saldoRestante.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observaciones" className="text-xs font-medium">Observaciones / Notas del Contrato</Label>
            <Input
              id="observaciones"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Ej. Fondos inyectados para expansión Q4, pago con intereses de cartera comercial"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2 ">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar y Crear Contrato de Inversión
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
