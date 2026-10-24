import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireActor } from '@/lib/server-auth';
import { managers } from '@/lib/permissions';
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, managers);
    const result = await adminDb.runTransaction(async tx => {
      const base = adminDb.doc('capital_control/' + actor.empresaId);
      const [settings, totals, company] = await Promise.all([tx.get(adminDb.doc('capital_settings/' + actor.empresaId)), tx.get(base), tx.get(adminDb.doc('empresas/' + actor.empresaId))]);
      const enabled = process.env.FINOVA_CAPITAL_PAYMENTS_ENABLED === 'true' && settings.data()?.enabled === true && settings.data()?.currency === 'USD' && settings.data()?.policy === 'proporcional-v1';
      const names = ['agreements', 'installments', 'lots', 'claims', 'reserves', 'payouts', 'restrictions', 'reversals', 'contributions', 'contribution_returns'] as const;
      const lists = await Promise.all(names.map(name => tx.get(base.collection(name).limit(name === 'installments' || name === 'claims' ? 501 : 201))));
      const data = Object.fromEntries(names.map((name, index) => [name, lists[index].docs.slice(0, name === 'installments' || name === 'claims' ? 500 : 200).map(d => ({ ...d.data(), id: d.id }))]));
      const truncated = lists.some((list, index) => list.size > (names[index] === 'installments' || names[index] === 'claims' ? 500 : 200));
      return { empresaId: actor.empresaId, enabled, currency: 'USD', policy: 'proporcional-v1', totals: totals.data() || {}, initialCapital: company.data()?.capitalInicial || 0, injections: company.data()?.inyeccionesCapital || [], banks: company.data()?.cuentasBancarias || [], truncated, ...data };
    }, { readOnly: true });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
