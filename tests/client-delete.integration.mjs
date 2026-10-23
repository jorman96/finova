import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const project='demo-finova';initializeApp({projectId:project});const db=getFirestore(),auth=getAuth();
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-p','3110'],{env:{...process.env,NEXT_PUBLIC_FIREBASE_PROJECT_ID:project,NEXT_PUBLIC_FIREBASE_API_KEY:'fake',NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:project+'.firebaseapp.com',NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:project+'.appspot.com',NEXT_PUBLIC_FIREBASE_APP_ID:'fake',FIREBASE_CLIENT_EMAIL:'',FIREBASE_PRIVATE_KEY:'',RESEND_API_KEY:''},stdio:['ignore','pipe','pipe'],windowsHide:true});
let logs='';child.stdout.on('data',d=>logs=(logs+d).slice(-9000));child.stderr.on('data',d=>logs=(logs+d).slice(-9000));
async function post(body,token){return fetch('http://127.0.0.1:3110/api/clientes/eliminar',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});}
async function user(uid,rol,empresaId,activo){await auth.createUser({uid,email:uid+'@example.test',password:'Test123456!'});await db.collection('usuarios').doc(uid).set({rol,empresaId,nombre:uid,...(activo===undefined?{}:{activo})});const r=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:uid+'@example.test',password:'Test123456!',returnSecureToken:true})});return(await r.json()).idToken;}
let count=0;async function status(name,body,token,want){const r=await post(body,token);assert.equal(r.status,want,await r.text());console.log('PASS '+name);count++;}
try{
 for(let i=0;i<90;i++){try{if((await fetch('http://127.0.0.1:3110/api/clientes/eliminar')).status===405)break;}catch{}if(i===89)throw Error('server startup timeout');await delay(1000);}
 for(const id of ['a','b'])await db.collection('empresas').doc(id).set({estado:'activa'});
 const owner=await user('legacyOwner','dueño','a'),cashier=await user('cashier','cajero','a',true),other=await user('other','dueño','b',true),disabled=await user('disabled','dueño','a',false);
 await db.collection('clientes').doc('free').set({empresaId:'a'});
 await status('authentication required',{clienteId:'free'},null,401);
 await status('cashier denied',{clienteId:'free'},cashier,403);
 await status('disabled denied',{clienteId:'free'},disabled,403);
 await status('cross tenant denied',{clienteId:'free'},other,403);
 await status('invalid ID rejected',{clienteId:'bad/id'},owner,400);
 for(const collection of ['prestamos','pagos','cuotas']){
  const id='history_'+collection;await db.collection('clientes').doc(id).set({empresaId:'a'});await db.collection(collection).doc(id).set({clienteId:id,empresaId:'a',estado:'completado'});
  await status(collection+' protects history',{clienteId:id},owner,409);assert.ok((await db.collection('clientes').doc(id).get()).exists);
 }
 await status('legacy owner can delete client without history',{clienteId:'free'},owner,200);
 assert.equal((await db.collection('clientes').doc('free').get()).exists,false);
 assert.equal((await db.collection('auditoria').where('accion','==','eliminar_cliente').get()).size,1);
 await status('repeat deletion handled',{clienteId:'free'},owner,404);
 async function api(path,body,token){return fetch('http://127.0.0.1:3110'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});}
 assert.equal((await api('/api/admin/users',{email:'bad@example.test',password:'LongPassword123!',nombre:'Test',empresaId:'a',rol:'superadmin'},owner)).status,403);count++;console.log('PASS owner cannot create platform administrators');
 assert.equal((await api('/api/admin/users',{email:'cashier-action@example.test',password:'LongPassword123!',nombre:'Test',empresaId:'a',rol:'cajero'},cashier)).status,403);count++;console.log('PASS cashier cannot create accounts');
 for(const path of ['/api/admin/backup','/api/security/status','/api/security/events','/api/email/recibo','/api/email/cobranza','/api/accounting/status','/api/accounting/commands']){assert.equal((await api(path,{})).status,401);count++;}console.log('PASS sensitive endpoints require authentication');
 assert.equal((await api('/api/accounting/status',{},cashier)).status,403);count++;
 assert.equal((await api('/api/accounting/commands',{},cashier)).status,403);count++;
 for(const [id,empresaId,fechaDesembolso] of [['ledger-old-a','a','2026-08-11'],['ledger-new-a','a','2026-10-17'],['ledger-old-b','b','2026-05-30']])await db.doc('prestamos/'+id).set({empresaId,fechaDesembolso});
 const accounting=await api('/api/accounting/status',{},owner);assert.equal(accounting.status,200);const accountingData=await accounting.json();assert.equal(accountingData.currency,'USD');assert.equal(accountingData.startDate,'2026-08-11');assert.equal(accountingData.enabled,false);assert.equal(accountingData.entries.length,0);count++;console.log('PASS accounting starts at own-company oldest loan without importing balances');
 assert.equal((await api('/api/accounting/commands',{type:'deposit'},owner)).status,409);assert.equal((await db.collection('accounting').get()).size,0);count++;console.log('PASS accounting production write gate preserves all existing data');
 assert.equal((await api('/api/admin/backup',{},cashier)).status,403);count++;
 const backup=await api('/api/admin/backup',{},owner);assert.equal(backup.status,200);assert.equal((await backup.json()).empresaId,'a');count++;
 const profile=(await db.collection('usuarios').doc('legacyOwner').get()).data();assert.equal(profile.rol,'dueño');assert.equal(profile.empresaId,'a');assert.equal('activo' in profile,false);count++;console.log('PASS legacy owner retains unchanged profile and backup access');
 await db.collection('clientes').doc('portalClient').set({empresaId:'a',nombres:'Portal Demo',apellidos:'Prueba',cedula:'1234567890',correo:'portal@example.test',estado:'nuevo'});
 const portalUrl='http://127.0.0.1:3110/portal/a/cliente/portalClient';
 assert.equal((await fetch(portalUrl,{redirect:'manual'})).status,307);count++;
 const challenge=randomBytes(32).toString('hex'),code='123456';await db.collection('portal_challenges').doc(challenge).set({hash:createHash('sha256').update(challenge+code).digest('hex'),clienteId:'portalClient',empresaId:'a',attempts:0,used:false,expiresAt:new Date(Date.now()+600000)});
 const login=await api('/api/portal/login',{action:'verify',challenge,code});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));count++;
 assert.equal((await fetch(portalUrl,{headers:{cookie}})).status,200);count++;
 assert.equal((await api('/api/portal/login',{action:'verify',challenge,code})).status,401);count++;
 const logout=await fetch('http://127.0.0.1:3110/api/portal/logout',{method:'POST',headers:{cookie}});assert.equal(logout.status,200);assert.equal((await fetch(portalUrl,{headers:{cookie},redirect:'manual'})).status,307);count++;console.log('PASS portal requires a one-time code, secure session and real logout');
 console.log('Completed '+count+' client deletion checks.');
}catch(e){console.error(e);console.error(logs);process.exitCode=1;}finally{child.kill();await db.terminate();}
