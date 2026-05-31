"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface ScoreGaugeProps {
  score: number;
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  // Normalize score between 0 and 100
  const normalizedScore = Math.min(Math.max(score || 0, 0), 100);
  
  const data = [
    { name: "Score", value: normalizedScore },
    { name: "Rest", value: 100 - normalizedScore },
  ];

  let color = "#ef4444"; // Rojo (Malo < 40)
  if (normalizedScore >= 40 && normalizedScore < 75) color = "#eab308"; // Amarillo (Neutral 40-74)
  if (normalizedScore >= 75) color = "#22c55e"; // Verde (Excelente >= 75)

  let label = "Riesgo Alto";
  if (normalizedScore >= 40 && normalizedScore < 75) label = "Regular";
  if (normalizedScore >= 75) label = "Excelente";

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-48 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
              cornerRadius={0}
            >
              <Cell key="cell-0" fill={color} />
              <Cell key="cell-1" fill="currentColor" className="text-muted/20" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-end">
          <span className="text-4xl font-black tracking-tighter" style={{ color }}>{normalizedScore}</span>
        </div>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider mt-2" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
