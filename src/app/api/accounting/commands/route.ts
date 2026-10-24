import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, ApiError, requireActor } from '@/lib/server-auth';
import { managers } from '@/lib/permissions';
import { LedgerError } from '@/lib/accounting/core';
import { ledgerService } from '@/lib/accounting/service';
import { rateLimit } from '@/lib/rate-limit';

const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const base = { key: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), description: z.string().trim().min(4).max(240) };
const amount = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const schema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('open'), clientId: identifier }).strict(),
  z.object({ ...base, type: z.literal('journal'), source: z.string().trim().min(1).max(160), lines: z.array(z.object({ account: z.string(), debit: z.number().int().nonnegative(), credit: z.number().int().nonnegative() }).strict()).min(2).max(40) }).strict(),
  z.object({ ...base, type: z.literal('deposit'), savingsId: identifier, amount, cash: z.enum(['1101', '1102']) }).strict(),
  z.object({ ...base, type: z.literal('withdraw'), savingsId: identifier, amount, cash: z.enum(['1101', '1102']) }).strict(),
  z.object({ ...base, type: z.literal('transfer'), savingsId: identifier, targetId: identifier, amount }).strict(),
  z.object({ ...base, type: z.literal('hold'), savingsId: identifier, amount }).strict(),
  z.object({ ...base, type: z.literal('release'), holdId: identifier }).strict(),
  z.object({ ...base, type: z.literal('reverse'), entryId: identifier }).strict(),
  z.object({ ...base, type: z.literal('close') }).strict(),
]);
export async function POST(request: Request) {
  try {
    if (process.env.VERCEL_ENV === 'production' || process.env.FINOVA_ACCOUNTING_WORKBENCH_ENABLED !== 'true') return NextResponse.json({ error: 'Este laboratorio contable no está disponible en producción.' }, { status: 404 });
    const actor = await requireActor(request, managers);
    // This gate is server-side and separate from tenant configuration. Browser cannot activate it.
    if (process.env.FINOVA_ACCOUNTING_WRITES_ENABLED !== 'true') throw new ApiError(409, 'La contabilidad está en preparación. La operación actual no se ha modificado.');
    await rateLimit('accounting-command:' + actor.uid, 60, 60000);
    const text = await request.text();
    if (text.length > 20000) throw new ApiError(413, 'La solicitud excede el tamaño permitido.');
    const command = schema.parse(JSON.parse(text));
    const result = await ledgerService(adminDb)(actor, command);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return error instanceof LedgerError ? NextResponse.json({ error: error.message }, { status: 409 }) : apiError(error);
  }
}
