import { isOverdue } from "./business-date";
import { cents } from "./money";
export interface MetricRecord { [key: string]: unknown }
export function exactCollectedInterest(payments: MetricRecord[]) {
  let amount = 0, missing = 0;
  for (const p of payments) {
    if (p.anulado) continue;
    if (p.desgloseVersion === 1 && typeof p.montoInteres === "number") amount += cents(p.montoInteres);
    else missing++;
  }
  return { amount: amount / 100, missing };
}
export function overdueAmount(cuotas: { fechaVencimiento: string; totalCuota: number; montoPagado?: number; estado?: string }[], today: string) {
  return cuotas.filter(c => isOverdue(c, today)).reduce((sum, c) => sum + cents(c.totalCuota) - cents(c.montoPagado || 0), 0) / 100;
}
