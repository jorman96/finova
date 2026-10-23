"use client";

import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown } from "lucide-react";
import { matchesClient } from "@/lib/client-search";
import type { Cliente } from "@/types";
import { useState } from "react";

export function ClientePicker({ clientes, value, onChange }: { clientes: Cliente[]; value: string; onChange: (id: string) => void }) {
  const [input, setInput] = useState("");
  const label = (client: Cliente) => `${client.nombres} ${client.apellidos} — ${client.cedula}`;
  return <Combobox.Root<Cliente> items={clientes} value={clientes.find(c => c.id === value) ?? null}
    inputValue={input} onInputValueChange={(next, details) => { setInput(next); if (details.reason === "input-change") onChange(""); }}
    onValueChange={client => { onChange(client?.id ?? ""); setInput(client ? label(client) : ""); }}
    itemToStringLabel={label}
    isItemEqualToValue={(a, b) => a.id === b.id} filter={matchesClient}>
    <div className="relative">
      <Combobox.Input id="credito-cliente" aria-label="Cliente" placeholder="Escribe nombre, apellido o cédula..."
        className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <Combobox.Trigger aria-label="Mostrar lista de clientes" className="absolute right-0 top-0 h-10 px-3"><ChevronDown className="size-4" /></Combobox.Trigger>
    </div>
    <Combobox.Portal><Combobox.Positioner sideOffset={4} className="z-[100]">
      <Combobox.Popup className="w-[var(--anchor-width)] rounded-md border bg-popover text-popover-foreground shadow-md">
        <Combobox.Empty className="p-3 text-sm text-muted-foreground">No se encontraron clientes.</Combobox.Empty>
        <Combobox.List className="max-h-60 overflow-y-auto p-1">
          {(client: Cliente) => <Combobox.Item key={client.id} value={client} className="cursor-pointer rounded-sm px-3 py-2 text-sm data-highlighted:bg-accent data-selected:font-semibold">
            {client.nombres} {client.apellidos} — {client.cedula}
          </Combobox.Item>}
        </Combobox.List>
      </Combobox.Popup>
    </Combobox.Positioner></Combobox.Portal>
  </Combobox.Root>;
}
