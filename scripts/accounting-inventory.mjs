// Read-only production inventory. Stores hashes, counts and dates, never customer values.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const label = process.argv[2];
if (!['before', 'after'].includes(label)) throw Error('Use before or after.');
process.loadEnvFile('.env.local');
if (process.env.FIRESTORE_EMULATOR_HOST) throw Error('This inventory requires the actual project, read-only.');
initializeApp({ credential: cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
const db = getFirestore();
function canonical(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value.toDate === 'function') return { timestamp: value.toDate().toISOString() };
  return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
}
const summary = { readOnly: true, checkedAt: new Date().toISOString(), collections: {} };
for (const collection of ['usuarios', 'clientes', 'empresas', 'prestamos', 'cuotas', 'pagos', 'inversionistas', 'inversion_contratos', 'cuotas_inversionistas', 'pagos_inversionistas']) {
  const snap = await db.collection(collection).get();
  const records = snap.docs.map(d => ({ id: d.id, data: canonical(d.data()) })).sort((a, b) => a.id.localeCompare(b.id));
  summary.collections[collection] = { count: snap.size, fingerprint: createHash('sha256').update(JSON.stringify(records)).digest('hex') };
}
await mkdir('.private-backups', { recursive: true });
await writeFile('.private-backups/etapa2-inventory-' + label + '.json', JSON.stringify(summary, null, 2), { flag: 'wx' });
console.log(JSON.stringify(summary, null, 2));
