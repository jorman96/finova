"use client";

import { useState } from "react";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileEdit } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Cliente } from "@/types";

interface EditarClienteDialogProps {
  cliente: Cliente;
}

export function EditarClienteDialog({ cliente }: EditarClienteDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombres: cliente.nombres || "", 
    apellidos: cliente.apellidos || "", 
    cedula: cliente.cedula || "", 
    fechaNacimiento: cliente.fechaNacimiento || "",
    genero: cliente.genero || "", 
    estadoCivil: cliente.estadoCivil || "", 
    telefonoPrincipal: cliente.telefonoPrincipal || "", 
    telefonoSecundario: cliente.telefonoSecundario || "",
    correo: cliente.correo || "", 
    direccion: cliente.direccion || "", 
    empresa: cliente.empresa || "", 
    cargo: cliente.cargo || "", 
    ingresosMensuales: cliente.ingresosMensuales || "",
    antiguedadLaboral: cliente.antiguedadLaboral || "", 
    referencia1: cliente.referencia1 || "", 
    telefonoRef1: cliente.telefonoRef1 || "", 
    referencia2: cliente.referencia2 || "", 
    telefonoRef2: cliente.telefonoRef2 || ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const clienteRef = doc(db, "clientes", cliente.id);
      await updateDoc(clienteRef, {
        ...formData,
        ingresosMensuales: Number(formData.ingresosMensuales),
      });
      toast.success("Cliente actualizado exitosamente");
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar el cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className="w-full text-left" />}>
        <div className="flex items-center w-full px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer">
          <FileEdit className="mr-2 h-4 w-4" /> Editar
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Actualiza la información del perfil del cliente.
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombres</Label>
                  <Input name="nombres" value={formData.nombres} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos</Label>
                  <Input name="apellidos" value={formData.apellidos} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label>Cédula / ID</Label>
                  <Input name="cedula" value={formData.cedula} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Nacimiento</Label>
                  <Input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono Principal</Label>
                  <Input name="telefonoPrincipal" value={formData.telefonoPrincipal} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label>Correo Electrónico</Label>
                  <Input type="email" name="correo" value={formData.correo} onChange={handleChange} required />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Dirección</Label>
                  <Input name="direccion" value={formData.direccion} onChange={handleChange} required />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="laboral" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input name="empresa" value={formData.empresa} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input name="cargo" value={formData.cargo} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Ingresos Mensuales ($)</Label>
                  <Input type="number" name="ingresosMensuales" value={formData.ingresosMensuales} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Antigüedad Laboral</Label>
                  <Input name="antiguedadLaboral" value={formData.antiguedadLaboral} onChange={handleChange} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="referencias" className="space-y-4 py-4">
               <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Referencia 1</Label>
                  <Input name="referencia1" value={formData.referencia1} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono Referencia 1</Label>
                  <Input name="telefonoRef1" value={formData.telefonoRef1} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Nombre Referencia 2</Label>
                  <Input name="referencia2" value={formData.referencia2} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono Referencia 2</Label>
                  <Input name="telefonoRef2" value={formData.telefonoRef2} onChange={handleChange} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar Cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
