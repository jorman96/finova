import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8088');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9098');
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9198');
initializeApp({ projectId: 'demo-finova' });
const db = getFirestore(), auth = getAuth(), require = createRequire(import.meta.url);
const { capitalService } = require('../.test-build/capital/service.js');
const { today } = require('../.test-build/capital/core.js');
const empresaId = 'capital-demo', uid = 'capital-demo-owner';
await auth.createUser({ uid, email: 'capital-owner@example.test', password: 'DemoPassword123!' });
await Promise.all([
  db.doc('usuarios/' + uid).set({ empresaId, rol: 'dueño', activo: true, nombre: 'Dueño de demostración', email: 'capital-owner@example.test' }),
  db.doc('empresas/' + empresaId).set({ nombre: 'Financiera de demostración', estado: 'activa', moneda: 'USD', capitalInicial: 0, inyeccionesCapital: [{ id: 'aporte-demo', monto: 10000, fecha: today(), observaciones: 'Capital ficticio para pruebas' }], cuentasBancarias: [] }),
  db.doc('capital_settings/' + empresaId).set({ enabled: true, currency: 'USD', policy: 'proporcional-v1' }),
  db.doc('clientes/capital-demo-client').set({ empresaId, nombres: 'Cliente', apellidos: 'Ficticio', cedula: 'DEMO-001', score: 50 }),
  db.doc('prestamos/capital-demo-loan').set({ empresaId, clienteId: 'capital-demo-client', monto: 1000, totalPagar: 1600, saldoRestante: 1600, estado: 'activo' }),
  db.doc('cuotas/capital-demo-quota').set({ empresaId, prestamoId: 'capital-demo-loan', clienteId: 'capital-demo-client', numeroCuota: 1, capital: 1000, interes: 600, totalCuota: 1600, montoPagado: 0, estado: 'pendiente' }),
]);
const execute = capitalService(db), actor = { uid, empresaId };
await execute(actor, { key: 'demo-receive', type: 'receive', loanId: 'capital-demo-loan', cents: 160000, method: 'efectivo', note: 'Cobro ficticio' });
await execute(actor, { key: 'demo-plan', type: 'agreement', injectionId: 'aporte-demo', beneficiary: 'Financiador ficticio', mode: 'principal_only', cost: 0, monthly: 40000, firstDate: today(), reserveBps: 10000, acknowledgedDebt: true });
console.log('Demostración local: http://127.0.0.1:3113/capital · capital-owner@example.test · contraseña exclusiva de pruebas: DemoPassword123!');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', '3113', '-H', '127.0.0.1'], { windowsHide: true, stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-finova', NEXT_PUBLIC_FIREBASE_API_KEY: 'fake', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-finova.firebaseapp.com', NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-finova.appspot.com', NEXT_PUBLIC_FIREBASE_APP_ID: 'fake', NEXT_PUBLIC_FINOVA_ENV: 'development', NEXT_PUBLIC_USE_EMULATORS: 'true', FIREBASE_CLIENT_EMAIL: '', FIREBASE_PRIVATE_KEY: '', RESEND_API_KEY: '', FINOVA_CAPITAL_PAYMENTS_ENABLED: 'true', NEXT_PUBLIC_CAPITAL_PAYMENTS_ENABLED: 'true' } });
child.on('exit', code => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
