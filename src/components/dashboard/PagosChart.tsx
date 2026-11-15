"use client";

import type { Pago } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";
import { Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from "recharts";

interface PagosChartProps {
  data: Pago[];
}

export function PagosChart({ data }: PagosChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Agrupar por fecha (día)
    const grouped = data.reduce((acc: Record<string, { dateStr: string; dateObj: Date; monto: number }>, pago) => {
      if (!pago.fecha) return acc;
      
      const dateObj = pago.fecha.toDate ? pago.fecha.toDate() : pago.fecha.toDate();
      const dateStr = format(dateObj, "yyyy-MM-dd");
      
      if (!acc[dateStr]) {
        acc[dateStr] = { dateStr, dateObj, monto: 0 };
      }
      acc[dateStr].monto += pago.monto;
      return acc;
    }, {});

    // Convertir a array y ordenar crónológicamente
    const sortedArray = Object.values(grouped).sort(
      (a, b) => a.dateObj.getTime() - b.dateObj.getTime()
    );

    // Formatear para recharts
    return sortedArray.map((item) => ({
      name: format(item.dateObj, "dd MMM", { locale: es }),
      Recaudado: item.monto,
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/10 rounded-md">
        No hay datos suficientes para graficar.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRecaudado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
          <XAxis 
            dataKey="name" 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis 
            tickFormatter={(value) => `$${value}`}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            formatter={(value) => [`$${Number(value || 0).toFixed(2)}`, "Recaudado"]}
            contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
          />
          <Area 
            type="monotone" 
            dataKey="Recaudado" 
            stroke="var(--primary)" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorRecaudado)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
