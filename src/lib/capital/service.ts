import { createHash } from 'node:crypto';
import { FieldValue, type Firestore, type Transaction, type DocumentData } from 'firebase-admin/firestore';
import { add, amount, CapitalError, percentage, positive, schedule, share, sourceDate, today, validDate, verifiedSplit } from './core';

export type Operator = { uid: string; empresaId: string };
type Base = { key: string };
export type CapitalCommand = Base & (
  | { type: 'contribute'; cents: number; reason: string; reference: string; confirmedReceived: true }
  | { type: 'returnContribution'; contributionId: string; reason: string; reference: string; confirmedReturned: true }
  | { type: 'receive'; loanId: string; cents: number; method: 'efectivo' | 'transferencia' | 'deposito' | 'otro'; bankId?: string; note: string; proofUrl?: string }
  | { type: 'agreement'; injectionId: string; beneficiary: string; mode: 'principal_only' | 'includes_interest'; cost: number; monthly: number; firstDate: string; reserveBps: number; acknowledgedDebt: true }
  | { type: 'reserve'; agreementId: string; installmentId: string; lots: { id: string; cents: number }[] }
  | { type: 'release'; reserveId: string; reason: string }
  | { type: 'restrict'; lotId: string; cents: number; reason: string }
  | { type: 'unrestrict'; restrictionId: string; reason: string }
  | { type: 'pay'; agreementId: string; installmentId: string; cents: number; source: string; date: string; reference: string; proofUrl?: string; confirmedCashAvailable: true }
  | { type: 'reverse'; payoutId: string; date: string; reason: string; reference: string; proofUrl?: string; confirmedReturned: true }
);
export function safeId(id: string) { if (!/^[\w-]{1,128}$/.test(id)) throw new CapitalError('Identificador inválido.'); return id; }
export const digest = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const sum = (numbers: number[]) => numbers.reduce(add, 0);
const dollars = (n: number) => n / 100;
async function recordedCash(tx: Transaction, db: Firestore, empresaId: string, company: DocumentData, control: DocumentData) {
  const [loans, payments, investments, investorPayments] = await Promise.all(['prestamos', 'pagos', 'inversion_contratos', 'pagos_inversionistas'].map(c => tx.get(db.collection(c).where('empresaId', '==', empresaId))));
  return sum([amount(company.capitalInicial || 0, true), sum((company.inyeccionesCapital || []).map((i: { monto: unknown }) => amount(i.monto))), sum(investments.docs.map(d => amount(d.data().montoCartera || 0, true))), -sum(loans.docs.map(d => amount(d.data().monto))), sum(payments.docs.filter(d => !d.data().anulado).map(d => amount(d.data().monto))), -sum(investorPayments.docs.map(d => amount(d.data().monto))), -(control.outflow || 0)]);
}
export function capitalService(db: Firestore) {
  return async (actor: Operator, command: CapitalCommand) => {
    safeId(actor.empresaId); safeId(actor.uid); safeId(command.key);
    const base = db.collection('capital_control').doc(actor.empresaId);
    const opId = digest([actor.empresaId, command.key]), operation = base.collection('operations').doc(opId), fingerprint = digest(command);
    const day = today();
    return db.runTransaction(async tx => {
      const [settingsSnap, controlSnap, opSnap, profileSnap, companySnap] = await Promise.all([
        tx.get(db.doc('capital_settings/' + actor.empresaId)), tx.get(base), tx.get(operation),
        tx.get(db.doc('usuarios/' + actor.uid)), tx.get(db.doc('empresas/' + actor.empresaId)),
      ]);
      const settings = settingsSnap.data(), profile = profileSnap.data(), company = companySnap.data(), control = controlSnap.data() || {};
      if (!settings?.enabled || settings.currency !== 'USD' || settings.policy !== 'proporcional-v1' || (company?.moneda && company.moneda !== 'USD')) throw new CapitalError('El módulo no está habilitado para esta financiera en USD.');
      const roles = command.type === 'receive' ? ['superadmin', 'dueño', 'admin', 'cajero', 'cobrador'] : ['superadmin', 'dueño', 'admin'];
      if (company?.estado !== 'activa' || profile?.empresaId !== actor.empresaId || (profile?.activo !== undefined && profile.activo !== true) || !roles.includes(profile?.rol)) throw new CapitalError('Operador o financiera no habilitados.');
      if (opSnap.exists) {
        if (opSnap.data()?.fingerprint !== fingerprint) throw new CapitalError('La referencia ya se usó con otros datos.');
        return { ...opSnap.data()!.result, repeated: true };
      }
      const meta = { empresaId: actor.empresaId, actorId: actor.uid, actorName: profile.nombre || actor.uid, createdAt: FieldValue.serverTimestamp(), date: day, currency: 'USD' };
      const delta: Record<string, number> = {};
      let result: { id: string; verified?: boolean; interest?: number; repeated?: boolean } = { id: opId };
      if (command.type === 'contribute') {
        positive(command.cents);
        if (!command.confirmedReceived || !command.reason.trim() || !command.reference.trim()) throw new CapitalError('Confirma la recepción real y la referencia del aporte.');
        const injection = { id: opId, monto: dollars(command.cents), fecha: day + 'T12:00:00.000Z', observaciones: command.reason.trim(), registradoPor: profile.nombre || actor.uid };
        tx.update(companySnap.ref, { inyeccionesCapital: [...(company.inyeccionesCapital || []), injection] });
        tx.create(base.collection('contributions').doc(opId), { ...meta, amount: command.cents, reason: command.reason, reference: command.reference, returned: false });
      } else if (command.type === 'returnContribution') {
        const original = await tx.get(base.collection('contributions').doc(safeId(command.contributionId))), c = original.data();
        const link = await tx.get(base.collection('injection_links').doc(command.contributionId));
        if (!c || c.returned || link.exists || !command.confirmedReturned || !command.reason.trim() || !command.reference.trim()) throw new CapitalError('Solo se puede restituir un aporte nuevo sin plan asociado, con devolución real confirmada.');
        const cash = await recordedCash(tx, db, actor.empresaId, company, control);
        if (cash - (control.reserved || 0) < c.amount) throw new CapitalError('La caja libre no alcanza para devolver el aporte.');
        tx.update(original.ref, { returned: true, returnOperation: opId });
        tx.create(base.collection('contribution_returns').doc(opId), { ...meta, contributionId: original.id, amount: c.amount, reason: command.reason, reference: command.reference });
        delta.outflow = c.amount;
      } else if (command.type === 'receive') {
        positive(command.cents);
        const loanRef = db.doc('prestamos/' + safeId(command.loanId));
        const loanSnap = await tx.get(loanRef), loan = loanSnap.data();
        if (!loan || loan.empresaId !== actor.empresaId || !['activo', 'moroso'].includes(loan.estado)) throw new CapitalError('Crédito no disponible en esta financiera.');
        const [installments, client] = await Promise.all([
          tx.get(db.collection('cuotas').where('empresaId', '==', actor.empresaId).where('prestamoId', '==', command.loanId)),
          tx.get(db.doc('clientes/' + safeId(loan.clienteId))),
        ]);
        if (installments.size > 200 || client.data()?.empresaId !== actor.empresaId) throw new CapitalError('El crédito requiere revisión de sus relaciones o número de cuotas.');
        const rows = installments.docs.map(d => ({ ref: d.ref, id: d.id, data: d.data() })).sort((a, b) => a.data.numeroCuota - b.data.numeroCuota);
        const remaining = amount(loan.saldoRestante);
        const pending = sum(rows.map(r => amount(r.data.totalCuota) - amount(r.data.montoPagado || 0, true)));
        if (remaining !== pending || amount(loan.totalPagar) !== sum(rows.map(r => amount(r.data.totalCuota))) || command.cents > remaining || rows.some(r => r.data.clienteId !== loan.clienteId)) throw new CapitalError('Saldo o cuotas inconsistentes. Concilia el crédito antes de cobrar.');
        let source: string | null = command.method === 'efectivo' ? 'cash' : null;
        if (['transferencia', 'deposito'].includes(command.method)) {
          if (!(company.cuentasBancarias || []).some((b: { id: string }) => b.id === command.bankId)) throw new CapitalError('Selecciona una cuenta bancaria registrada.');
          source = 'bank:' + command.bankId;
        }
        let rest = command.cents, totalInterest = 0, verified = true;
        const applied: Record<string, unknown>[] = [], updates: { ref: typeof loanRef; data: Record<string, unknown> }[] = [];
        for (const row of rows) {
          if (!rest) break;
          const q = row.data, total = amount(q.totalCuota), paid = amount(q.montoPagado || 0, true);
          if (paid > total || !Number.isSafeInteger(q.numeroCuota)) throw new CapitalError('Cuota inválida.');
          const take = Math.min(rest, total - paid); if (!take) continue;
          let split: { capital: number; interest: number } | null = null;
          try { split = verifiedSplit(amount(q.capital, true), amount(q.interes, true), total, paid, q.capitalCobradoCentavos, q.interesCobradoCentavos, take); }
          catch { verified = false; }
          const change: Record<string, unknown> = { montoPagado: dollars(paid + take), estado: paid + take === total ? 'pagada' : 'parcial', fechaPago: day, distribucionPendiente: !split };
          if (split) { change.capitalCobradoCentavos = add(q.capitalCobradoCentavos || 0, split.capital); change.interesCobradoCentavos = add(q.interesCobradoCentavos || 0, split.interest); totalInterest = add(totalInterest, split.interest); }
          updates.push({ ref: row.ref, data: change });
          applied.push({ cuotaId: row.id, numeroCuota: q.numeroCuota, montoAbonado: dollars(take), valorCuota: dollars(total), saldoAnterior: dollars(total - paid), saldoRestante: dollars(total - paid - take), capital: split ? dollars(split.capital) : null, interes: split ? dollars(split.interest) : null, verified: !!split });
          rest -= take;
        }
        if (rest) throw new CapitalError('No se pudo aplicar el cobro completo.');
        for (const update of updates) tx.update(update.ref, update.data);
        tx.update(loanRef, { saldoRestante: dollars(remaining - command.cents), estado: remaining === command.cents ? 'completado' : loan.estado });
        if (remaining === command.cents) tx.update(client.ref, { score: Math.min(100, (client.data()?.score ?? 50) + 10) });
        tx.create(db.collection('pagos').doc(opId), { ...meta, fecha: FieldValue.serverTimestamp(), prestamoId: command.loanId, clienteId: loan.clienteId, clienteNombre: loan.clienteNombre || '', monto: dollars(command.cents), montoCentavos: command.cents, interesCentavos: verified ? totalInterest : null, capitalCentavos: verified ? command.cents - totalInterest : null, allocationVerified: verified, allocationPolicy: 'proporcional-v1', metodo: command.method, cuentaDestino: source, observaciones: command.note, comprobanteUrl: command.proofUrl || null, cuotasAplicadas: applied, registradoPor: meta.actorName });
        if (verified && totalInterest > 0 && source) tx.create(base.collection('lots').doc(opId), { ...meta, receiptId: opId, loanId: command.loanId, source, interest: totalInterest, reserved: 0, spent: 0, restricted: 0 });
        delta.collected = verified && source ? totalInterest : 0;
        delta.unverifiedReceipts = verified ? 0 : 1;
        result = { id: opId, verified, interest: verified ? totalInterest : 0 };
      } else if (command.type === 'agreement') {
        if (!command.acknowledgedDebt || !command.beneficiary.trim() || command.beneficiary.length > 100 || !Number.isInteger(command.reserveBps) || command.reserveBps < 1 || command.reserveBps > 10000) throw new CapitalError('Confirma la obligación, beneficiario y porcentaje de reserva.');
        const injection = (company.inyeccionesCapital || []).find((i: { id: string }) => i.id === command.injectionId);
        const link = base.collection('injection_links').doc(safeId(command.injectionId));
        const [existingLink, contribution] = await Promise.all([tx.get(link), tx.get(base.collection('contributions').doc(command.injectionId))]);
        if (!injection || existingLink.exists || contribution.data()?.returned) throw new CapitalError('El aporte no existe, fue restituido o ya tiene un plan de devolución.');
        const principal = amount(injection.monto);
        if (command.firstDate < sourceDate(injection.fecha)) throw new CapitalError('El primer vencimiento no puede preceder al aporte recibido.');
        if (!['principal_only', 'includes_interest'].includes(command.mode) || (command.mode === 'principal_only' && command.cost !== 0)) throw new CapitalError('Indica correctamente si el plan incluye intereses del financiador.');
        const rows = schedule(principal, command.cost, command.monthly, command.firstDate);
        tx.create(base.collection('agreements').doc(opId), { ...meta, injectionId: command.injectionId, beneficiary: command.beneficiary.trim(), mode: command.mode, principal, financeCost: command.cost, total: add(principal, command.cost), monthly: command.monthly, firstDate: command.firstDate, reserveBps: command.reserveBps, paid: 0, principalPaid: 0, financeCostPaid: 0, reserved: 0, state: 'active' });
        for (const row of rows) tx.create(base.collection('installments').doc(opId + '_' + row.number), { ...row, agreementId: opId, paid: 0, reserved: 0, lastPayoutId: null });
        tx.create(link, { agreementId: opId, ...meta });
      } else if (command.type === 'reserve') {
        if (!command.lots.length || command.lots.length > 25 || new Set(command.lots.map(l => l.id)).size !== command.lots.length) throw new CapitalError('Selecciona entre 1 y 25 cobros diferentes.');
        const [agreementSnap, installmentSnap] = await Promise.all([tx.get(base.collection('agreements').doc(safeId(command.agreementId))), tx.get(base.collection('installments').doc(safeId(command.installmentId)))]);
        const agreement = agreementSnap.data(), installment = installmentSnap.data();
        if (!agreement || agreement.state !== 'active' || installment?.agreementId !== command.agreementId) throw new CapitalError('Plan o cuota no disponibles.');
        const lots = await Promise.all(command.lots.map(l => tx.get(base.collection('lots').doc(safeId(l.id)))));
        const claims = await Promise.all(command.lots.map(l => tx.get(base.collection('claims').doc(l.id + '_' + command.agreementId))));
        const total = sum(command.lots.map(l => positive(l.cents)));
        if (total > installment.total - installment.paid - installment.reserved) throw new CapitalError('La reserva supera lo pendiente de esta cuota.');
        if ((await recordedCash(tx, db, actor.empresaId, company, control)) - (control.reserved || 0) < total) throw new CapitalError('La caja registrada libre no cubre esta reserva; concilia los fondos.');
        for (let i = 0; i < lots.length; i++) {
          const lot = lots[i].data(), take = command.lots[i].cents, used = claims[i].data()?.used || 0;
          if (!lot || take > lot.interest - lot.reserved - lot.spent - lot.restricted || used + take > percentage(lot.interest, agreement.reserveBps)) throw new CapitalError('Intereses insuficientes, comprometidos o fuera del porcentaje permitido.');
        }
        for (let i = 0; i < lots.length; i++) {
          const lot = lots[i].data()!, take = command.lots[i].cents;
          tx.update(lots[i].ref, { reserved: add(lot.reserved, take) });
          tx.set(claims[i].ref, { lotId: lots[i].id, agreementId: command.agreementId, used: add(claims[i].data()?.used || 0, take) });
          tx.create(base.collection('reserves').doc(opId + '_' + i), { ...meta, availableFrom: day, agreementId: command.agreementId, installmentId: command.installmentId, lotId: lots[i].id, source: lot.source, amount: take, remaining: take });
        }
        tx.update(agreementSnap.ref, { reserved: add(agreement.reserved, total) });
        tx.update(installmentSnap.ref, { reserved: add(installment.reserved, total) }); delta.reserved = total;
      } else if (command.type === 'release') {
        const reserve = await tx.get(base.collection('reserves').doc(safeId(command.reserveId))), data = reserve.data();
        if (!data || data.remaining <= 0 || !command.reason.trim()) throw new CapitalError('Reserva sin saldo o motivo inválido.');
        const [lot, claim, agreement, installment] = await Promise.all([tx.get(base.collection('lots').doc(data.lotId)), tx.get(base.collection('claims').doc(data.lotId + '_' + data.agreementId)), tx.get(base.collection('agreements').doc(data.agreementId)), tx.get(base.collection('installments').doc(data.installmentId))]);
        tx.update(reserve.ref, { remaining: 0 }); tx.update(lot.ref, { reserved: lot.data()!.reserved - data.remaining });
        tx.update(claim.ref, { used: claim.data()!.used - data.remaining });
        tx.update(agreement.ref, { reserved: agreement.data()!.reserved - data.remaining }); tx.update(installment.ref, { reserved: installment.data()!.reserved - data.remaining });
        delta.reserved = -data.remaining;
      } else if (command.type === 'restrict' || command.type === 'unrestrict') {
        const restriction = command.type === 'unrestrict' ? await tx.get(base.collection('restrictions').doc(safeId(command.restrictionId))) : null;
        const data = restriction?.data();
        if (command.type === 'unrestrict' && (!data || data.released)) throw new CapitalError('El apartado ya fue liberado o no existe.');
        const lot = await tx.get(base.collection('lots').doc(safeId(command.type === 'restrict' ? command.lotId : data!.lotId))), l = lot.data();
        const take = command.type === 'restrict' ? positive(command.cents) : data!.amount;
        if (!l || !command.reason.trim() || (command.type === 'restrict' && take > l.interest - l.reserved - l.spent - l.restricted)) throw new CapitalError('Intereses insuficientes o motivo inválido.');
        const sign = command.type === 'restrict' ? 1 : -1;
        tx.update(lot.ref, { restricted: add(l.restricted, sign * take) });
        if (restriction) tx.update(restriction.ref, { released: true, releasedBy: opId });
        else tx.create(base.collection('restrictions').doc(opId), { ...meta, lotId: lot.id, amount: take, reason: command.reason, released: false });
        delta.restricted = sign * take;
      } else if (command.type === 'pay') {
        positive(command.cents);
        if (!command.confirmedCashAvailable || !validDate(command.date) || command.date > day || !command.reference.trim()) throw new CapitalError('Confirma disponibilidad de caja/banco, fecha y comprobante.');
        const [agreementSnap, installmentSnap, reserves] = await Promise.all([tx.get(base.collection('agreements').doc(safeId(command.agreementId))), tx.get(base.collection('installments').doc(safeId(command.installmentId))), tx.get(base.collection('reserves').where('installmentId', '==', command.installmentId))]);
        const agreement = agreementSnap.data(), installment = installmentSnap.data();
        if (!agreement || installment?.agreementId !== command.agreementId || command.cents > installment.total - installment.paid || command.cents > installment.reserved || reserves.size > 100) throw new CapitalError('Cuota sin reserva suficiente o fuera de límite.');
        const eligible = reserves.docs.filter(d => d.data().remaining > 0 && d.data().source === command.source).sort((a, b) => a.id.localeCompare(b.id));
        if (sum(eligible.map(d => d.data().remaining)) < command.cents || eligible.some(d => (d.data().availableFrom || d.data().date) > command.date)) throw new CapitalError('No hay reservas de esa caja/banco para la fecha indicada.');
        const lots = await Promise.all([...new Set(eligible.map(d => d.data().lotId))].map(id => tx.get(base.collection('lots').doc(id))));
        const cash = await recordedCash(tx, db, actor.empresaId, company, control);
        if (cash < Math.max(command.cents, control.reserved || 0)) throw new CapitalError('La caja registrada no alcanza. Concilia fondos antes de confirmar.');
        const interestPaid = share(installment.paid + command.cents, installment.financeCost, installment.total) - share(installment.paid, installment.financeCost, installment.total);
        let remaining = command.cents;
        const consumed: { reserveId: string; lotId: string; cents: number }[] = [], lotChanges = new Map<string, number>();
        for (const reserve of eligible) {
          const take = Math.min(remaining, reserve.data().remaining); if (!take) continue;
          consumed.push({ reserveId: reserve.id, lotId: reserve.data().lotId, cents: take });
          lotChanges.set(reserve.data().lotId, add(lotChanges.get(reserve.data().lotId) || 0, take));
          tx.update(reserve.ref, { remaining: reserve.data().remaining - take }); remaining -= take;
        }
        for (const lot of lots) { const take = lotChanges.get(lot.id) || 0; tx.update(lot.ref, { reserved: lot.data()!.reserved - take, spent: add(lot.data()!.spent, take) }); }
        tx.update(installmentSnap.ref, { paid: add(installment.paid, command.cents), reserved: installment.reserved - command.cents, lastPayoutId: opId });
        tx.update(agreementSnap.ref, { paid: add(agreement.paid, command.cents), principalPaid: add(agreement.principalPaid, command.cents - interestPaid), financeCostPaid: add(agreement.financeCostPaid, interestPaid), reserved: agreement.reserved - command.cents, state: agreement.paid + command.cents === agreement.total ? 'paid' : 'active' });
        tx.create(base.collection('payouts').doc(opId), { ...meta, date: command.date, agreementId: command.agreementId, installmentId: command.installmentId, amount: command.cents, principal: command.cents - interestPaid, financeCost: interestPaid, source: command.source, reference: command.reference.trim(), proofUrl: command.proofUrl || null, consumed, previousPayoutId: installment.lastPayoutId || null, reversed: false });
        delta.outflow = command.cents; delta.spent = command.cents; delta.reserved = -command.cents;
      } else if (command.type === 'reverse') {
        const payout = await tx.get(base.collection('payouts').doc(safeId(command.payoutId))), p = payout.data();
        if (!p || p.reversed || !command.confirmedReturned || !command.reason.trim() || !command.reference.trim() || !validDate(command.date) || command.date < p.date || command.date > day) throw new CapitalError('Confirma la restitución del dinero y un comprobante válido.');
        const [agreement, installment] = await Promise.all([tx.get(base.collection('agreements').doc(p.agreementId)), tx.get(base.collection('installments').doc(p.installmentId))]);
        if (installment.data()?.lastPayoutId !== payout.id) throw new CapitalError('Revierte primero el último pago de esta cuota.');
        const consumed = p.consumed as { reserveId: string; lotId: string; cents: number }[];
        const reserves = await Promise.all(consumed.map(c => tx.get(base.collection('reserves').doc(c.reserveId))));
        const lots = await Promise.all([...new Set(consumed.map(c => c.lotId))].map(id => tx.get(base.collection('lots').doc(id))));
        const changes = new Map<string, number>();
        consumed.forEach((c, i) => { tx.update(reserves[i].ref, { remaining: add(reserves[i].data()!.remaining, c.cents), availableFrom: command.date }); changes.set(c.lotId, add(changes.get(c.lotId) || 0, c.cents)); });
        for (const lot of lots) { const take = changes.get(lot.id)!; tx.update(lot.ref, { reserved: add(lot.data()!.reserved, take), spent: lot.data()!.spent - take }); }
        const a = agreement.data()!, i = installment.data()!;
        tx.update(agreement.ref, { paid: a.paid - p.amount, principalPaid: a.principalPaid - p.principal, financeCostPaid: a.financeCostPaid - p.financeCost, reserved: add(a.reserved, p.amount), state: 'active' });
        tx.update(installment.ref, { paid: i.paid - p.amount, reserved: add(i.reserved, p.amount), lastPayoutId: p.previousPayoutId });
        tx.update(payout.ref, { reversed: true, reversalId: opId });
        tx.create(base.collection('reversals').doc(opId), { ...meta, date: command.date, payoutId: payout.id, reason: command.reason, reference: command.reference, proofUrl: command.proofUrl || null, amount: p.amount });
        delta.outflow = -p.amount; delta.spent = -p.amount; delta.reserved = p.amount;
      }
      const next: Record<string, unknown> = { currency: 'USD', updatedAt: FieldValue.serverTimestamp() };
      for (const name of ['collected', 'reserved', 'spent', 'restricted', 'outflow', 'unverifiedReceipts']) {
        const value = add(control[name] || 0, delta[name] || 0);
        if (value < 0) throw new CapitalError('El control de fondos presenta una diferencia.'); next[name] = value;
      }
      if ((next.reserved as number) + (next.spent as number) + (next.restricted as number) > (next.collected as number)) throw new CapitalError('Los intereses no pueden asignarse dos veces.');
      tx.set(base, next, { merge: true });
      tx.create(operation, { ...meta, type: command.type, fingerprint, result, detail: command.type === 'receive' ? { receiptId: opId } : command });
      return { ...result, repeated: false };
    });
  };
}
