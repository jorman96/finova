/** Read-only by default. Only explicit --apply backfills nonfinancial metadata. Never recalculates historical contracts. */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFile } from 'node:fs/promises';
try { process.loadEnvFile('.env.local'); } catch { /* Prefer an already configured environment. */ }
const companyId = process.argv[process.argv.indexOf('--empresa') + 1];
if (!process.argv.includes('--empresa') || !/^[\w-]+$/.test(companyId || '')) throw new Error('Uso: node scripts/audit-data.mjs --empresa ID [--apply]');
initializeApp({ credential: cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) });
const db = getFirestore(), apply = process.argv.includes('--apply');
const company = (await db.collection('empresas').doc(companyId).get()).data();
if (!company) throw new Error('Empresa inexistente');
const zone = company.zonaHoraria || 'America/Guayaquil';
const day = date => { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date); const v=t=>parts.find(p=>p.type===t).value; return v('year')+'-'+v('month')+'-'+v('day'); };
const findings = [], changes = [];
for (const collection of ['usuarios','prestamos','pagos']) {
  const snap = await db.collection(collection).where('empresaId','==',companyId).get();
  for(const d of snap.docs) {
    const r=d.data(), patch={};
    if(collection==='usuarios') {
      if(r.activo !== true) findings.push({ collection,id:d.id,issue:'Revisar activación manual. No se habilita automáticamente.' });
      if(r.rol==='superadmin') findings.push({collection,id:d.id,issue:'Revisar privilegios de plataforma; la migración antigua podía promover usuarios.'});
    }
    if(collection==='pagos') {
      if(r.desgloseVersion!==1) findings.push({collection,id:d.id,issue:'Desglose histórico de capital/interés requiere conciliación. No se estima.'});
      if(r.anulado===undefined) patch.anulado=false;
      if(!r.fechaStr && r.fecha?.toDate) patch.fechaStr=day(r.fecha.toDate());
    }
    if(collection==='prestamos') {
      const quotas=await db.collection('cuotas').where('empresaId','==',companyId).where('prestamoId','==',d.id).get();
      if(quotas.size!==r.numeroCuotas) findings.push({collection,id:d.id,issue:'Cantidad de cuotas distinta al contrato'});
      const cents=n=>Math.round((n||0)*100), principal=quotas.docs.reduce((s,q)=>s+cents(q.data().capital),0), outstanding=quotas.docs.filter(q=>q.data().estado!=='anulada').reduce((s,q)=>s+cents(q.data().totalCuota)-cents(q.data().montoPagado),0);
      if(principal!==cents(r.monto)) findings.push({collection,id:d.id,issue:'Capital de cuotas no reconcilia con principal'});
      if(r.estado!=='cancelado' && outstanding!==cents(r.saldoRestante)) findings.push({collection,id:d.id,issue:'Saldo del préstamo no reconcilia con cuotas'});
    }
    if(Object.keys(patch).length) { changes.push({collection,id:d.id,fields:Object.keys(patch)}); if(apply) await db.runTransaction(async tx=>{const current=await tx.get(d.ref),data=current.data();const safe={};for(const [key,value]of Object.entries(patch))if(data?.[key]===undefined)safe[key]=value;if(Object.keys(safe).length)tx.update(d.ref,safe);}); }
  }
}
if(apply) await db.collection('auditoria').add({empresaId:companyId,accion:'backfill_metadatos',fecha:new Date(),registradoPor:'CLI',cantidad:changes.length});
await writeFile('audit-data-report.json',JSON.stringify({empresaId:companyId,mode:apply?'apply':'dry-run',generatedAt:new Date().toISOString(),findings,changes},null,2));
console.log(JSON.stringify({ mode:apply?'apply':'dry-run',issues:findings.length,metadataChanges:changes.length,report:'audit-data-report.json' }));
await db.terminate();
