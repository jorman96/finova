'use client';
import { useEffect } from 'react';
export function useUnsavedDialog(open: boolean, setOpen: (open: boolean) => void, dirty: boolean, busy = false) {
  useEffect(() => {
    if (!open || !dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [open, dirty]);
  return (next: boolean) => {
    if (busy) return;
    if (!next && dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres cerrar este formulario?')) return;
    setOpen(next);
  };
}
