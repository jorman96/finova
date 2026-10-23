import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
process.loadEnvFile('.env.local');
const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (process.env.FIRESTORE_EMULATOR_HOST) throw Error('Use production read-only credentials for this inventory.');
const credential = cert({ projectId: project, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') });
initializeApp({ credential, projectId: project, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
const db = getFirestore();
const summary = { project, checkedAt: new Date().toISOString(), readOnly: true };
const profiles = await db.collection('usuarios').get();
summary.profiles = { total: profiles.size, legacyMissingActive: profiles.docs.filter(d => !('activo' in d.data())).length, explicitlyDisabled: profiles.docs.filter(d => d.data().activo === false).length, roles: profiles.docs.reduce((m, d) => { m[d.data().rol] = (m[d.data().rol] || 0) + 1; return m; }, {}) };
summary.profileFingerprint = createHash('sha256').update(JSON.stringify(profiles.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)))).digest('hex');
let users = 0, mfa = 0, next;
do { const page = await getAuth().listUsers(1000, next); users += page.users.length; mfa += page.users.filter(u => u.multiFactor?.enrolledFactors?.length).length; next = page.pageToken; } while (next);
summary.auth = { users, mfaEnrolled: mfa };
summary.collections = {};
for (const c of await db.listCollections()) summary.collections[c.id] = (await c.count().get()).data().count;
const [loans, installments, payments, clients] = await Promise.all(['prestamos','cuotas','pagos','clientes'].map(c => db.collection(c).get()));
const loanIds = new Set(loans.docs.map(d => d.id)), clientIds = new Set(clients.docs.map(d => d.id));
const linkedLoans = new Set(installments.docs.map(d => d.data().prestamoId));
summary.dataQuality = {
  loansWithoutInstallments: loans.docs.filter(d => !linkedLoans.has(d.id)).length,
  installmentsWithoutLoan: installments.docs.filter(d => !loanIds.has(d.data().prestamoId)).length,
  paymentsWithoutLoan: payments.docs.filter(d => !loanIds.has(d.data().prestamoId)).length,
  loansWithoutClient: loans.docs.filter(d => !clientIds.has(d.data().clienteId)).length,
  clientsWithoutCompany: clients.docs.filter(d => !d.data().empresaId).length,
};
const { access_token } = await credential.getAccessToken();
async function api(url) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + access_token }, signal: AbortSignal.timeout(20000) });
  const data = await r.json();
  return r.ok ? data : { status: r.status, message: data.error?.status };
}
summary.authConfiguration = await api('https://identitytoolkit.googleapis.com/admin/v2/projects/' + project + '/config').then(c => ({ status: c.status, subtype: c.subtype, mfa: c.mfa }));
await mkdir('.private-backups', { recursive: true });
for (const service of ['cloud.firestore', 'firebase.storage/' + process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET]) {
  const release = await api('https://firebaserules.googleapis.com/v1/projects/' + project + '/releases/' + service);
  if (release.rulesetName) {
    const rules = await api('https://firebaserules.googleapis.com/v1/' + release.rulesetName);
    for (const f of rules.source?.files || []) await writeFile('.private-backups/' + service.replaceAll('/', '_') + '.before.rules', f.content);
    summary[service] = { ruleset: release.rulesetName, saved: !!rules.source?.files?.length };
  } else summary[service] = release;
}
await writeFile('.private-backups/preflight-after.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await db.terminate();
