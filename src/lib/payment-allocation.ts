import { isOverdue } from "./business-date";
import { cents,splitPayment } from "./money";
export interface PayableInstallment {
  id: string; numeroCuota: number; fechaVencimiento: string; capital: number; interes: number;
  totalCuota: number; montoPagado: number; estado: string;
}
export function allocatePayment(installments: PayableInstallment[], amount: number, today: string) {
  let remaining = cents(amount);
  if (remaining <= 0) throw new Error("El monto debe ser mayor a cero");
  const updates = [];
  for (const cuota of [...installments].sort((a, b) => a.numeroCuota - b.numeroCuota)) {
    if (!remaining || cuota.estado === "anulada") continue;
    const balance = cents(cuota.totalCuota) - cents(cuota.montoPagado || 0);
    if (balance <= 0) continue;
    const applied = Math.min(balance, remaining);
    const split = splitPayment(cuota.capital, cuota.interes, cuota.montoPagado || 0, applied / 100);
    const paid = cents(cuota.montoPagado || 0) + applied;
    const estado = paid >= cents(cuota.totalCuota) ? "pagada" : isOverdue(cuota, today) ? "vencida" : "parcial";
    updates.push({ cuotaId: cuota.id, numeroCuota: cuota.numeroCuota, montoAbonado: applied / 100, valorCuota: cuota.totalCuota, saldoAnterior: balance / 100, saldoRestante: (balance - applied) / 100, ...split, montoPagado: paid / 100, estado });
    remaining -= applied;
  }
  if (remaining > 0) throw new Error("El monto supera el saldo de las cuotas pendientes");
  return updates;
}
