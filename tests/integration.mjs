import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Use emulators only');
const project = 'demo-finova';
initializeApp({ projectId: project });
const db = getFirestore(), auth = getAuth(), base = 'http://127.0.0.1:3109';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','--webpack','-p','3109'], { env: { ...process.env, NEXT_PUBLIC_FIREBASE_PROJECT_ID: project, NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-key', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: project+'.firebaseapp.com', NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: project+'.appspot.com', NEXT_PUBLIC_FIREBASE_APP_ID: 'fake-app', NEXT_PUBLIC_USE_EMULATORS: 'true', NEXT_PUBLIC_APP_URL: base, RESEND_API_KEY: '', RESEND_FROM_EMAIL: '', FIREBASE_CLIENT_EMAIL: '', FIREBASE_PRIVATE_KEY: '', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore','pipe','pipe'], windowsHide: true });
let logs = '';
child.stdout.on('data', c => { logs = (logs+c).slice(-16000); });
child.stderr.on('data', c => { logs = (logs+c).slice(-16000); });
let count = 0;
async function check(name, fn) { await fn(); count++; console.log('PASS '+name); }
async function post(path, body, token, extra = {}) { return fetch(base+path, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:'Bearer '+token } : {}), ...extra }, body:JSON.stringify(body) }); }
async function ok(response) { const data = await response.json(); assert.equal(response.status,200,JSON.stringify(data)); return data; }
async function user(uid, rol, empresaId, activo = true) {
  await auth.createUser({ uid, email:uid+'@example.test', password:'LocalTest123456!' });
  await db.collection('usuarios').doc(uid).set({ uid, rol, empresaId, activo, nombre:uid });
  const response = await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:uid+'@example.test',password:'LocalTest123456!',returnSecureToken:true}) });
  const data = await response.json(); assert.ok(data.idToken,JSON.stringify(data)); return data.idToken;
}
try {
  for (let i=0;i<120;i++) { try { const res=await fetch(base+'/api/finance',{method:'GET'}); if(res.status===405) break; } catch {} if(i===119) throw new Error('Server failed to start\n'+logs); await delay(1000); }
  for(const id of ['a','b']) await db.collection('empresas').doc(id).set({ nombre:id,estado:'activa',moneda:'USD',capitalInicial:1000,zonaHoraria:'America/Guayaquil',cuentasBancarias:[] });
  await db.collection('clientes').doc('clientA').set({ empresaId:'a',nombres:'Cliente Prueba',apellidos:'A',cedula:'1234567890',correo:'client@example.test',score:50,estado:'nuevo' });
  await db.collection('clientes').doc('clientB').set({ empresaId:'b',nombres:'Cliente',apellidos:'B',score:50,estado:'nuevo' });
  await db.collection('inversionistas').doc('investorA').set({ empresaId:'a',nombres:'Inversionista',estado:'activo',totalInvertido:0,totalPagado:0,saldoPendiente:0 });
  const owner=await user('owner','dueño','a'), cashier=await user('cashier','cajero','a'), other=await user('other','dueño','b'), disabled=await user('disabled','dueño','a',false);
  const loanBody={action:'loan',requestId:randomUUID(),clienteId:'clientA',monto:100,tasaInteres:10,periodoTasa:'mensual',tipoInteres:'fijo',frecuenciaPago:'mensual',numeroCuotas:2,fechaDesembolso:'2026-01-01',fechaPrimerPago:'2026-01-31'};
  let loan;
  await check('unauthenticated and inactive callers rejected',async()=>{ assert.equal((await post('/api/finance',loanBody)).status,401);assert.equal((await post('/api/finance',loanBody,disabled)).status,403); });
  await check('cashier cannot create credit and owner cannot cross tenants',async()=>{assert.equal((await post('/api/finance',loanBody,cashier)).status,403);assert.equal((await post('/api/finance',loanBody,other)).status,403);});
  await check('loan plus complete schedule saved atomically with exact totals',async()=>{loan=await ok(await post('/api/finance',loanBody,owner));const l=(await db.collection('prestamos').doc(loan.id).get()).data();assert.equal(l.totalPagar,120);const c=await db.collection('cuotas').where('prestamoId','==',loan.id).get();assert.equal(c.size,2);assert.equal(c.docs.reduce((s,d)=>s+d.data().capital,0),100);});
  await check('retry produces same credit, conflicting key rejected',async()=>{const again=await ok(await post('/api/finance',loanBody,owner));assert.equal(again.id,loan.id);assert.equal((await post('/api/finance',{...loanBody,monto:101},owner)).status,409);});
  let paymentA;
  await check('simultaneous cashier payments preserve all money',async()=>{[paymentA]=await Promise.all([20,30].map(monto=>post('/api/finance',{action:'payment',requestId:randomUUID(),prestamoId:loan.id,monto,metodo:'efectivo'},cashier).then(ok)));assert.equal((await db.collection('prestamos').doc(loan.id).get()).data().saldoRestante,70);const p=await db.collection('pagos').where('prestamoId','==',loan.id).get();assert.equal(p.size,2);assert.equal(p.docs.reduce((s,d)=>s+d.data().montoInteres,0),10);});
  await check('reversals follow committed payment sequence, not request timestamps',async()=>{const payments=await db.collection('pagos').where('prestamoId','==',loan.id).get();const ordered=payments.docs.sort((a,b)=>a.data().secuencia-b.data().secuencia);assert.deepEqual(ordered.map(d=>d.data().secuencia),[1,2]);assert.equal((await post('/api/finance',{action:'reverse_payment',requestId:randomUUID(),pagoId:ordered[0].id,motivo:'Intento fuera de secuencia'},owner)).status,409);});
  await check('overpayment and cross-tenant payment rejected',async()=>{const body={action:'payment',requestId:randomUUID(),prestamoId:loan.id,monto:1000,metodo:'efectivo'};assert.equal((await post('/api/finance',body,cashier)).status,409);assert.equal((await post('/api/finance',{...body,monto:1},other)).status,403);});
  await check('concurrent retries create only one payment',async()=>{const body={action:'payment',requestId:randomUUID(),prestamoId:loan.id,monto:5,metodo:'efectivo'};const [a,b]=await Promise.all([post('/api/finance',body,cashier).then(ok),post('/api/finance',body,cashier).then(ok)]);assert.equal(a.id,b.id);assert.equal((await db.collection('prestamos').doc(loan.id).get()).data().saldoRestante,65);await ok(await post('/api/finance',{action:'reverse_payment',requestId:randomUUID(),pagoId:a.id,motivo:'Corrección de prueba local'},owner));assert.equal((await db.collection('prestamos').doc(loan.id).get()).data().saldoRestante,70);assert.equal((await db.collection('pagos').doc(a.id).get()).data().anulado,true);});
  await check('investment and simultaneous partial repayments reconcile',async()=>{const inv=await ok(await post('/api/finance',{action:'investment',requestId:randomUUID(),inversionistaId:'investorA',montoTotal:100,montoCartera:80,montoOtros:20,tieneInteres:true,tasaInteresMensual:2,modalidadPago:'cuota_amortizada_mensual',plazoMeses:2,fechaInicio:'2026-01-01',fechaPrimerPago:'2026-01-31'},owner));await Promise.all([5,20].map(monto=>post('/api/finance',{action:'investor_payment',requestId:randomUUID(),contratoId:inv.id,monto,metodo:'efectivo'},owner).then(ok)));assert.equal((await db.collection('inversion_contratos').doc(inv.id).get()).data().saldoPendiente,79);assert.equal((await db.collection('inversionistas').doc('investorA').get()).data().saldoPendiente,79);});
  await check('owners cannot create superadmins',async()=>{assert.equal((await post('/api/admin/users',{email:'forbidden@example.test',password:'LocalTest123456!',nombre:'Forbidden',empresaId:'a',rol:'superadmin'},owner)).status,403);});
  await check('email and image endpoints reject unauthenticated callers and internal hosts',async()=>{assert.equal((await post('/api/email/recibo',{reciboId:paymentA.id})).status,401);assert.equal((await post('/api/email/cobranza',{cuotaId:'test'})).status,401);assert.equal((await fetch(base+'/api/proxy-image?url='+encodeURIComponent('http://127.0.0.1/private'),{headers:{Authorization:'Bearer '+owner}})).status,400);});
  await check('dashboard, report and mora agree on partial payments',async()=>{const d=await ok(await post('/api/dashboard',{from:null,to:null},owner));assert.equal(d.totalRecaudadoPeriodo,50);assert.equal(d.interesCobrado,10);assert.equal(d.pagosSinDesglose,0);assert.equal(d.moraVencido,70);const m=await ok(await post('/api/mora',{},owner));assert.equal(m.rows.reduce((s,r)=>s+r.saldo,0),70);const report=await ok(await post('/api/reports',{from:'2020-01-01',to:'2099-01-01'},owner));assert.equal(report.pagos.length,2);});
  await check('expense, reconciliation and company backup work without deleting history',async()=>{await ok(await post('/api/finance',{action:'cash',requestId:randomUUID(),tipo:'gasto',monto:7,cuentaOrigen:'Caja General',motivo:'Gasto de prueba',referencia:'LOCAL-1'},owner));const treasury=await ok(await post('/api/treasury',{},owner));const expense=treasury.rows.find(r=>r.tipo==='gasto');assert.ok(expense);await ok(await post('/api/finance',{action:'reconcile',requestId:randomUUID(),movimientoId:expense.id,referencia:'ESTADO-LOCAL-1'},owner));assert.equal((await db.collection('movimientos_caja').doc(expense.id).get()).data().conciliado,true);const backup=await ok(await post('/api/admin/backup',{},owner));assert.equal(backup.empresaId,'a');assert.ok(backup.pagos.length>=3);});
  await check('client deletion protects roles, tenants and financial history',async()=>{
    await db.collection('clientes').doc('deleteMe').set({empresaId:'a',nombres:'Temporal'});
    assert.equal((await post('/api/clientes/eliminar',{clienteId:'deleteMe'})).status,401);
    assert.equal((await post('/api/clientes/eliminar',{clienteId:'deleteMe'},cashier)).status,403);
    assert.equal((await post('/api/clientes/eliminar',{clienteId:'deleteMe'},other)).status,403);
    assert.equal((await post('/api/clientes/eliminar',{clienteId:'clientA'},owner)).status,409);
    await ok(await post('/api/clientes/eliminar',{clienteId:'deleteMe'},owner));
    assert.equal((await db.collection('clientes').doc('deleteMe').get()).exists,false);
    assert.equal((await post('/api/clientes/eliminar',{clienteId:'deleteMe'},owner)).status,404);
    assert.equal((await db.collection('auditoria').where('accion','==','eliminar_cliente').get()).size,1);
  });
  await check('portal enforces OTP session, one-time codes and real logout',async()=>{
    const url=base+'/portal/a/cliente/clientA';assert.equal((await fetch(url,{redirect:'manual'})).status,307);
    const challenge=randomBytes(32).toString('hex'),code='123456';await db.collection('portal_challenges').doc(challenge).set({hash:createHash('sha256').update(challenge+code).digest('hex'),clienteId:'clientA',empresaId:'a',attempts:0,used:false,expiresAt:new Date(Date.now()+600000)});
    const login=await post('/api/portal/login',{action:'verify',challenge,code});await ok(login);const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
    const page=await fetch(url,{headers:{cookie}});assert.equal(page.status,200);assert.ok((await page.text()).includes('Cliente Prueba'));
    assert.equal((await post('/api/portal/login',{action:'verify',challenge,code})).status,401);
    await ok(await post('/api/portal/logout',{},undefined,{cookie}));assert.equal((await fetch(url,{headers:{cookie},redirect:'manual'})).status,307);
  });
  console.log('Integration checks passed: '+count);
  if (process.env.FINOVA_KEEP_TEST_SERVER === '1') { console.log('Demo UI ready at '+base+' for 10 minutes. Use owner@example.test / LocalTest123456!'); await delay(600_000); }
} catch(error) { console.error(error); console.error('Server output (tail):\n'+logs); process.exitCode=1; }
finally { child.kill(); await db.terminate(); }
