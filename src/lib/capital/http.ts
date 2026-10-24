import { getStorage } from 'firebase-admin/storage';
import { ApiError } from '../server-auth';
export function requireCapitalFeature() {
  if (process.env.FINOVA_CAPITAL_PAYMENTS_ENABLED !== 'true') throw new ApiError(409, 'Pagos de capital está disponible únicamente en el entorno de pruebas autorizado.');
}
export async function validateCapitalProof(raw: string | undefined, empresaId: string, folder: 'capital' | 'pagos') {
  if (!raw) return;
  const url = new URL(raw), bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const prefix = `/v0/b/${bucket}/o/`;
  const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST === '127.0.0.1:9198' && url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '9198';
  if ((!emulator && (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com')) || url.username || url.password || !url.pathname.startsWith(prefix)) throw new ApiError(400, 'El comprobante debe estar en el almacenamiento propio de esta financiera.');
  let path: string;
  try { path = decodeURIComponent(url.pathname.slice(prefix.length)); } catch { throw new ApiError(400, 'Ruta de comprobante inválida.'); }
  if (!path.startsWith(`empresas/${empresaId}/${folder}/`) || path.includes('..')) throw new ApiError(400, 'Comprobante de otra financiera o ruta inválida.');
  const [metadata] = await getStorage().bucket(bucket).file(path).getMetadata().catch(() => { throw new ApiError(400, 'No se pudo verificar el archivo del comprobante. Vuelve a adjuntarlo.'); });
  if (Number(metadata.size) > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(metadata.contentType || '')) throw new ApiError(400, 'Comprobante no válido.');
}
