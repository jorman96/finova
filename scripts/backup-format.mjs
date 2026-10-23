import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { Timestamp, GeoPoint } from 'firebase-admin/firestore';
export function encode(value) {
  if (value instanceof Timestamp) return { t: 'timestamp', s: value.seconds, n: value.nanoseconds };
  if (value instanceof Date) return { t: 'date', v: value.toISOString() };
  if (value instanceof GeoPoint) return { t: 'geo', a: value.latitude, b: value.longitude };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { t: 'bytes', v: Buffer.from(value).toString('base64') };
  if (value && typeof value.path === 'string' && typeof value.get === 'function') return { t: 'reference', v: value.path };
  if (Array.isArray(value)) return { t: 'array', v: value.map(encode) };
  if (value && typeof value === 'object') return { t: 'map', v: Object.entries(value).map(([k, v]) => [k, encode(v)]) };
  if (typeof value === 'number' && !Number.isFinite(value)) return { t: 'number', v: String(value) };
  return { t: 'scalar', v: value };
}
export function decode(value, db) {
  switch (value.t) {
    case 'timestamp': return new Timestamp(value.s, value.n);
    case 'date': return new Date(value.v);
    case 'geo': return new GeoPoint(value.a, value.b);
    case 'bytes': return Buffer.from(value.v, 'base64');
    case 'reference': return db.doc(value.v);
    case 'array': return value.v.map(v => decode(v, db));
    case 'map': return Object.fromEntries(value.v.map(([k, v]) => [k, decode(v, db)]));
    case 'number': return Number(value.v);
    case 'scalar': return value.v;
    default: throw Error('Unsupported backup value');
  }
}
export function seal(payload, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(payload));
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return JSON.stringify({ version: 1, algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64'), checksum: createHash('sha256').update(plain).digest('hex') });
}
export function unseal(text, key) {
  const envelope = JSON.parse(text);
  if (envelope.version !== 1 || envelope.algorithm !== 'aes-256-gcm') throw Error('Unsupported backup');
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  cipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plain = Buffer.concat([cipher.update(Buffer.from(envelope.data, 'base64')), cipher.final()]);
  if (createHash('sha256').update(plain).digest('hex') !== envelope.checksum) throw Error('Backup checksum mismatch');
  return JSON.parse(plain);
}
