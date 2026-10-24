export class CapitalError extends Error {}
/** Reserved source identifier; this does not create another cash contribution. */
export const INITIAL_CAPITAL_ID = 'finova-initial-capital-v1';
export function add(a: number, b: number) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(a + b)) throw new CapitalError('Importe fuera del rango exacto admitido.');
  return a + b;
}
export function amount(value: unknown, zero = false): number {
  if (zero && (value === 0 || value === '0' || value === '0.00')) return 0;
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(String(value))) throw new CapitalError('Usa importes exactos con hasta dos decimales; el historial impreciso requiere conciliación.');
  const [whole, decimals = ''] = String(value).split('.');
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || (zero ? cents < 0 : cents <= 0)) throw new CapitalError('El importe debe ser positivo.');
  return cents;
}
export function positive(n: number) { if (!Number.isSafeInteger(n) || n <= 0) throw new CapitalError('Importe inválido en centavos.'); return n; }
export function percentage(n: number, bps: number) { return Number(BigInt(n) * BigInt(bps) / BigInt(10000)); }
export function validDate(s: string) {
  const d = new Date(s + 'T12:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function dayInZone(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key)!.value).join('-');
}
export function today() { return dayInZone(new Date()); }
export function sourceDate(value: unknown) {
  if (typeof value !== 'string') throw new CapitalError('El aporte no tiene una fecha verificable.');
  if (validDate(value)) return value;
  const d = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(d.getTime())) throw new CapitalError('La fecha del aporte requiere conciliación.');
  return dayInZone(d);
}
/** BigInt multiplication keeps fractional allocation exact before integer rounding. */
export function share(paid: number, component: number, total: number) {
  if (![paid, component, total].every(Number.isSafeInteger) || paid < 0 || component < 0 || total <= 0 || paid > total || component > total) throw new CapitalError('Distribución monetaria inválida.');
  return Number((BigInt(paid) * BigInt(component) + BigInt(Math.floor(total / 2))) / BigInt(total));
}
export type Installment = { number: number; dueDate: string; total: number; principal: number; financeCost: number };
export function schedule(principal: number, cost: number, monthly: number, firstDate: string): Installment[] {
  positive(principal); positive(monthly);
  if (!Number.isSafeInteger(cost) || cost < 0 || !validDate(firstDate)) throw new CapitalError('Costo de financiación o fecha inválidos.');
  const total = add(principal, cost), count = Math.ceil(total / monthly);
  if (count > 360) throw new CapitalError('El plan admite como máximo 360 cuotas.');
  const [year, month, day] = firstDate.split('-').map(Number);
  let paid = 0;
  return Array.from({ length: count }, (_, i) => {
    const current = Math.min(monthly, total - paid), next = paid + current;
    const currentCost = share(next, cost, total) - share(paid, cost, total);
    const d = new Date(Date.UTC(year, month - 1 + i, 1, 12));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).getUTCDate();
    d.setUTCDate(Math.min(day, last)); paid = next;
    return { number: i + 1, dueDate: d.toISOString().slice(0, 10), total: current, principal: current - currentCost, financeCost: currentCost };
  });
}
export function verifiedSplit(capital: number, interest: number, total: number, previousPaid: number, previousCapital: unknown, previousInterest: unknown, payment: number) {
  if (add(capital, interest) !== total || previousPaid < 0 || previousPaid + payment > total) throw new CapitalError('Cuota inconsistente; requiere conciliación.');
  if (previousPaid === 0 && ((previousCapital !== undefined && previousCapital !== 0) || (previousInterest !== undefined && previousInterest !== 0))) throw new CapitalError('Cuota con acumulados inconsistentes.');
  if (previousPaid > 0 && (!Number.isSafeInteger(previousCapital) || !Number.isSafeInteger(previousInterest) || add(previousCapital as number, previousInterest as number) !== previousPaid || previousInterest !== share(previousPaid, interest, total))) throw new CapitalError('El pago parcial anterior no tiene distribución verificada.');
  const interestPaid = share(previousPaid + payment, interest, total) - share(previousPaid, interest, total);
  return { capital: payment - interestPaid, interest: interestPaid };
}
