'use client';
import { Button } from '@/components/ui/button';
export const PAGE_SIZE = 20;
export function ListPagination({ total, page, onPage }: { total: number; page: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return <nav aria-label="Paginación del listado" className="flex flex-wrap items-center justify-between gap-3 text-sm"><p role="status">{total ? `${current * PAGE_SIZE + 1}–${Math.min((current + 1) * PAGE_SIZE, total)} de ${total} registros` : '0 registros'}</p><div className="flex items-center gap-2"><Button variant="outline" disabled={current === 0} onClick={() => onPage(current - 1)}>Anterior</Button><span>{current + 1} / {pages}</span><Button variant="outline" disabled={current + 1 >= pages} onClick={() => onPage(current + 1)}>Siguiente</Button></div></nav>;
}
export function pageItems<T>(items: T[], page: number) {
  const current = Math.min(page, Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1));
  return items.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
}
export function LoadError({ message }: { message: string }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"><p>{message}</p><Button variant="outline" onClick={() => window.location.reload()}>Reintentar</Button></div>;
}
