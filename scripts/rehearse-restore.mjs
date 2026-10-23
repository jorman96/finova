import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { unseal, decode, encode } from './backup-format.mjs';
const [source, keyFile, target] = process.argv.slice(2);
if (!source || !keyFile || !/^demo-finova-recovery$/.test(target || '') || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('Restore is restricted to the local demo-finova-recovery emulator.');
initializeApp({ projectId: target }); const db = getFirestore();
if ((await db.listCollections()).length) throw Error('Recovery database must be empty.');
const backup = unseal(await readFile(source, 'utf8'), Buffer.from((await readFile(keyFile, 'utf8')).trim(), 'base64'));
if (backup.format !== 1 || !Array.isArray(backup.documents)) throw Error('Invalid payload');
for (const entry of backup.documents) await db.doc(entry.path).create(decode(entry.data, db));
let verified = 0;
function canonical(node) { if (node?.t === 'map') return { ...node, v: node.v.map(([k, v]) => [k, canonical(v)]).sort(([a], [b]) => a.localeCompare(b)) }; if (node?.t === 'array') return { ...node, v: node.v.map(canonical) }; return node; }
for (const entry of backup.documents) {
  const doc = await db.doc(entry.path).get();
  if (!doc.exists || !isDeepStrictEqual(canonical(encode(doc.data())), canonical(entry.data))) throw Error('Restored document differs');
  verified++;
}
let verifiedFiles = 0;
if (backup.files.length) {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_STORAGE_EMULATOR_HOST || '')) throw Error('Storage restoration requires the local emulator.');
  const bucket = getStorage().bucket(target + '.appspot.com');
  const [existing] = await bucket.getFiles();
  if (existing.length) throw Error('Recovery bucket must be empty.');
  for (const entry of backup.files) {
    const expected = Buffer.from(entry.data, 'base64'), file = bucket.file(entry.name);
    await file.save(expected, { resumable: false, metadata: { contentType: entry.metadata.contentType || 'application/octet-stream' } });
    const [actual] = await file.download();
    if (createHash('sha256').update(actual).digest('hex') !== createHash('sha256').update(expected).digest('hex')) throw Error('Restored file differs');
    verifiedFiles++;
  }
}
console.log(JSON.stringify({ restoredDocuments: verified, restoredFiles: verifiedFiles, verified: true, target, productionWrites: 0, authCredentialsRestore: 'not_performed' }));
await db.terminate();
