/** USD amounts are integer cents. No floating-point monetary calculations. */
export const chart = [
  { code: '1101', name: 'Caja', kind: 'asset' },
  { code: '1102', name: 'Bancos', kind: 'asset' },
  { code: '1301', name: 'Cartera de créditos', kind: 'asset' },
  { code: '2101', name: 'Ahorros de clientes', kind: 'liability' },
  { code: '3101', name: 'Patrimonio de apertura', kind: 'equity' },
  { code: '4101', name: 'Ingresos por intereses', kind: 'income' },
  { code: '5101', name: 'Gastos operativos', kind: 'expense' },
] as const;
export type Line = { account: string; debit: number; credit: number; savingsId?: string };
export class LedgerError extends Error {}
export function cents(value: string): number {
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(value)) throw new LedgerError('Usa un importe positivo con hasta dos decimales.');
  const [whole, fraction = ''] = value.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result <= 0) throw new LedgerError('El importe está fuera del rango permitido.');
  return result;
}
export function exactSum(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(a + b)) throw new LedgerError('El importe excede la precisión admitida.');
  return a + b;
}
export function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
export function validateLines(lines: Line[]): { debit: number; credit: number } {
  if (!Array.isArray(lines) || lines.length < 2 || lines.length > 40) throw new LedgerError('Un asiento requiere entre 2 y 40 líneas.');
  let debit = 0, credit = 0;
  for (const line of lines) {
    if (!chart.some(a => a.code === line.account)) throw new LedgerError('Cuenta contable no reconocida.');
    if (![line.debit, line.credit].every(n => Number.isSafeInteger(n) && n >= 0) || (line.debit > 0) === (line.credit > 0)) throw new LedgerError('Cada línea debe tener solo un débito o un crédito positivo en centavos.');
    if ((line.account === '2101') !== !!line.savingsId) throw new LedgerError('Los ahorros requieren una cuenta individual.');
    debit = exactSum(debit, line.debit); credit = exactSum(credit, line.credit);
  }
  if (debit !== credit) throw new LedgerError('El asiento no cuadra: débitos y créditos deben coincidir.');
  return { debit, credit };
}
export function reverseLines(lines: Line[]): Line[] {
  return lines.map(line => ({ ...line, debit: line.credit, credit: line.debit }));
}
export function available(balance: number, held: number): number {
  if (![balance, held].every(n => Number.isSafeInteger(n) && n >= 0) || held > balance) throw new LedgerError('Saldo o bloqueo inconsistente.');
  return balance - held;
}

/** Diagnostic only: contractual receivables include interest, so are never opening principal. */
export function reviewLegacy(
  loans: { id: string; totalPagar?: unknown; saldoRestante?: unknown }[],
  payments: { prestamoId?: unknown; monto?: unknown }[],
) {
  const issues: { reference: string; reason: string }[] = [];
  const loanIds = new Set(loans.map(l => l.id));
  const paid = new Map<string, number>();
  const invalidPayments = new Set<string>();
  function legacyAmount(value: unknown) {
    if (value === 0) return 0;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new LedgerError('Importe histórico inválido.');
    return cents(String(value));
  }
  for (const payment of payments) {
    const reference = typeof payment.prestamoId === 'string' ? payment.prestamoId : 'sin-prestamo';
    if (!loanIds.has(reference)) { issues.push({ reference, reason: 'Pago sin préstamo de la misma financiera' }); continue; }
    try { paid.set(reference, exactSum(paid.get(reference) || 0, legacyAmount(payment.monto))); }
    catch { invalidPayments.add(reference); issues.push({ reference, reason: 'Pago con importe inválido o más de dos decimales' }); }
  }
  let checked = 0;
  for (const loan of loans) {
    try {
      const total = legacyAmount(loan.totalPagar), balance = legacyAmount(loan.saldoRestante);
      if (invalidPayments.has(loan.id)) continue;
      checked++;
      if (total - (paid.get(loan.id) || 0) !== balance) issues.push({ reference: loan.id, reason: 'El saldo contractual difiere del total pactado menos pagos registrados' });
    } catch { issues.push({ reference: loan.id, reason: 'Crédito con importe inválido o más de dos decimales' }); }
  }
  return { checked, total: loans.length, issueCount: issues.length, issues: issues.slice(0, 20), moreIssues: issues.length > 20 };
}
