"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFinanceRequest } from "@/lib/use-finance-request";
import { toast } from "sonner";
import type { Prestamo } from "@/types";

interface EliminarPrestamoDialogProps {
  prestamo: Prestamo;
  onDeleted?: () => void;
  triggerButton?: React.ReactElement;
}

export function EliminarPrestamoDialog({ prestamo, onDeleted, triggerButton }: EliminarPrestamoDialogProps) {
  const { userData } = useAuth();
  const finance = useFinanceRequest();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [asumeResponsabilidad, setAsumeResponsabilidad] = useState(false);

  // Solo dueño, admin o superadmin pueden eliminar
  const canDelete = userData?.rol === "dueño" || userData?.rol === "superadmin" || userData?.rol === "admin";
  if (!canDelete) return null;

  const handleDelete = async () => {
    if (!motivo.trim() || motivo.trim().length < 5) {
      toast.error("Por favor ingresa un motivo válido de al menos 5 caracteres.");
      return;
    }
    if (!asumeResponsabilidad) {
      toast.error("Debes confirmar la responsabilidad del dueño para proceder.");
      return;
    }

    setLoading(true);
    try {
      finance.reset();
      await finance.submit({
        action: "delete_loan",
        prestamoId: prestamo.id,
        motivo: motivo.trim()
      });

      toast.success("Crédito eliminado exitosamente del sistema.");
      setOpen(false);
      setMotivo("");
      setAsumeResponsabilidad(false);
      if (onDeleted) {
        onDeleted();
      }
    } catch (error: unknown) {
      console.error("Error al eliminar crédito:", error);
      toast.error(error instanceof Error ? error.message : "Error al eliminar el crédito.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!loading) {
        setOpen(val);
        if (!val) {
          setMotivo("");
          setAsumeResponsabilidad(false);
        }
      }
    }}>
      <DialogTrigger render={triggerButton ?? <Button variant="destructive" size="sm" className="gap-1.5" />}>
        {!triggerButton && (
          <>
            <Trash2 className="h-4 w-4" />
            Eliminar Crédito
          </>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-lg font-bold">
            <ShieldAlert className="h-5 w-5" />
            Eliminar Crédito Erróneo
          </DialogTitle>
          <DialogDescription>
            Elimina definitivamente este crédito mal asignado o creado con datos incorrectos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Tarjeta de detalles del crédito a eliminar */}
          <div className="p-3 bg-muted/50 border rounded-lg space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-bold text-foreground text-sm">{prestamo.clienteNombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monto Desembolsado:</span>
              <span className="font-semibold text-foreground">${prestamo.monto?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frecuencia / Plazo:</span>
              <span className="capitalize">{prestamo.frecuenciaPago} ({prestamo.numeroCuotas} cuotas)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha Desembolso:</span>
              <span>{prestamo.fechaDesembolso || "N/A"}</span>
            </div>
          </div>

          {/* Advertencia de responsabilidad */}
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-1 text-destructive">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Responsabilidad del Dueño de la Financiera
            </div>
            <p className="text-[11px] text-muted-foreground">
              Esta acción purgará el crédito y todas sus cuotas asociadas. Si el crédito no estaba anulado previamente, se registrará la reversión del desembolso en caja para mantener la conciliación exacta.
            </p>
          </div>

          {/* Campo de motivo */}
          <div className="space-y-1.5">
            <Label htmlFor="motivoEliminacion" className="font-semibold">
              Motivo de la Eliminación (Obligatorio) *
            </Label>
            <Input
              id="motivoEliminacion"
              placeholder="Ej. Asignado a cliente erróneo, monto o cuotas incorrectas"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={loading}
              className="text-xs"
            />
          </div>

          {/* Checkbox de confirmación */}
          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="asumeResponsabilidad"
              checked={asumeResponsabilidad}
              onCheckedChange={(checked) => setAsumeResponsabilidad(checked === true)}
              disabled={loading}
              className="mt-0.5"
            />
            <Label htmlFor="asumeResponsabilidad" className="text-[11px] leading-tight text-muted-foreground cursor-pointer">
              Confirmo que como dueño/administrador de la financiera asumo la responsabilidad de eliminar este crédito del sistema.
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
            onClick={handleDelete}
            disabled={loading || motivo.trim().length < 5 || !asumeResponsabilidad}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Sí, Eliminar Definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

