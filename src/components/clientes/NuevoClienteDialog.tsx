"use client";

import { useState } from "react";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
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
        score: 50,
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
    <Dialog open={open} onOpenChange={setOpen}>
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
                  <Input name="antiguedadLaboral" placeholder="Ej. 2 años" value={formData.antiguedadLaboral} onChange={handleChange} />
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
              Guardar Cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
