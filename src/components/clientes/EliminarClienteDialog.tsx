"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiPost } from "@/lib/api-client";
import type { Cliente } from "@/types";

export function EliminarClienteDialog({ cliente, onDeleted }: { cliente: Cliente; onDeleted: () => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      await apiPost("/api/clientes/eliminar", { clienteId: cliente.id });
      toast.success("Cliente eliminado."); setOpen(false); onDeleted();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo eliminar el cliente."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
    <DialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>Eliminar</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Eliminar cliente</DialogTitle>
      <DialogDescription>Vas a eliminar a {cliente.nombres} {cliente.apellidos} (cédula {cliente.cedula}). Esta acción no se puede deshacer. Solo se permite si no tiene créditos, cuotas ni pagos registrados. Los documentos almacenados se conservan para su revisión administrativa.</DialogDescription>
    </DialogHeader><DialogFooter>
      <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
      <Button variant="destructive" disabled={busy} onClick={remove}>{busy ? "Eliminando..." : "Eliminar cliente"}</Button>
    </DialogFooter></DialogContent>
  </Dialog>;
}
