const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { amount, INITIAL_CAPITAL_ID, schedule, share, percentage, verifiedSplit, previewReceipt, today, sourceDate } = require('../.test-build/capital/core.js');
const { capitalService } = require('../.test-build/capital/service.js');
let app, db, execute, n = 0;
const command = (type, data = {}) => ({ key: crypto.randomUUID(), type, ...data });
before(() => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8088');
  app = initializeApp({ projectId: 'demo-finova' }, 'capital-unit'); db = getFirestore(app); execute = capitalService(db);
});
after(async () => { if (app) await deleteApp(app); });
async function fixture() {
  const empresaId = 'fund-' + ++n, uid = empresaId + '-owner', clientId = empresaId + '-client', loanId = empresaId + '-loan';
  await Promise.all([
    db.doc('empresas/' + empresaId).set({ estado: 'activa', moneda: 'USD', capitalInicial: 0, inyeccionesCapital: [{ id: 'inj', monto: 10000, fecha: today(), observaciones: 'Fondeo de prueba' }], cuentasBancarias: [{ id: 'bank-1', banco: 'Banco demo', numero: '000000' }] }),
    db.doc('usuarios/' + uid).set({ rol: 'dueño', empresaId, nombre: 'Operador de prueba' }),
    db.doc('capital_settings/' + empresaId).set({ enabled: true, currency: 'USD', policy: 'proporcional-v1' }),
    db.doc('clientes/' + clientId).set({ empresaId, score: 50 }),
    db.doc('prestamos/' + loanId).set({ empresaId, clienteId: clientId, monto: 1000, totalPagar: 1600, saldoRestante: 1600, estado: 'activo' }),
    db.doc('cuotas/' + loanId).set({ empresaId, prestamoId: loanId, clienteId: clientId, numeroCuota: 1, capital: 1000, interes: 600, totalCuota: 1600, montoPagado: 0, estado: 'pendiente' }),
  ]);
  return { actor: { uid, empresaId }, base: db.doc('capital_control/' + empresaId), loanId, clientId };
}
async function collect(f, extra = {}) { return execute(f.actor, command('receive', { loanId: f.loanId, cents: 160000, method: 'efectivo', note: '', ...extra })); }
async function plan(f, extra = {}) {
  const result = await execute(f.actor, command('agreement', { injectionId: 'inj', beneficiary: 'Financiador ficticio', mode: 'principal_only', cost: 0, monthly: 40000, firstDate: today(), reserveBps: 10000, acknowledgedDebt: true, ...extra }));
  return { id: result.id, due: result.id + '_1', next: result.id + '_2' };
}
async function reserve(f, p, lotId, cents = 40000, installmentId = p.due) { return execute(f.actor, command('reserve', { agreementId: p.id, installmentId, lots: [{ id: lotId, cents }] })); }
function payout(p, cents = 40000, extra = {}) { return command('pay', { agreementId: p.id, installmentId: p.due, cents, source: 'cash', date: today(), reference: 'Comprobante demo', confirmedCashAvailable: true, ...extra }); }
async function totals(f) { return (await f.base.get()).data(); }
test('strict cents and cumulative allocation preserve every cent', () => {
  assert.equal(amount('0.01'), 1); assert.equal(amount(0, true), 0);
  for (const v of ['1.001', '-1', '1e3', 'NaN', '0', ' 1 ', '1,00']) assert.throws(() => amount(v));
  let paid = 0, capital = 0, interest = 0;
  for (let i = 0; i < 5; i++) { const s = verifiedSplit(3, 2, 5, paid, capital, interest, 1); paid++; capital += s.capital; interest += s.interest; }
  assert.equal(capital, 3); assert.equal(interest, 2);
  assert.throws(() => verifiedSplit(80, 20, 100, 50, undefined, undefined, 10));
  assert.equal(percentage(9999999999999, 3333), Number(BigInt(9999999999999) * BigInt(3333) / BigInt(10000)));
  assert.equal(sourceDate('2026-10-24T02:00:00Z'), '2026-10-23'); assert.throws(() => sourceDate('ayer'));
});
test('monthly calendar clamps dates and separates financing cost exactly', () => {
  const s = schedule(100000, 10000, 40000, '2028-01-31');
  assert.deepEqual(s.map(i => i.dueDate), ['2028-01-31', '2028-02-29', '2028-03-31']);
  assert.deepEqual(s.map(i => i.total), [40000, 40000, 30000]);
  assert.equal(s.reduce((v, i) => v + i.principal, 0), 100000); assert.equal(s.reduce((v, i) => v + i.financeCost, 0), 10000);
  assert.throws(() => schedule(1000000, 0, 1, today())); assert.throws(() => schedule(100, -1, 100, today()));
  assert.equal(share(160, 60, 160), 60);
});
test('verified collection is atomic, idempotent and preserves capital contributions', async () => {
  const f = await fixture(); const before = (await db.doc('empresas/' + f.actor.empresaId).get()).data();
  const c = command('receive', { loanId: f.loanId, cents: 160000, method: 'efectivo', note: '' });
  const [a, b] = await Promise.all([execute(f.actor, c), execute(f.actor, c)]);
  assert.equal(a.id, b.id); assert.equal((await totals(f)).collected, 60000);
  assert.equal((await db.doc('pagos/' + a.id).get()).data().capitalCentavos, 100000);
  assert.equal((await db.doc('clientes/' + f.clientId).get()).data().score, 60);
  assert.deepEqual((await db.doc('empresas/' + f.actor.empresaId).get()).data(), before);
  await assert.rejects(execute(f.actor, { ...c, cents: 100 }), /referencia/);
});
test('simultaneous different collections cannot collect the same balance twice', async () => {
  const f = await fixture(); const results = await Promise.allSettled([collect(f), collect(f)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal((await totals(f)).collected, 60000);
});
test('legacy partials and inconsistent components do not fabricate eligible interest', async () => {
  const f = await fixture(); await db.doc('cuotas/' + f.loanId).update({ montoPagado: 1000 }); await db.doc('prestamos/' + f.loanId).update({ saldoRestante: 600 });
  const r = await collect(f, { cents: 60000 }); assert.equal(r.verified, false); assert.equal((await f.base.collection('lots').get()).size, 0); assert.equal((await totals(f)).unverifiedReceipts, 1);
  const other = await fixture(); await db.doc('cuotas/' + other.loanId).update({ capital: 999.99 });
  assert.equal((await collect(other)).verified, false); assert.equal((await totals(other)).collected, 0);
});
test('two competing reservations cannot reuse the same interest', async () => {
  const f = await fixture(), lot = await collect(f), p = await plan(f);
  const results = await Promise.allSettled([reserve(f, p, lot.id), reserve(f, p, lot.id, 40000, p.next)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal((await totals(f)).reserved, 40000); assert.equal((await totals(f)).spent, 0);
});
test('percentage caps persist across requests; releasing permits a new assignment', async () => {
  const f = await fixture(), lot = await collect(f), p = await plan(f, { reserveBps: 5000 });
  const r = await reserve(f, p, lot.id, 20000);
  await assert.rejects(reserve(f, p, lot.id, 20000, p.next), /porcentaje/);
  await execute(f.actor, command('release', { reserveId: r.id + '_0', reason: 'Cambio de destino' }));
  await reserve(f, p, lot.id, 20000, p.next); assert.equal((await totals(f)).reserved, 20000);
});
test('payout uses reserved source and changes cash outflow only on confirmation', async () => {
  const f = await fixture(), lot = await collect(f), p = await plan(f); await reserve(f, p, lot.id);
  assert.equal((await totals(f)).outflow, 0);
  await assert.rejects(execute(f.actor, payout(p, 40000, { source: 'bank:bank-1' })), /caja\/banco/);
  const c = payout(p); await Promise.all([execute(f.actor, c), execute(f.actor, c)]);
  const t = await totals(f); assert.equal(t.outflow, 40000); assert.equal(t.spent, 40000); assert.equal(t.reserved, 0);
  assert.equal((await f.base.collection('agreements').doc(p.id).get()).data().principalPaid, 40000);
});
test('partial payouts distribute funding cost; reversals require reverse chronological order', async () => {
  const f = await fixture(), lot = await collect(f), p = await plan(f, { mode: 'includes_interest', cost: 100000 }); await reserve(f, p, lot.id);
  const first = await execute(f.actor, payout(p, 20000)), second = await execute(f.actor, payout(p, 10000));
  const reverse = id => command('reverse', { payoutId: id, date: today(), reason: 'Dinero devuelto', reference: 'Devolución demo', confirmedReturned: true });
  await assert.rejects(execute(f.actor, reverse(first.id)), /último/);
  await execute(f.actor, reverse(second.id)); await execute(f.actor, reverse(first.id));
  await assert.rejects(execute(f.actor, reverse(first.id)));
  const t = await totals(f); assert.equal(t.spent, 0); assert.equal(t.outflow, 0); assert.equal(t.reserved, 40000);
  const a = (await f.base.collection('agreements').doc(p.id).get()).data(); assert.equal(a.paid, 0); assert.equal(a.principalPaid, 0); assert.equal(a.financeCostPaid, 0);
});
test('expense/liquidity earmarks prevent double assignment and release only once', async () => {
  const f = await fixture(), lot = await collect(f), p = await plan(f);
  const r = await execute(f.actor, command('restrict', { lotId: lot.id, cents: 30000, reason: 'Reserva de gastos' }));
  await assert.rejects(reserve(f, p, lot.id), /insuficientes/);
  await execute(f.actor, command('unrestrict', { restrictionId: r.id, reason: 'Gasto cancelado' }));
  await assert.rejects(execute(f.actor, command('unrestrict', { restrictionId: r.id, reason: 'Repetición' })));
  await reserve(f, p, lot.id); assert.equal((await totals(f)).restricted, 0);
});
test('cash shortage, future dates and missing physical confirmations reject payment', async () => {
  const f = await fixture(), lot = await collect(f), p = await plan(f); await reserve(f, p, lot.id);
  await assert.rejects(execute(f.actor, payout(p, 40000, { date: '2099-01-01' })));
  await assert.rejects(execute(f.actor, payout(p, 40000, { confirmedCashAvailable: false })));
  await db.doc('prestamos/cash-used-' + f.actor.empresaId).set({ empresaId: f.actor.empresaId, monto: 10500 });
  await assert.rejects(execute(f.actor, payout(p)), /caja registrada/); assert.equal((await totals(f)).outflow, 0);
});
test('tenant isolation, active profiles and contribution uniqueness are enforced', async () => {
  const f = await fixture(), other = await fixture(), lot = await collect(other), p = await plan(f);
  await assert.rejects(reserve(f, p, lot.id)); await assert.rejects(plan(f), /ya tiene/);
  await db.doc('usuarios/' + f.actor.uid).update({ rol: 'cajero' }); await assert.rejects(plan(f), /Operador/);
  await db.doc('usuarios/' + f.actor.uid).update({ rol: 'dueño', activo: false }); await assert.rejects(plan(f), /Operador/);
  await db.doc('usuarios/' + f.actor.uid).update({ activo: true }); await db.doc('capital_settings/' + f.actor.empresaId).update({ enabled: false }); await assert.rejects(plan(f), /habilitado/);
});
test('unidentified payment methods do not create spendable interest; bank source is validated', async () => {
  const f = await fixture(); await assert.rejects(collect(f, { method: 'transferencia', bankId: 'foreign' }), /bancaria/);
  const r = await collect(f, { method: 'otro' }); assert.equal(r.verified, true); assert.equal((await totals(f)).collected, 0); assert.equal((await f.base.collection('lots').get()).size, 0);
});
test('new contributions have an explicit receipt and unused returns preserve original history', async () => {
  const f = await fixture(); const c = command('contribute', { cents: 100000, reason: 'Aporte recibido', reference: 'ING-DEMO', confirmedReceived: true });
  const result = await execute(f.actor, c); await execute(f.actor, c);
  const original = (await db.doc('empresas/' + f.actor.empresaId).get()).data().inyeccionesCapital;
  assert.equal(original.length, 2); assert.equal(original[1].monto, 1000);
  await execute(f.actor, command('returnContribution', { contributionId: result.id, reason: 'Aporte devuelto', reference: 'RET-DEMO', confirmedReturned: true }));
  assert.deepEqual((await db.doc('empresas/' + f.actor.empresaId).get()).data().inyeccionesCapital, original);
  assert.equal((await totals(f)).outflow, 100000);
  await assert.rejects(execute(f.actor, command('agreement', { injectionId: result.id, beneficiary: 'Demo', mode: 'principal_only', cost: 0, monthly: 40000, firstDate: today(), reserveBps: 10000, acknowledgedDebt: true })), /restituido/);
  await assert.rejects(execute(f.actor, command('returnContribution', { contributionId: result.id, reason: 'Repetido', reference: 'RET-2', confirmedReturned: true })));
});
test('bank-origin interest can fund only that bank and contribution dates constrain schedules', async () => {
  const f = await fixture(), lot = await collect(f, { method: 'transferencia', bankId: 'bank-1' });
  const p = await plan(f); await reserve(f, p, lot.id);
  await assert.rejects(execute(f.actor, payout(p)), /caja\/banco/);
  await execute(f.actor, payout(p, 40000, { source: 'bank:bank-1' })); assert.equal((await totals(f)).spent, 40000);
  const other = await fixture(); await assert.rejects(plan(other, { firstDate: '2020-01-01' }), /preceder/);
});


test('initial capital is linked once without crediting cash again or changing the original contribution', async () => {
  const f = await fixture();
  await db.doc('empresas/' + f.actor.empresaId).update({ capitalInicial: 2500 });
  const original = (await db.doc('empresas/' + f.actor.empresaId).get()).data();
  const p = await plan(f, { injectionId: INITIAL_CAPITAL_ID });
  const a = (await f.base.collection('agreements').doc(p.id).get()).data();
  assert.equal(a.principal, 250000); assert.equal(a.sourceType, 'initial_capital');
  assert.equal((await totals(f)).outflow, 0); assert.equal((await totals(f)).collected, 0);
  assert.deepEqual((await db.doc('empresas/' + f.actor.empresaId).get()).data(), original);
  await assert.rejects(plan(f, { injectionId: INITIAL_CAPITAL_ID }), /ya tiene/);
  const extra = await plan(f); assert.notEqual(extra.id, p.id);
});

test('zero or imprecise initial capital cannot become a repayment plan', async () => {
  const f = await fixture();
  await assert.rejects(plan(f, { injectionId: INITIAL_CAPITAL_ID }));
  await db.doc('empresas/' + f.actor.empresaId).update({ capitalInicial: 100.001 });
  await assert.rejects(plan(f, { injectionId: INITIAL_CAPITAL_ID }));
  assert.equal((await f.base.collection('agreements').get()).size, 0);
});

test('receipt preview respects zero-paid, verified partials and unknown legacy splits', () => {
 const first={numeroCuota:1,capital:100,interes:20,totalCuota:120,montoPagado:0};
 assert.deepEqual(previewReceipt([first],6000),{installments:[1],verified:true,capital:5000,interest:1000});
 assert.deepEqual(previewReceipt([{...first,montoPagado:60,capitalCobradoCentavos:5000,interesCobradoCentavos:1000}],6000),{installments:[1],verified:true,capital:5000,interest:1000});
 assert.equal(previewReceipt([{...first,montoPagado:60}],6000).verified,false);
 assert.throws(()=>previewReceipt([first],12001));
});
