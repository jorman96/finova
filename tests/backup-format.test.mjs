import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { encode, decode, seal, unseal } from '../scripts/backup-format.mjs';
test('backup preserves exact Firestore values and rejects tampering or a wrong key',()=>{
 const value={money:123.45,at:new Timestamp(1234,5678),geo:new GeoPoint(-2,-79),bytes:Buffer.from([0,255]),nested:[null,true,{t:'timestamp',v:'user data'}],nan:NaN};
 const encoded=encode(value),key=randomBytes(32),encrypted=seal({documents:[encoded]},key);
 assert.deepEqual(encode(decode(unseal(encrypted,key).documents[0])),encoded);
 assert.throws(()=>unseal(encrypted,randomBytes(32)));
 const broken=JSON.parse(encrypted);broken.tag=Buffer.alloc(16).toString('base64');assert.throws(()=>unseal(JSON.stringify(broken),key));
 assert.ok(!encrypted.includes('money'));
});
