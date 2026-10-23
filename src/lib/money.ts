export function cents(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1e10) throw new Error("Monto fuera de rango");
  return Math.round((value + Math.sign(value) * Number.EPSILON) * 100);
}
export function money(value: number): number { return cents(value) / 100; }
export function sumMoney(values: number[]): number { return values.reduce((sum, n) => sum + cents(n), 0) / 100; }
/** Interest first. Difference of cumulative allocations makes partial payments additive. */
export function splitPayment(capital: number, interest: number, alreadyPaid: number, payment: number) {
  const total = cents(capital) + cents(interest), before = cents(alreadyPaid), amount = cents(payment);
  if (amount <= 0 || before < 0 || before + amount > total) throw new Error("Abono inválido para la cuota");
  const interestBefore = Math.min(before, cents(interest)), interestAfter = Math.min(before + amount, cents(interest));
  return { capital: (amount - interestAfter + interestBefore) / 100, interes: (interestAfter - interestBefore) / 100 };
}
