"use client";

import { useState } from "react";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function MigrationPage() {
  const { userData } = useAuth();
  const [migrando, setMigrando] = useState(false);

  const handleMigrate = async () => {
    if (!userData || userData.rol !== "superadmin") {
      toast.error("Solo el superadmin puede hacer esto.");
      return;
    }
    
    setMigrando(true);
    try {
      const collections = ["clientes", "prestamos", "cuotas", "pagos"];
      let count = 0;

      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        for (const document of snap.docs) {
          const data = document.data();
          // Si no tiene empresaId, o es diferente al del superadmin
          if (!data.empresaId || data.empresaId !== userData.empresaId) {
            await updateDoc(doc(db, col, document.id), {
              empresaId: userData.empresaId
            });
            count++;
          }
        }
      }

      toast.success(`Migración completada. Se actualizaron ${count} registros antiguos.`);
    } catch (error) {
      console.error(error);
      toast.error("Error en la migración.");
    } finally {
      setMigrando(false);
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto text-center space-y-6">
      <h1 className="text-2xl font-bold">Migrador de Datos Antiguos</h1>
      <p className="text-muted-foreground">
        Esta herramienta buscará todos los préstamos, clientes, pagos y cuotas creados antes de la arquitectura multi-inquilino y se los asignará a tu cuenta de Dueño de la Plataforma (Superadmin).
      </p>
      <Button onClick={handleMigrate} disabled={migrando} className="w-full">
        {migrando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Asignar registros huérfanos a mi cuenta
      </Button>
    </div>
  );
}
