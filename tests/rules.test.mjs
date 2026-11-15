import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
let env;
before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Run only inside emulators');
  env = await initializeTestEnvironment({ projectId: 'demo-finova', firestore: { rules: await readFile('firestore.rules', 'utf8') }, storage: { rules: await readFile('storage.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const id of ['a','b']) await setDoc(doc(db, 'empresas', id), { estado: 'activa', nombre: id });
    for (const [id, rol, empresaId, activo] of [['owner','dueño','a',true],['cashier','cajero','a',true],['reader','consulta','a',true],['other','dueño','b',true],['disabled','dueño','a',false],['root','superadmin','a',true]]) await setDoc(doc(db, 'usuarios', id), { rol, empresaId, activo });
    for (const [id, empresaId] of [['loanA','a'],['loanB','b']]) await setDoc(doc(db, 'prestamos', id), { empresaId, saldoRestante: 100 });
    await setDoc(doc(db, 'inversion_contratos', 'invA'), { empresaId: 'a' });
  });
});
after(async () => { if (env) await env.cleanup(); });
const db = uid => env.authenticatedContext(uid).firestore();
test('profile cannot grant itself role, tenant or activation', async () => {
  await assertFails(updateDoc(doc(db('cashier'),'usuarios','cashier'),{ rol:'superadmin' }));
  await assertFails(updateDoc(doc(db('cashier'),'usuarios','cashier'),{ empresaId:'b' }));
  await assertFails(updateDoc(doc(db('disabled'),'usuarios','disabled'),{ activo:true }));
  await assertSucceeds(updateDoc(doc(db('cashier'),'usuarios','cashier'),{ nombre:'Nuevo nombre' }));
  await assertFails(setDoc(doc(env.authenticatedContext('unknown').firestore(),'usuarios','unknown'),{ rol:'superadmin',empresaId:'a',activo:true }));
});
test('financial reads require active user and matching tenant', async () => {
  await assertSucceeds(getDoc(doc(db('cashier'),'prestamos','loanA')));
  await assertFails(getDoc(doc(db('cashier'),'prestamos','loanB')));
  await assertFails(getDoc(doc(db('disabled'),'prestamos','loanA')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'prestamos','loanA')));
  await assertSucceeds(getDocs(query(collection(db('cashier'),'prestamos'),where('empresaId','==','a'))));
});
test('financial writes are server-only, including for owners', async () => {
  await assertFails(updateDoc(doc(db('owner'),'prestamos','loanA'),{ saldoRestante:0 }));
  await assertFails(setDoc(doc(db('cashier'),'pagos','forged'),{ empresaId:'a',monto:100 }));
  await assertFails(updateDoc(doc(db('root'),'prestamos','loanA'),{ saldoRestante:0 }));
});
test('company can be read by staff but suspension and capital cannot be edited', async () => {
  await assertSucceeds(getDoc(doc(db('cashier'),'empresas','a')));
  await assertSucceeds(updateDoc(doc(db('owner'),'empresas','a'),{ nombre:'Financiera' }));
  await assertFails(updateDoc(doc(db('owner'),'empresas','a'),{ estado:'activa',capitalInicial:999999 }));
});
test('investment records are restricted to managers of their tenant', async () => {
  await assertSucceeds(getDoc(doc(db('owner'),'inversion_contratos','invA')));
  await assertFails(getDoc(doc(db('cashier'),'inversion_contratos','invA')));
  await assertFails(getDoc(doc(db('other'),'inversion_contratos','invA')));
});
test('Storage rejects legacy global paths, cross-tenant reads, dangerous types and oversized uploads', async () => {
  const owner = env.authenticatedContext('owner').storage(), other = env.authenticatedContext('other').storage();
  await assertSucceeds(uploadBytes(ref(owner,'empresas/a/clientes/test.pdf'),new Uint8Array([1,2]),{ contentType:'application/pdf' }));
  await assertFails(getBytes(ref(other,'empresas/a/clientes/test.pdf')));
  await assertFails(uploadBytes(ref(owner,'clientes/legacy.pdf'),new Uint8Array([1]),{ contentType:'application/pdf' }));
  await assertFails(uploadBytes(ref(owner,'empresas/a/test.html'),new Uint8Array([1]),{ contentType:'text/html' }));
  await assertFails(uploadBytes(ref(owner,'empresas/a/large.pdf'),new Uint8Array(5*1024*1024+1),{ contentType:'application/pdf' }));
  await assertFails(uploadBytes(ref(env.authenticatedContext('reader').storage(),'empresas/a/reader.pdf'),new Uint8Array([1]),{ contentType:'application/pdf' }));
});
