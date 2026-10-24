import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, ApiError, requireActor } from '@/lib/server-auth';
import { collectors, managers } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import { CapitalError } from '@/lib/capital/core';
import { capitalService } from '@/lib/capital/service';
import { requireCapitalFeature, validateCapitalProof } from '@/lib/capital/http';
const id = z.string().regex(/^[\w-]{1,128}$/), money = z.number().int().positive().max(9999999999999);
const base = { key: z.string().uuid() }, reason = z.string().trim().min(4).max(240), date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reference = z.string().trim().min(3).max(100), proofUrl = z.url().max(2048).optional();
const schema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('contribute'), cents: money, reason, reference, confirmedReceived: z.literal(true) }).strict(),
  z.object({ ...base, type: z.literal('returnContribution'), contributionId: id, reason, reference, confirmedReturned: z.literal(true) }).strict(),
  z.object({ ...base, type: z.literal('receive'), loanId: id, cents: money, method: z.enum(['efectivo', 'transferencia', 'deposito', 'otro']), bankId: id.optional(), note: z.string().max(500), proofUrl }).strict(),
  z.object({ ...base, type: z.literal('agreement'), injectionId: id, beneficiary: z.string().trim().min(2).max(100), mode: z.enum(['principal_only', 'includes_interest']), cost: z.number().int().nonnegative().max(9999999999999), monthly: money, firstDate: date, reserveBps: z.number().int().min(1).max(10000), acknowledgedDebt: z.literal(true) }).strict(),
  z.object({ ...base, type: z.literal('reserve'), agreementId: id, installmentId: id, lots: z.array(z.object({ id, cents: money }).strict()).min(1).max(25) }).strict(),
  z.object({ ...base, type: z.literal('release'), reserveId: id, reason }).strict(),
  z.object({ ...base, type: z.literal('restrict'), lotId: id, cents: money, reason }).strict(),
  z.object({ ...base, type: z.literal('unrestrict'), restrictionId: id, reason }).strict(),
  z.object({ ...base, type: z.literal('pay'), agreementId: id, installmentId: id, cents: money, source: z.string().regex(/^(cash|bank:[\w-]{1,128})$/), date, reference, proofUrl, confirmedCashAvailable: z.literal(true) }).strict(),
  z.object({ ...base, type: z.literal('reverse'), payoutId: id, date, reason, reference, proofUrl, confirmedReturned: z.literal(true) }).strict(),
]);
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, collectors); requireCapitalFeature();
    await rateLimit('capital:' + actor.uid, 60, 60000);
    const text = await request.text(); if (text.length > 20000) throw new ApiError(413, 'Solicitud demasiado grande.');
    const command = schema.parse(JSON.parse(text));
    if (command.type !== 'receive' && !managers.includes(actor.rol)) throw new ApiError(403, 'Solo el dueño o administrador puede gestionar estos fondos.');
    if ('proofUrl' in command) await validateCapitalProof(command.proofUrl, actor.empresaId, command.type === 'receive' ? 'pagos' : 'capital');
    return NextResponse.json(await capitalService(adminDb)(actor, command), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return error instanceof CapitalError ? NextResponse.json({ error: error.message }, { status: 409 }) : apiError(error); }
}
