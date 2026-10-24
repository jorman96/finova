"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Landmark } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NuevoInversionistaDialogProps {
  onInversionistaCreado?: (id: string, nombre: string) => void;
  triggerButton?: React.ReactNode;
}

export function NuevoInversionistaDialog({ onInversionistaCreado, triggerButton }: NuevoInversionistaDialogProps) {
  const { userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    nombres: "",
    apellidos: "",
    identificacion: "",
    telefono: "",
    correo: "",
    direccion: "",
    banco: "",
    tipoCuenta: "ahorros",
    numeroCuenta: "",
    titularCuenta: ""
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombres.trim() || !formData.identificacion.trim() || !formData.telefono.trim()) {
      toast.error("Por favor complete al menos el nombre, identificación y teléfono");
      return;
    }

    if (!userData?.empresaId) {
      toast.error("Error: Empresa no identificada");
      return;
    }

    setLoading(true);
    try {
      const nombreCompleto = `${formData.nombres.trim()} ${formData.apellidos.trim()}`.trim();
      const docRef = await addDoc(collection(db, "inversionistas"), {
        empresaId: userData.empresaId,
        nombres: formData.nombres.trim(),
        apellidos: formData.apellidos.trim(),
        identificacion: formData.identificacion.trim(),
        telefono: formData.telefono.trim(),
        correo: formData.correo.trim(),
        direccion: formData.direccion.trim(),
        banco: formData.banco.trim(),
        tipoCuenta: formData.tipoCuenta,
        numeroCuenta: formData.numeroCuenta.trim(),
        titularCuenta: formData.titularCuenta.trim() || nombreCompleto,
        estado: 'activo',
        totalInvertido: 0,
        totalPagado: 0,
        saldoPendiente: 0,
        createdAt: serverTimestamp()
      });

      toast.success("Inversionista registrado exitosamente");
      setOpen(false);
      setFormData({
        nombres: "",
        apellidos: "",
        identificacion: "",
        telefono: "",
        correo: "",
        direccion: "",
        banco: "",
        tipoCuenta: "ahorros",
        numeroCuenta: "",
        titularCuenta: ""
      });

      if (onInversionistaCreado) {
        onInversionistaCreado(docRef.id, nombreCompleto);
      }
    } catch (error: any) {
      console.error("Error al registrar inversionista:", error);
      toast.error("Error al registrar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerButton ? (triggerButton as any) : <Button className="gap-2" />}>
        {!triggerButton && (
          <>
            <UserPlus className="h-4 w-4" />
            Nuevo Inversionista
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Registrar Nuevo Inversionista
          </DialogTitle>
          <DialogDescription>
            Registra una persona o empresa fondeadora para asignarle contratos de inversión y pagos de rendimientos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombres">Nombres / Razón Social *</Label>
              <Input
                id="nombres"
                value={formData.nombres}
                onChange={e => handleChange("nombres", e.target.value)}
                placeholder="Ej. Roberto o Inversiones S.A."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apellidos">Apellidos</Label>
              <Input
                id="apellidos"
                value={formData.apellidos}
                onChange={e => handleChange("apellidos", e.target.value)}
                placeholder="Ej. Mendoza"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="identificacion">Cédula / RUC / Pasaporte *</Label>
              <Input
                id="identificacion"
                value={formData.identificacion}
                onChange={e => handleChange("identificacion", e.target.value)}
                placeholder="0999999999"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefono">Teléfono / WhatsApp *</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={e => handleChange("telefono", e.target.value)}
                placeholder="+593 99 999 9999"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="correo">Correo Electrónico</Label>
              <Input
                id="correo"
                type="email"
                value={formData.correo}
                onChange={e => handleChange("correo", e.target.value)}
                placeholder="inversionista@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direccion">Ciudad / Dirección</Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={e => handleChange("direccion", e.target.value)}
                placeholder="Guayaquil / Quito"
              />
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Datos Bancarios para Liquidación de Rendimientos
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="banco">Banco de Destino</Label>
                <Input
                  id="banco"
                  value={formData.banco}
                  onChange={e => handleChange("banco", e.target.value)}
                  placeholder="Ej. Banco Pichincha, Guayaquil, etc."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tipoCuenta">Tipo de Cuenta</Label>
                <Select value={formData.tipoCuenta} onValueChange={val => handleChange("tipoCuenta", val || "ahorros")}>
                  <SelectTrigger id="tipoCuenta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ahorros">Ahorros</SelectItem>
                    <SelectItem value="corriente">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="numeroCuenta">Número de Cuenta</Label>
                <Input
                  id="numeroCuenta"
                  value={formData.numeroCuenta}
                  onChange={e => handleChange("numeroCuenta", e.target.value)}
                  placeholder="2200000000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="titularCuenta">Titular de la Cuenta</Label>
                <Input
                  id="titularCuenta"
                  value={formData.titularCuenta}
                  onChange={e => handleChange("titularCuenta", e.target.value)}
                  placeholder="Dejar vacío si es el mismo"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar Inversionista
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
