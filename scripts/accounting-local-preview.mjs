import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { spawn } from 'node:child_process';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8088' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9098' || process.env.GCLOUD_PROJECT !== 'demo-finova') throw Error('Local demo emulators only.');
initializeApp({ projectId: 'demo-finova' });
const db = getFirestore(), auth = getAuth();
await auth.createUser({ uid: 'accounting-preview-owner', email: 'contabilidad@example.test', password: 'DemoLocal2026!' });
await Promise.all([
  db.doc('usuarios/accounting-preview-owner').set({ nombre: 'Operador de prueba', rol: 'dueño', empresaId: 'accounting-demo' }),
  db.doc('empresas/accounting-demo').set({ nombre: 'Financiera de prueba', estado: 'activa', moneda: 'USD' }),
  db.doc('clientes/demo-client').set({ empresaId: 'accounting-demo', nombres: 'Persona', apellidos: 'Ficticia' }),
  db.doc('prestamos/demo-reconciled').set({ empresaId: 'accounting-demo', fechaDesembolso: '2026-05-30', totalPagar: 110, saldoRestante: 100 }),
  db.doc('prestamos/demo-review').set({ empresaId: 'accounting-demo', fechaDesembolso: '2026-06-01', totalPagar: 100, saldoRestante: 90 }),
  db.doc('pagos/demo-payment').set({ empresaId: 'accounting-demo', prestamoId: 'demo-reconciled', monto: 10 }),
]);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', '3113', '-H', '127.0.0.1'], {
  windowsHide: true, stdio: 'inherit',
  env: { ...process.env, VERCEL_ENV: '', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-finova', NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-key', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-finova.firebaseapp.com', NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-finova.appspot.com', NEXT_PUBLIC_FIREBASE_APP_ID: 'fake-app', NEXT_PUBLIC_USE_EMULATORS: 'true', FIREBASE_CLIENT_EMAIL: '', FIREBASE_PRIVATE_KEY: '', RESEND_API_KEY: '', FINOVA_ACCOUNTING_WRITES_ENABLED: '' },
});
console.log('Local accounting preview: http://127.0.0.1:3113/login — contabilidad@example.test / DemoLocal2026! (synthetic only)');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill('SIGTERM'); process.exit(0); });
child.on('exit', code => process.exit(code || 0));
