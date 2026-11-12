import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { managers } from '@/lib/permissions';
import { apiError, requireActor } from '@/lib/server-auth';
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const [config, summary] = await Promise.all([adminDb.doc('capital_settings/' + actor.empresaId).get(), adminDb.doc('capital_control/' + actor.empresaId).get()]);
    const totals = summary.data() || {};
    const enabled = process.env.FINOVA_CAPITAL_PAYMENTS_ENABLED === 'true' && config.data()?.enabled === true && config.data()?.currency === 'USD' && config.data()?.policy === 'proporcional-v1';
    const reserved = totals.reserved || 0;
    const restricted = totals.restricted || 0;
    const interestAvailable = Math.max(0, (totals.collected || 0) - reserved - (totals.spent || 0) - restricted);
    return NextResponse.json({
      empresaId: actor.empresaId, enabled, outflow: totals.outflow || 0, reserved,
      ...(managers.includes(actor.rol) ? { restricted, interestAvailable } : {}),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
