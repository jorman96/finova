import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { encode, seal } from './backup-format.mjs';
process.loadEnvFile('.env.local');
const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (process.argv[2] !== '--project' || process.argv[3] !== project || process.env.FIRESTORE_EMULATOR_HOST) throw Error('Pass the exact --project identifier; export is read-only.');
initializeApp({ projectId: project, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, credential: cert({ projectId: project, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
const db = getFirestore(), payload = { format: 1, project, startedAt: new Date().toISOString(), documents: [], authUsers: [], files: [], storageStatus: 'pending' };
async function walk(collection) {
  for (const ref of await collection.listDocuments()) {
    const snap = await ref.get();
    if (snap.exists) payload.documents.push({ path: ref.path, data: encode(snap.data()) });
    for (const child of await ref.listCollections()) await walk(child);
  }
}
for (const collection of await db.listCollections()) await walk(collection);
let next;
do { const page = await getAuth().listUsers(1000, next); payload.authUsers.push(...page.users.map(u => u.toJSON())); next = page.pageToken; } while (next);
let total = 0;
try {
  const [files] = await getStorage().bucket().getFiles();
  for (const file of files) {
    const [metadata] = await file.getMetadata(); total += Number(metadata.size || 0);
    if (total > 100 * 1024 * 1024) throw Error('Storage exceeds local backup limit; use managed backup.');
    const [data] = await file.download(); payload.files.push({ name: file.name, metadata, data: data.toString('base64') });
  }
  payload.storageStatus = 'complete';
} catch (error) {
  if (error.code !== 404) throw error;
  payload.storageStatus = 'bucket_not_found';
}
payload.finishedAt = new Date().toISOString();
await mkdir('.private-backups/keys', { recursive: true });
const stamp = Date.now(), key = randomBytes(32), name = '.private-backups/finova-' + stamp;
await writeFile(name + '.encrypted.json', seal(payload, key), { flag: 'wx', mode: 0o600 });
await writeFile('.private-backups/keys/' + stamp + '.key', key.toString('base64'), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ file: name + '.encrypted.json', keyFile: '.private-backups/keys/' + stamp + '.key', documents: payload.documents.length, authIdentities: payload.authUsers.length, storageFiles: payload.files.length, storageStatus: payload.storageStatus, consistentPointInTime: false }));
await db.terminate();
