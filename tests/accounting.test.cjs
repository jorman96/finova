const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { cents, exactSum, validateLines, validDate, reviewLegacy } = require('../.test-build/accounting/core.js');
const { ledgerService } = require('../.test-build/accounting/service.js');
let app, db, execute, fixtureSequence = 0;
const date = '2026-05-30';
const next = (type, data = {}) => ({ key: crypto.randomUUID(), date, description: 'Prueba contable aislada', type, ...data });
before(() => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8088') throw Error('Accounting tests require the local emulator on 8088.');
  app = initializeApp({ projectId: 'demo-finova' }, 'accounting-tests'); db = getFirestore(app); execute = ledgerService(db);
});
after(async () => { if (app) await deleteApp(app); });
async function fixture() {
  const empresaId = 'ledger-' + ++fixtureSequence, uid = empresaId + '-owner', clientId = empresaId + '-client';
  const base = db.collection('accounting').doc(empresaId);
  await Promise.all([
    db.doc('empresas/' + empresaId).set({ estado: 'activa' }),
    db.doc('usuarios/' + uid).set({ rol: 'dueño', empresaId }),
    db.doc('clientes/' + clientId).set({ empresaId }),
    base.set({ enabled: true, openingReconciled: true, openingApprovedBy: 'test-accountant', currency: 'USD', version: 1, startDate: date }),
  ]);
  const actor = { uid, empresaId };
  const one = await execute(actor, next('open', { clientId }));
  const two = await execute(actor, next('open', { clientId }));
  return { actor, base, one: one.id, two: two.id, clientId };
}
async function fund(f, amount = 10000) { return execute(f.actor, next('deposit', { savingsId: f.one, amount, cash: '1101' })); }
async function balances(f) { const s = await f.base.collection('savings').doc(f.one).get(); return s.data(); }
test('USD parsing rejects floats, exponent notation, zero, separators and excess precision', () => {
  assert.equal(cents('0.10'), 10); assert.equal(cents('100.99'), 10099);
  for (const value of ['1.001', '1e3', '-1', '0', '1,00', 'Infinity', ' 1 ', '01', '999999999999999']) assert.throws(() => cents(value));
  assert.throws(() => exactSum(Number.MAX_SAFE_INTEGER, 1));
});
test('journal validation rejects unbalanced, unknown, double-sided and fractional lines', () => {
  const a = { account: '1101', debit: 100, credit: 0 }, b = { account: '3101', debit: 0, credit: 100 };
  assert.deepEqual(validateLines([a, b]), { debit: 100, credit: 100 });
  for (const lines of [[a], [a, { ...b, credit: 99 }], [a, { ...b, account: 'unknown' }], [{ ...a, credit: 100 }, b], [{ ...a, debit: 0.5 }, b], [a, { ...b, account: '2101' }]]) assert.throws(() => validateLines(lines));
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2026-13-01'), false); assert.equal(validDate('2024-02-29'), true);
});
test('legacy review detects differences without rounding or treating contractual debt as principal', () => {
  const loans = [{ id: 'ok', totalPagar: 110, saldoRestante: 100 }, { id: 'difference', totalPagar: 100, saldoRestante: 90 }, { id: 'precision', totalPagar: 10.001, saldoRestante: 10 }];
  const original = JSON.stringify(loans);
  const result = reviewLegacy(loans, [{ prestamoId: 'ok', monto: 10 }, { prestamoId: 'missing', monto: 1 }]);
  assert.equal(result.checked, 2); assert.equal(result.issueCount, 3); assert.equal(JSON.stringify(loans), original);
});
test('simultaneous withdrawals cannot overdraw; one entry commits atomically', async () => {
  const f = await fixture(); await fund(f);
  const r = await Promise.allSettled([execute(f.actor, next('withdraw', { savingsId: f.one, amount: 8000, cash: '1101' })), execute(f.actor, next('withdraw', { savingsId: f.one, amount: 8000, cash: '1101' }))]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await balances(f)).balance, 2000);
  assert.equal((await f.base.collection('entries').get()).size, 2);
});
test('identical concurrent requests create one entry and conflicting reuse is rejected', async () => {
  const f = await fixture(); const c = next('deposit', { savingsId: f.one, amount: 100, cash: '1101' });
  await Promise.all([execute(f.actor, c), execute(f.actor, c)]);
  assert.equal((await balances(f)).balance, 100);
  assert.equal((await f.base.collection('entries').get()).size, 1);
  await assert.rejects(execute(f.actor, { ...c, amount: 200 }), /referencia/);
});
test('holds reduce available funds, do not change ledger balance and release once', async () => {
  const f = await fixture(); await fund(f);
  const h = await execute(f.actor, next('hold', { savingsId: f.one, amount: 7000 }));
  await assert.rejects(execute(f.actor, next('withdraw', { savingsId: f.one, amount: 4000, cash: '1101' })));
  assert.equal((await balances(f)).balance, 10000); assert.equal((await balances(f)).held, 7000);
  await execute(f.actor, next('release', { holdId: h.id }));
  await assert.rejects(execute(f.actor, next('release', { holdId: h.id })), /bloqueo/);
  await execute(f.actor, next('withdraw', { savingsId: f.one, amount: 10000, cash: '1101' }));
  assert.equal((await balances(f)).balance, 0);
});
test('transfer preserves total savings and balances both individual accounts atomically', async () => {
  const f = await fixture(); await fund(f);
  await execute(f.actor, next('transfer', { savingsId: f.one, targetId: f.two, amount: 2500 }));
  assert.equal((await balances(f)).balance, 7500);
  assert.equal((await f.base.collection('savings').doc(f.two).get()).data().balance, 2500);
  assert.equal((await f.base.collection('balances').doc('2101').get()).data().net, -10000);
});
test('tenant isolation rejects foreign clients and account identifiers', async () => {
  const f = await fixture(), other = await fixture(); await fund(f);
  await assert.rejects(execute(f.actor, next('open', { clientId: other.clientId })), /pertenece/);
  await assert.rejects(execute(f.actor, next('deposit', { savingsId: other.one, amount: 100, cash: '1101' })), /disponible/);
  await assert.rejects(execute(f.actor, next('transfer', { savingsId: f.one, targetId: other.one, amount: 100 })), /disponible/);
  assert.equal((await balances(f)).balance, 10000); assert.equal((await balances(other)).balance, 0);
});
test('reversals preserve original entry, cannot repeat and respect available funds', async () => {
  const f = await fixture(); const deposit = await fund(f);
  const original = (await f.base.collection('entries').doc(deposit.id).get()).data();
  await execute(f.actor, next('reverse', { entryId: deposit.id }));
  assert.equal((await balances(f)).balance, 0);
  assert.deepEqual((await f.base.collection('entries').doc(deposit.id).get()).data(), original);
  await assert.rejects(execute(f.actor, next('reverse', { entryId: deposit.id })), /revertido/);
  const another = await fund(f); await execute(f.actor, next('hold', { savingsId: f.one, amount: 100 }));
  await assert.rejects(execute(f.actor, next('reverse', { entryId: another.id })));
});
test('disabled config, currency mismatch and suspended actors block writes', async () => {
  const f = await fixture();
  await f.base.update({ enabled: false }); await assert.rejects(fund(f), /preparación/);
  await f.base.update({ enabled: true, openingReconciled: false }); await assert.rejects(fund(f), /preparación/);
  await f.base.update({ openingReconciled: true, openingApprovedBy: '' }); await assert.rejects(fund(f), /preparación/);
  await f.base.update({ openingApprovedBy: 'test-accountant' });
  await f.base.update({ enabled: true, currency: 'EUR' }); await assert.rejects(fund(f), /preparación/);
  await f.base.update({ currency: 'USD' }); await db.doc('usuarios/' + f.actor.uid).update({ activo: false }); await assert.rejects(fund(f), /habilitados/);
  await db.doc('usuarios/' + f.actor.uid).update({ activo: true, rol: 'cajero' }); await assert.rejects(fund(f), /habilitados/);
  await db.doc('usuarios/' + f.actor.uid).update({ rol: 'dueño' }); await db.doc('empresas/' + f.actor.empresaId).update({ estado: 'suspendida' }); await assert.rejects(fund(f), /habilitados/);
});
test('closing checks subsidiary reconciliation and prevents posting to closed dates', async () => {
  const f = await fixture(); await fund(f); await execute(f.actor, next('close'));
  await assert.rejects(fund(f), /período/);
  assert.equal((await f.base.get()).data().closedThrough, date);
  const broken = await fixture(); await fund(broken);
  await broken.base.collection('savings').doc(broken.one).update({ balance: 999 });
  await assert.rejects(execute(broken.actor, next('close')), /conciliación/);
});
test('chronological posting prevents historical overdrafts and pre-start entries', async () => {
  const f = await fixture(); await assert.rejects(execute(f.actor, { ...next('deposit', { savingsId: f.one, amount: 100, cash: '1101' }), date: '2026-05-29' }), /período/);
  await execute(f.actor, { ...next('deposit', { savingsId: f.one, amount: 100, cash: '1101' }), date: '2026-06-01' });
  await assert.rejects(fund(f), /cronológico/);
});
test('manual journal cannot bypass savings balances and cash cannot become negative', async () => {
  const f = await fixture();
  await assert.rejects(execute(f.actor, next('journal', { source: 'apertura', lines: [{ account: '1101', debit: 100, credit: 0 }, { account: '2101', debit: 0, credit: 100, savingsId: f.one }] })), /específica/);
  await assert.rejects(execute(f.actor, next('journal', { source: 'gasto', lines: [{ account: '5101', debit: 100, credit: 0 }, { account: '1101', debit: 0, credit: 100 }] })), /fondos/);
  await execute(f.actor, next('journal', { source: 'acta-apertura', lines: [{ account: '1101', debit: 100, credit: 0 }, { account: '3101', debit: 0, credit: 100 }] }));
  assert.equal((await f.base.collection('balances').doc('1101').get()).data().net, 100);
});
