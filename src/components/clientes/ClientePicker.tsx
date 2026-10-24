"use client";
import { SearchPicker } from '@/components/SearchPicker';
import type { Cliente } from '@/types';
export function ClientePicker({ clientes, value, onChange }: { clientes: Cliente[]; value: string; onChange: (id: string) => void }) {
  return <SearchPicker id="credito-cliente" label="Cliente" value={value} onChange={onChange} items={clientes.map(c => ({ id: c.id, label: `${c.nombres} ${c.apellidos} — ${c.cedula}`, search: `${c.telefonoPrincipal || ''} ${c.correo || ''}` }))} />;
}
