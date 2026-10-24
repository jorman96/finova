import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8088');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9098');
const project = 'demo-finova', app = initializeApp({ projectId: project }), db = getFirestore(), auth = getAuth();
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', '3111', '-H', '127.0.0.1'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXT_PUBLIC_FIREBASE_PROJECT_ID: project, NEXT_PUBLIC_FIREBASE_API_KEY: 'fake', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: project + '.firebaseapp.com', NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: project + '.appspot.com', NEXT_PUBLIC_FIREBASE_APP_ID: 'fake', FIREBASE_CLIENT_EMAIL: '', FIREBASE_PRIVATE_KEY: '', RESEND_API_KEY: '', FINOVA_CAPITAL_PAYMENTS_ENABLED: 'true', NEXT_PUBLIC_CAPITAL_PAYMENTS_ENABLED: 'true' } });
let logs = '', count = 0;
child.stdout.on('data', d => logs = (logs + d).slice(-12000)); child.stderr.on('data', d => logs = (logs + d).slice(-12000));
const cmd = (type, data = {}) => ({ key: crypto.randomUUID(), type, ...data });
async function post(path, body, token) { return fetch('http://127.0.0.1:3111' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }); }
async function user(uid, rol, empresaId, activo = true) {
  await auth.createUser({ uid, email: uid + '@example.test', password: 'DemoPassword123!' });
  await db.doc('usuarios/' + uid).set({ empresaId, rol, activo, nombre: 'Persona ficticia' });
  const r = await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: uid + '@example.test', password: 'DemoPassword123!', returnSecureToken: true }) });
  return (await r.json()).idToken;
}
async function expected(name, body, token, status) {
  const r = await post('/api/capital/commands', body, token); assert.equal(r.status, status, await r.clone().text()); count++; console.log('PASS ' + name); return r;
}
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:3111/api/capital/status')).status === 405) break; } catch {} if (i === 99) throw Error('Local server startup timed out'); await delay(1000); }
  for (const empresaId of ['cap-api-a', 'cap-api-b']) {
    await db.doc('empresas/' + empresaId).set({ nombre: 'Financiera ficticia', estado: 'activa', moneda: 'USD', capitalInicial: 10000, inyeccionesCapital: [{ id: 'fund', monto: 1000, fecha: '2026-01-01', observaciones: 'Aporte ficticio' }] });
    await db.doc('capital_settings/' + empresaId).set({ enabled: true, currency: 'USD', policy: 'proporcional-v1' });
  }
  const owner = await user('capital-api-owner', 'dueño', 'cap-api-a'), cashier = await user('capital-api-cashier', 'cajero', 'cap-api-a'), foreign = await user('capital-api-foreign', 'dueño', 'cap-api-b'), disabled = await user('capital-api-disabled', 'dueño', 'cap-api-a', false);
  const base = db.doc('capital_control/cap-api-a');
  await db.doc('clientes/capital-api-client').set({ empresaId: 'cap-api-a', nombres: 'Cliente', score: 50 });
  await db.doc('prestamos/capital-api-loan').set({ empresaId: 'cap-api-a', clienteId: 'capital-api-client', monto: 1000, totalPagar: 1400, saldoRestante: 1400, estado: 'activo' });
  await db.doc('cuotas/capital-api-quota').set({ empresaId: 'cap-api-a', prestamoId: 'capital-api-loan', clienteId: 'capital-api-client', numeroCuota: 1, capital: 1000, interes: 400, totalCuota: 1400, montoPagado: 0, estado: 'pendiente' });
  for (const path of ['/api/capital/status', '/api/capital/summary', '/api/capital/commands']) { assert.equal((await post(path, {})).status, 401); count++; }
  assert.equal((await post('/api/capital/status', {}, cashier)).status, 403); count++;
  const a = cmd('agreement', { injectionId: 'fund', beneficiary: 'Financiador demo', mode: 'includes_interest', cost: 10000, monthly: 40000, firstDate: '2026-01-31', reserveBps: 10000, acknowledgedDebt: true });
  await expected('cashier cannot create repayment obligations', a, cashier, 403);
  await expected('disabled user cannot operate', a, disabled, 403);
  const agreement = await (await expected('owner creates explicit plan without altering contribution', a, owner, 200)).json();
  assert.equal((await db.doc('empresas/cap-api-a').get()).data().inyeccionesCapital[0].monto, 1000);
  await expected('same injection cannot be duplicated', { ...a, key: crypto.randomUUID() }, owner, 409);
  const receive = cmd('receive', { loanId: 'capital-api-loan', cents: 70000, method: 'efectivo', note: 'Cobro ficticio' });
  await expected('cross-company collection rejected', receive, foreign, 409);
  const lot = await (await expected('cashier collection records actual proportional interest', receive, cashier, 200)).json(); assert.equal(lot.verified, true); assert.equal(lot.interest, 20000);
  await expected('collection retry does not duplicate', receive, cashier, 200);
  await expected('client cannot forge verified interest fields', { ...receive, key: crypto.randomUUID(), verified: true }, cashier, 400);
  const installmentId = agreement.id + '_1';
  const reserve = cmd('reserve', { agreementId: agreement.id, installmentId, lots: [{ id: lot.id, cents: 20000 }] });
  await expected('foreign reservation rejected', reserve, foreign, 409);
  await expected('verified interest reserved without recording payout', reserve, owner, 200);
  assert.equal((await base.get()).data().outflow, 0);
  const dayParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const date = ['year', 'month', 'day'].map(t => dayParts.find(p => p.type === t).value).join('-');
  const pay = cmd('pay', { agreementId: agreement.id, installmentId, cents: 20000, source: 'cash', date, reference: 'TRX-DEMO-001', confirmedCashAvailable: true });
  await expected('payment requires actual cash confirmation', { ...pay, confirmedCashAvailable: false }, owner, 400);
  await expected('payment requires proof reference', { ...pay, reference: '' }, owner, 400);
  await expected('external proof URL rejected without fetching it', { ...pay, proofUrl: 'https://example.test/proof.pdf' }, owner, 400);
  await expected('another company proof path rejected', { ...pay, proofUrl: 'https://firebasestorage.googleapis.com/v0/b/demo-finova.appspot.com/o/empresas%2Fcap-api-b%2Fcapital%2Fproof.pdf' }, owner, 400);
  const payout = await (await expected('payment consumes reservations and records cash outflow', pay, owner, 200)).json();
  await expected('payment retry is idempotent', pay, owner, 200);
  assert.equal((await base.get()).data().outflow, 20000); assert.equal((await base.collection('payouts').get()).size, 1);
  const summary = await (await post('/api/capital/summary', {}, cashier)).json(); assert.equal(summary.outflow, 20000); assert.equal('agreements' in summary, false); count++;
  const foreignView = await (await post('/api/capital/status', {}, foreign)).json(); assert.equal(foreignView.agreements.length, 0); assert.equal(foreignView.lots.length, 0); count++;
  const reversed = cmd('reverse', { payoutId: payout.id, date, reason: 'Devolución de prueba', reference: 'RET-DEMO-001', confirmedReturned: true });
  await expected('restitution restores reservations without erasing payment', reversed, owner, 200);
  assert.equal((await base.get()).data().outflow, 0); assert.equal((await base.get()).data().reserved, 20000);
  assert.equal((await base.collection('payouts').doc(payout.id).get()).data().reversed, true);
  console.log('Completed ' + count + ' capital API checks.');
} catch (e) { console.error(e); console.error(logs); process.exitCode = 1; }
finally { child.kill(); await db.terminate(); await deleteApp(app); }
