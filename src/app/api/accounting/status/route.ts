import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireActor } from '@/lib/server-auth';
import { managers } from '@/lib/permissions';
import { chart, exactSum, reviewLegacy, validDate } from '@/lib/accounting/core';

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, managers);
    const base = adminDb.collection('accounting').doc(actor.empresaId);
    // A consistent read snapshot avoids showing account totals from different commits.
    const result = await adminDb.runTransaction(async tx => {
      const [config, balances, accounts, entries, loans, payments] = await Promise.all([
        tx.get(base), tx.get(base.collection('balances')),
        tx.get(base.collection('savings').limit(201)),
        tx.get(base.collection('entries').orderBy('createdAt', 'desc').limit(51)),
        tx.get(adminDb.collection('prestamos').where('empresaId', '==', actor.empresaId).select('fechaDesembolso', 'totalPagar', 'saldoRestante')),
        tx.get(adminDb.collection('pagos').where('empresaId', '==', actor.empresaId).select('prestamoId', 'monto')),
      ]);
      const dates = loans.docs.map(d => d.data().fechaDesembolso).filter((d): d is string => typeof d === 'string' && validDate(d)).sort();
      const invalidLoanDates = loans.size - dates.length;
      const cfg = config.data();
      return {
        empresaId: actor.empresaId,
        currency: 'USD', enabled: process.env.FINOVA_ACCOUNTING_WRITES_ENABLED === 'true' && cfg?.enabled === true && cfg.openingReconciled === true && typeof cfg.openingApprovedBy === 'string' && !!cfg.openingApprovedBy.trim() && cfg.currency === 'USD' && cfg.version === 1 && validDate(cfg.startDate),
        startDate: cfg?.startDate || dates[0] || null, startDateSource: cfg ? 'configured' : 'oldest-loan',
        invalidLoanDates, loanCount: loans.size, closedThrough: cfg?.closedThrough || null,
        legacyIntegrated: false,
        legacyReview: reviewLegacy(loans.docs.map(d => ({ id: d.id, ...d.data() })), payments.docs.map(d => d.data())),
        chart: chart.map(a => ({ ...a, net: balances.docs.find(d => d.id === a.code)?.data()?.net || 0 })),
        trialDifference: balances.docs.reduce((sum, d) => exactSum(sum, d.data().net), 0),
        savings: accounts.docs.slice(0, 200).map(d => ({ id: d.id, clientId: d.data().clientId, balance: d.data().balance, held: d.data().held, state: d.data().state })),
        moreSavings: accounts.size > 200,
        entries: entries.docs.slice(0, 50).map(d => ({ id: d.id, date: d.data().date, description: d.data().description, totals: d.data().totals, lines: d.data().lines, reverses: d.data().reverses })),
        moreEntries: entries.size > 50,
      };
    }, { readOnly: true });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
