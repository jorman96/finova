'use client';
import { Combobox } from '@base-ui/react/combobox';
import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { matchesText } from '@/lib/client-search';
type Item = { id: string; label: string; search?: string };
export function SearchPicker({ items, value, onChange, label, id }: { items: Item[]; value: string; onChange: (id: string) => void; label: string; id?: string }) {
  const generatedId = useId();
  const [input, setInput] = useState<string | null>(null);
  const selected = items.find(i => i.id === value) || null;
  return <Combobox.Root<Item> items={items} value={selected} inputValue={input ?? selected?.label ?? ''} itemToStringLabel={i => i.label} isItemEqualToValue={(a, b) => a.id === b.id} filter={(item, query) => matchesText(`${item.label} ${item.search || ''}`, query)} onInputValueChange={(next, details) => { if (details.reason === 'input-change') { setInput(next); onChange(''); } }} onValueChange={item => { onChange(item?.id || ''); setInput(null); }}>
    <div className="relative"><Combobox.Input id={id || generatedId} aria-label={label} placeholder="Escribe un nombre o identificación…" className="min-h-11 w-full rounded-md border border-input bg-background px-3 pr-11 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /><Combobox.Trigger aria-label={`Mostrar lista: ${label}`} className="absolute right-0 top-0 flex size-11 items-center justify-center"><ChevronDown className="size-4" /></Combobox.Trigger></div>
    <Combobox.Portal><Combobox.Positioner sideOffset={4} className="z-[100]"><Combobox.Popup className="w-[var(--anchor-width)] rounded-lg border bg-popover text-popover-foreground"><Combobox.Empty className="p-3 text-sm text-muted-foreground">No hay coincidencias. Revisa el nombre o identificación.</Combobox.Empty><Combobox.List className="max-h-60 overflow-auto p-1">{(item: Item) => <Combobox.Item key={item.id} value={item} className="cursor-pointer rounded px-3 py-3 text-sm data-highlighted:bg-accent data-selected:font-semibold">{item.label}</Combobox.Item>}</Combobox.List></Combobox.Popup></Combobox.Positioner></Combobox.Portal>
  </Combobox.Root>;
}
