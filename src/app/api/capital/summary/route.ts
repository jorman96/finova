import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireActor } from '@/lib/server-auth';
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const [config, summary] = await Promise.all([adminDb.doc('capital_settings/' + actor.empresaId).get(), adminDb.doc('capital_control/' + actor.empresaId).get()]);
    return NextResponse.json({ empresaId: actor.empresaId, enabled: process.env.FINOVA_CAPITAL_PAYMENTS_ENABLED === 'true' && config.data()?.enabled === true && config.data()?.currency === 'USD' && config.data()?.policy === 'proporcional-v1', outflow: summary.data()?.outflow || 0, reserved: summary.data()?.reserved || 0 }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
