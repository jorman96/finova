import { readFile } from 'node:fs/promises';
import { test, before, after } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
let env;
const uid=r=>r==='dueño'?'owner':r;
const roles=['superadmin','dueño','admin','gestor','cobrador','cajero','consulta'];
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-finova',firestore:{host:'127.0.0.1',port:8088,rules:await readFile('firestore.rules','utf8')},storage:{host:'127.0.0.1',port:9198,rules:await readFile('storage.rules','utf8')}});
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();for(const id of ['a','b'])await setDoc(doc(db,'empresas',id),{estado:'activa'});
  for(const rol of roles)await setDoc(doc(db,'usuarios',uid(rol)),{rol,empresaId:'a'});
  await setDoc(doc(db,'usuarios','disabled'),{rol:'dueño',empresaId:'a',activo:false});
  await setDoc(doc(db,'clientes','a'),{empresaId:'a',nombres:'Demo',estado:'activo'});
  await setDoc(doc(db,'clientes','b'),{empresaId:'b',nombres:'Demo B'});
  await setDoc(doc(db,'prestamos','a'),{empresaId:'a',clienteId:'a',saldoRestante:10,estado:'activo'});
 });
});
after(async()=>env?.cleanup());
test('all seven legacy roles retain permitted same-company reads',async()=>{for(const r of roles)await assertSucceeds(getDoc(doc(env.authenticatedContext(uid(r)).firestore(),'clientes','a')));});
test('non-platform users cannot access another financial company',async()=>{for(const r of roles.filter(r=>r!=='superadmin'))await assertFails(getDoc(doc(env.authenticatedContext(uid(r)).firestore(),'clientes','b')));});
test('disabled, missing-profile and unauthenticated accounts are denied',async()=>{for(const c of [env.authenticatedContext('disabled'),env.authenticatedContext('unknown'),env.unauthenticatedContext()])await assertFails(getDoc(doc(c.firestore(),'clientes','a')));});
test('personal updates work but roles, company and activation are immutable',async()=>{const db=env.authenticatedContext('owner').firestore();await assertSucceeds(updateDoc(doc(db,'usuarios','owner'),{nombre:'Nombre actualizado'}));for(const data of [{rol:'superadmin'},{empresaId:'b'},{activo:false}])await assertFails(updateDoc(doc(db,'usuarios','owner'),data));await assertFails(setDoc(doc(db,'usuarios','new'),{rol:'superadmin',empresaId:'a'}));});
test('only managers create credits; tenant cannot be reassigned',async()=>{for(const r of roles){const db=env.authenticatedContext(uid(r)).firestore();const operation=setDoc(doc(db,'prestamos','new_'+r),{empresaId:'a',clienteId:'a'});await (['superadmin','dueño','admin'].includes(r)?assertSucceeds(operation):assertFails(operation));}await assertFails(updateDoc(doc(env.authenticatedContext('owner').firestore(),'prestamos','a'),{empresaId:'b'}));});
test('cashiers may apply legacy repayments but cannot change principal',async()=>{const db=env.authenticatedContext('cajero').firestore();await assertSucceeds(updateDoc(doc(db,'prestamos','a'),{saldoRestante:8}));await assertFails(updateDoc(doc(db,'prestamos','a'),{monto:0}));});
test('history cannot be erased and security events cannot be forged in browser',async()=>{const db=env.authenticatedContext('owner').firestore();await assertFails(deleteDoc(doc(db,'prestamos','a')));await assertFails(setDoc(doc(db,'auditoria','fake'),{empresaId:'a'}));await assertFails(setDoc(doc(db,'security_events','fake'),{empresaId:'a'}));});
test('new files are scoped by tenant and legacy documents remain readable',async()=>{
 const owner=env.authenticatedContext('owner').storage(),other=env.authenticatedContext('consulta').storage();
 await assertSucceeds(uploadBytes(ref(owner,'empresas/a/docs/test.pdf'),new Uint8Array([1,2]),{contentType:'application/pdf'}));
 await assertFails(uploadBytes(ref(owner,'empresas/b/docs/test.pdf'),new Uint8Array([1]),{contentType:'application/pdf'}));
 await assertFails(uploadBytes(ref(other,'empresas/a/docs/readonly.pdf'),new Uint8Array([1]),{contentType:'application/pdf'}));
 await assertFails(uploadBytes(ref(owner,'empresas/a/docs/test.html'),new Uint8Array([1]),{contentType:'text/html'}));
 await env.withSecurityRulesDisabled(c=>uploadBytes(ref(c.storage(),'clientes/a/documentos/legacy.pdf'),new Uint8Array([3]),{contentType:'application/pdf'}));
 await assertSucceeds(getBytes(ref(owner,'clientes/a/documentos/legacy.pdf')));
 await assertFails(getBytes(ref(owner,'clientes/b/documentos/legacy.pdf')));
});

test('tenant-filtered detail queries remain usable after isolation',async()=>{
 const db=env.authenticatedContext('owner').firestore();
 const snap=await assertSucceeds(getDocs(query(collection(db,'prestamos'),where('empresaId','==','a'),where('clienteId','==','a'))));
 if(!snap.docs.some(d=>d.id==='a'))throw Error('Expected existing credit');
 await assertFails(getDocs(query(collection(db,'prestamos'),where('clienteId','==','a'))));
});
test('enabled capital companies cannot forge collections, allocations or control settings in browser',async()=>{
 await env.withSecurityRulesDisabled(async c=>{
  await setDoc(doc(c.firestore(),'capital_settings','a'),{enabled:true,currency:'USD',policy:'proporcional-v1'});
  await setDoc(doc(c.firestore(),'cuotas','capital-rule-quota'),{empresaId:'a',prestamoId:'a',montoPagado:0});
 });
 for(const r of roles){const db=env.authenticatedContext(uid(r)).firestore();
  await assertFails(setDoc(doc(db,'pagos','forged-'+uid(r)),{empresaId:'a',monto:100,allocationVerified:true}));
  await assertFails(updateDoc(doc(db,'cuotas','capital-rule-quota'),{interesCobradoCentavos:100}));
  await assertFails(setDoc(doc(db,'capital_control','a','lots','fake'),{interest:100000}));
  await assertFails(setDoc(doc(db,'capital_settings','a'),{enabled:false}));
  await assertFails(updateDoc(doc(db,'empresas','a'),{capitalInicial:999999}));
  await assertFails(updateDoc(doc(db,'empresas','a'),{inyeccionesCapital:[]}));
 }
});

test('operational and laboratory records cannot be written directly from any browser role',async()=>{
 for(const role of roles){const db=env.authenticatedContext(uid(role)).firestore();await assertFails(setDoc(doc(db,'operational_workspaces/a/tasks/forged'),{empresaId:'a',state:'resuelta'}));await assertFails(setDoc(doc(db,'accounting/a/savings/forged'),{balance:100000}));}
});
