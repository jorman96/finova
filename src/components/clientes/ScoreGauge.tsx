interface ScoreGaugeProps { score: number }
export function ScoreGauge({ score }: ScoreGaugeProps) {
  const value = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
  const color = value < 40 ? "var(--destructive)" : value < 75 ? "var(--chart-3)" : "var(--chart-2)";
  const label = value < 40 ? "Seguimiento prioritario" : value < 75 ? "Regular" : "Buen historial";
  return <div className="flex flex-col items-center" role="img" aria-label={`Indicador interno: ${value} de 100. ${label}`}>
    <svg viewBox="0 0 200 115" className="w-48 h-28" aria-hidden="true">
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--muted)" strokeWidth="16" />
      <path d="M 20 100 A 80 80 0 0 1 180 100" pathLength="100" fill="none" stroke={color} strokeWidth="16" strokeDasharray={`${value} 100`} />
      <text x="100" y="96" textAnchor="middle" fill="currentColor" fontSize="34" fontWeight="700">{value}</text>
    </svg>
    <span className="text-xs font-semibold">{label}</span>
    <p className="text-xs text-muted-foreground text-center mt-2 max-w-52">Indicador interno: inicia en 50 y suma hasta 10 por crédito completado. Los ajustes se auditan.</p>
  </div>;
}
