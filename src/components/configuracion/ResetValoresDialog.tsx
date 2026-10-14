"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ResetValoresDialog() {
  const { userData } = useAuth();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [progreso, setProgreso] = useState("");

  const CODIGO_CONFIRMACION = "RESETEAR VALORES";

  const handleReset = async () => {
    if (confirmText.trim() !== CODIGO_CONFIRMACION) {
      toast.error(`Escriba exactamente "${CODIGO_CONFIRMACION}" para confirmar`);
      return;
    }

    if (!userData?.empresaId) {
      toast.error("Error: Empresa no identificada");
      return;
    }

    setLoading(true);
    setProgreso("Iniciando eliminación de transacciones...");

    try {
      const empresaId = userData.empresaId;

      // Función auxiliar para eliminar en batches de hasta 400 docs
      const eliminarColeccionPorEmpresa = async (nombreColeccion: string) => {
        setProgreso(`Eliminando registros de ${nombreColeccion}...`);
        const q = query(collection(db, nombreColeccion), where("empresaId", "==", empresaId));
        const snap = await getDocs(q);
        
        const docs = snap.docs;
        const BATCH_SIZE = 400;
        
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const chunk = docs.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      };

      // 1. Eliminar datos financieros transaccionales
      await eliminarColeccionPorEmpresa("prestamos");
      await eliminarColeccionPorEmpresa("cuotas");
      await eliminarColeccionPorEmpresa("pagos");
      await eliminarColeccionPorEmpresa("inversion_contratos");
      await eliminarColeccionPorEmpresa("cuotas_inversionistas");
      await eliminarColeccionPorEmpresa("pagos_inversionistas");

      // 2. Resetear valores de capital en la Empresa
      setProgreso("Restableciendo capital a $0.00...");
      const batchEmpresa = writeBatch(db);
      const empresaRef = doc(db, "empresas", empresaId);
      batchEmpresa.update(empresaRef, {
        capitalInicial: 0,
        inyeccionesCapital: [],
        bitacoraCapital: []
      });
      await batchEmpresa.commit();

      // 3. Resetear estado de los clientes a 'nuevo' sin eliminarlos
      setProgreso("Actualizando lista de clientes...");
      const qClientes = query(collection(db, "clientes"), where("empresaId", "==", empresaId));
      const snapClientes = await getDocs(qClientes);
      
      const docsClientes = snapClientes.docs;
      const BATCH_SIZE = 400;
      for (let i = 0; i < docsClientes.length; i += BATCH_SIZE) {
        const chunk = docsClientes.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(d => {
          batch.update(d.ref, {
            estado: 'nuevo',
            score: 50
          });
        });
        await batch.commit();
      }

      toast.success("¡Valores del sistema eliminados con éxito! Los saldos están en cero y tu lista de clientes se conservó intacta.");
      setOpen(false);
      setConfirmText("");
      setProgreso("");

      // Redirigir al dashboard para ver los saldos en cero
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);

    } catch (error: any) {
      console.error("Error al resetear valores:", error);
      toast.error("Error al resetear valores: " + error.message);
    } finally {
      setLoading(false);
      setProgreso("");
    }
  };

  // Solo dueños o superadmins pueden ver y ejecutar esta acción
  if (userData?.rol !== 'dueño' && userData?.rol !== 'superadmin') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!loading) {
        setOpen(o);
        setConfirmText("");
        setProgreso("");
      }
    }}>
      <DialogTrigger render={<Button variant="destructive" className="gap-2" />}>
        <Trash2 className="h-4 w-4" />
        Eliminar Valores del Sistema (Poner a Cero)
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-lg">
            <ShieldAlert className="h-5 w-5" />
            Zona de Peligro: Reinicio de Valores Financieros
          </DialogTitle>
          <DialogDescription>
            Esta acción de uso único restablece todas las cifras a $0.00 para empezar en limpio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Qué se conserva */}
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-1">
            <p className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              LO QUE SE CONSERVA (No se toca):
            </p>
            <ul className="list-disc list-inside text-muted-foreground pl-1 space-y-0.5">
              <li>Toda tu <strong>lista completa de clientes</strong> (nombres, cédulas, teléfonos, direcciones).</li>
              <li>Tus <strong>usuarios y empleados</strong> con sus accesos.</li>
              <li>Configuración comercial y <strong>cuentas bancarias</strong> registradas.</li>
            </ul>
          </div>

          {/* Qué se elimina */}
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-1">
            <p className="font-bold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              LO QUE SE ELIMINARÁ PERMANENTEMENTE:
            </p>
            <ul className="list-disc list-inside text-muted-foreground pl-1 space-y-0.5">
              <li>Todos los <strong>préstamos otorgados</strong> y sus tablas de amortización.</li>
              <li>Todas las <strong>cuotas y recibos de pago</strong> recaudados.</li>
              <li>Todos los <strong>contratos de inversión</strong> y pagos a inversionistas.</li>
              <li><strong>Capital inicial e inyecciones de capital</strong> (se resetean a $0.00).</li>
              <li>La <strong>Caja Disponible</strong> y todas las métricas volverán a <strong>$0.00</strong>.</li>
            </ul>
          </div>

          {/* Instrucción de confirmación */}
          <div className="space-y-2 pt-1">
            <Label htmlFor="confirmacion" className="text-xs font-semibold text-foreground">
              Para proceder, escribe exactamente la frase <span className="text-destructive font-mono font-bold">{CODIGO_CONFIRMACION}</span> a continuación:
            </Label>
            <Input
              id="confirmacion"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={CODIGO_CONFIRMACION}
              disabled={loading}
              className="font-mono text-xs uppercase"
            />
          </div>

          {loading && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-xs font-medium text-primary animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{progreso || "Procesando eliminación..."}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleReset}
            disabled={loading || confirmText.trim() !== CODIGO_CONFIRMACION}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Confirmar y Poner a Cero
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
