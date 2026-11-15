import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessDate, isOverdue, daysOverdue } from '../src/lib/business-date.ts';
import { generateAmortizationTable } from '../src/lib/amortization.ts';
import { matchesClient, matchesText } from '../src/lib/client-search.ts';
test('business cut uses Ecuador midnight and unpaid balance rather than stored overdue labels', () => {
  assert.equal(businessDate(new Date('2026-10-24T01:00:00Z')), '2026-10-23');
  assert.equal(businessDate(new Date('2026-10-24T05:00:00Z')), '2026-10-24');
  assert.equal(isOverdue({ fechaVencimiento: '2026-10-23', totalCuota: 100, montoPagado: 50, estado: 'parcial' }, '2026-10-24'), true);
  assert.equal(isOverdue({ fechaVencimiento: '2026-10-23', totalCuota: 100, montoPagado: 100, estado: 'vencida' }, '2026-10-24'), false);
  assert.equal(isOverdue({ fechaVencimiento: '2026-10-24', totalCuota: 100 }, '2026-10-24'), false);
  assert.equal(daysOverdue('2026-10-23', '2026-10-24'), 1);
});
test('search combines names, identifiers and telephone without accent sensitivity', () => {
  assert.ok(matchesClient({ nombres: 'José María', apellidos: 'Pérez López', telefonoPrincipal: '0991234567' }, '  perez José '));
  assert.ok(matchesClient({ telefonoPrincipal: '0991234567' }, '099123'));
  assert.ok(matchesText('José Pérez recibo-001 Transferencia', 'perez 001'));
  assert.equal(matchesText('José Pérez', 'Ana'), false);
});
for (const tipoInteres of ['fijo', 'saldo_deudor'] as const) {
  test(`${tipoInteres}: principal and installment cents reconcile exactly`, () => {
    for (const monto of [100, 100.01, 1000.07]) for (const numeroCuotas of [3, 7, 12]) for (const tasaInteres of [0, 2.5]) {
      const rows = generateAmortizationTable({ monto, numeroCuotas, tasaInteres, tipoInteres, frecuenciaPago: 'mensual', fechaPrimerPago: '2026-10-24' });
      assert.equal(rows.reduce((v, c) => v + Math.round(c.capital * 100), 0), Math.round(monto * 100));
      assert.equal(rows.at(-1)?.saldoPendiente, 0);
      for (const row of rows) { assert.equal(Math.round(row.totalCuota * 100), Math.round(row.capital * 100) + Math.round(row.interes * 100)); assert.ok(row.saldoPendiente >= 0); }
    }
  });
}
test('simulator rejects fractional installment counts and invalid dates', () => {
  const input = { monto: 100, numeroCuotas: 3, tasaInteres: 0, tipoInteres: 'fijo' as const, frecuenciaPago: 'mensual' as const, fechaPrimerPago: '2026-10-24' };
  for (const change of [{ numeroCuotas: 3.5 }, { numeroCuotas: 201 }, { monto: -10 }, { tasaInteres: -2 }, { fechaPrimerPago: '2026-02-30' }]) assert.throws(() => generateAmortizationTable({ ...input, ...change }));
});

test('custom dates allow two payments in the disbursement month without changing interest or principal', () => {
  const input = { monto: 50, numeroCuotas: 2, tasaInteres: 5, tipoInteres: 'fijo' as const, frecuenciaPago: 'mensual' as const, fechaPrimerPago: '2026-11-19', fechaDesembolso: '2026-11-15' };
  const dates = ['2026-11-19', '2026-11-29'];
  const regular = generateAmortizationTable(input);
  const custom = generateAmortizationTable({ ...input, fechasPersonalizadas: dates });
  assert.deepEqual(custom, regular.map((row, index) => ({ ...row, fechaVencimiento: dates[index] })));
  assert.equal(custom.reduce((total, row) => total + row.capital, 0), 50);
  for (const invalid of [['2026-11-19'], ['2026-11-19', '2026-11-19'], ['2026-11-19', '2026-11-18'], ['2026-11-19', '2026-11-31']]) {
    assert.throws(() => generateAmortizationTable({ ...input, fechasPersonalizadas: invalid }));
  }
  assert.throws(() => generateAmortizationTable({ ...input, fechaDesembolso: '2026-11-20', fechasPersonalizadas: dates }));
});
