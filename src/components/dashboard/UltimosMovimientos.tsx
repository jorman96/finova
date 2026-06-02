"use client";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UltimosMovimientosProps {
  data: any[];
}

export function UltimosMovimientos({ data }: UltimosMovimientosProps) {
  // Tomar solo los últimos 5
  const recientes = data.slice(0, 5);

  if (recientes.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/10 rounded-md">
        Aún no se han registrado movimientos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recientes.map((pago, idx) => {
        const nombre = pago.clienteNombre || 'Cliente N/A';
        const iniciales = nombre.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
        
        let dateStr = 'Reciente';
        if (pago.fecha) {
          const dateObj = pago.fecha.toDate ? pago.fecha.toDate() : new Date(pago.fecha);
          dateStr = dateObj.toLocaleDateString();
        }

        return (
          <div key={pago.id || idx} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 bg-primary/10">
                <AvatarFallback className="text-primary font-medium">{iniciales}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-semibold truncate max-w-[150px] sm:max-w-[180px]">{nombre}</span>
                <span className="text-xs text-muted-foreground">
                  {dateStr} • {pago.metodo} {pago.cuentaDestino ? `(${pago.cuentaDestino.split(' - ')[0]})` : ''}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                +${pago.monto.toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
