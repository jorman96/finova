"use client";

import { useState, useId } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { useUnsavedDialog } from '@/hooks/use-unsaved-dialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2 } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

export function NuevoClienteDialog() {
  const { userData } = useAuth();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombres: "",
    apellidos: "",
    cedula: "",
    fechaNacimiento: "",
    genero: "",
    estadoCivil: "",
    telefonoPrincipal: "",
    telefonoSecundario: "",
    correo: "",
    direccion: "",
    empresa: "",
    cargo: "",
    ingresosMensuales: "",
    antiguedadLaboral: "",
    referencia1: "",
    telefonoRef1: "",
    referencia2: "",
    telefonoRef2: "",
  });

  const changeOpen = useUnsavedDialog(open, setOpen, Object.values(formData).some(Boolean), loading);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.empresaId) {
       toast.error("No se pudo identificar la empresa.");
       return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "clientes"), {
        ...formData,
        empresaId: userData.empresaId,
        ingresosMensuales: Number(formData.ingresosMensuales),
        estado: 'nuevo',
        createdAt: serverTimestamp(),
      });

      toast.success("Cliente agregado exitosamente");
      setOpen(false);
      setFormData({
        nombres: "", apellidos: "", cedula: "", fechaNacimiento: "",
        genero: "", estadoCivil: "", telefonoPrincipal: "", telefonoSecundario: "",
        correo: "", direccion: "", empresa: "", cargo: "", ingresosMensuales: "",
        antiguedadLaboral: "", referencia1: "", telefonoRef1: "", referencia2: "", telefonoRef2: ""
      });
    } catch (error) {
      console.error("Error agregando cliente:", error);
      toast.error("Hubo un error al agregar el cliente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
          <DialogDescription>
            Ingresa la información detallada del cliente para crear su perfil financiero.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="laboral">Laboral</TabsTrigger>
              <TabsTrigger value="referencias">Referencias</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-0`}> Nombres</Label>
                  <Input id={`${fieldId}-0`} name="nombres" value={formData.nombres} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-1`}> Apellidos</Label>
                  <Input id={`${fieldId}-1`} name="apellidos" value={formData.apellidos} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-2`}> Cédula / ID</Label>
                  <Input id={`${fieldId}-2`} name="cedula" value={formData.cedula} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-3`}> Fecha de Nacimiento</Label>
                  <Input id={`${fieldId}-3`} type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-4`}> Teléfono Principal</Label>
                  <Input id={`${fieldId}-4`} name="telefonoPrincipal" value={formData.telefonoPrincipal} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-5`}> Correo Electrónico</Label>
                  <Input id={`${fieldId}-5`} type="email" name="correo" value={formData.correo} onChange={handleChange} required />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor={`${fieldId}-6`}> Dirección</Label>
                  <Input id={`${fieldId}-6`} name="direccion" value={formData.direccion} onChange={handleChange} required />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="laboral" className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-7`}> Empresa</Label>
                  <Input id={`${fieldId}-7`} name="empresa" value={formData.empresa} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-8`}> Cargo</Label>
                  <Input id={`${fieldId}-8`} name="cargo" value={formData.cargo} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-9`}> Ingresos Mensuales ($)</Label>
                  <Input id={`${fieldId}-9`} type="number" name="ingresosMensuales" value={formData.ingresosMensuales} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-10`}> Antigüedad Laboral</Label>
                  <Input id={`${fieldId}-10`} name="antiguedadLaboral" placeholder="Ej. 2 años" value={formData.antiguedadLaboral} onChange={handleChange} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="referencias" className="space-y-4 py-4">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-11`}> Nombre Referencia 1</Label>
                  <Input id={`${fieldId}-11`} name="referencia1" value={formData.referencia1} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-12`}> Teléfono Referencia 1</Label>
                  <Input id={`${fieldId}-12`} name="telefonoRef1" value={formData.telefonoRef1} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-13`}> Nombre Referencia 2</Label>
                  <Input id={`${fieldId}-13`} name="referencia2" value={formData.referencia2} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-14`}> Teléfono Referencia 2</Label>
                  <Input id={`${fieldId}-14`} name="telefonoRef2" value={formData.telefonoRef2} onChange={handleChange} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
