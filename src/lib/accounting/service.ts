import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { available, exactSum, LedgerError, reverseLines, validateLines, validDate, type Line } from './core';

export type LedgerActor = { uid: string; empresaId: string };
export type Command = {
  key: string; date: string; description: string;
} & (
  | { type: 'open'; clientId: string }
  | { type: 'journal'; lines: Line[]; source: string }
  | { type: 'deposit' | 'withdraw'; savingsId: string; amount: number; cash: '1101' | '1102' }
  | { type: 'transfer'; savingsId: string; targetId: string; amount: number }
  | { type: 'hold'; savingsId: string; amount: number }
  | { type: 'release'; holdId: string }
  | { type: 'reverse'; entryId: string }
  | { type: 'close' }
);
function id(value: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new LedgerError('Identificador inválido.');
  return value;
}
function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function ledgerService(db: Firestore) {
  return async (actor: LedgerActor, command: Command) => {
    id(actor.empresaId); id(actor.uid); id(command.key);
    if (!validDate(command.date) || !command.description?.trim() || command.description.length > 240) throw new LedgerError('Fecha o descripción inválida.');
    if (command.date > new Date().toISOString().slice(0, 10)) throw new LedgerError('No se admiten fechas futuras.');
    if ('amount' in command && (!Number.isSafeInteger(command.amount) || command.amount <= 0)) throw new LedgerError('Importe inválido en centavos.');
    const base = db.collection('accounting').doc(actor.empresaId);
    const operationId = digest([actor.empresaId, command.key]);
    const operationRef = base.collection('operations').doc(operationId);
    const fingerprint = digest(command);
    return db.runTransaction(async tx => {
      const [config, previous] = await Promise.all([tx.get(base), tx.get(operationRef)]);
      const cfg = config.data();
      if (!cfg?.enabled || cfg.openingReconciled !== true || typeof cfg.openingApprovedBy !== 'string' || !cfg.openingApprovedBy.trim() || cfg.currency !== 'USD' || cfg.version !== 1 || !validDate(cfg.startDate)) throw new LedgerError('La contabilidad está en preparación; falta una apertura conciliada y autorizada.');
      if (previous.exists) {
        if (previous.data()?.fingerprint !== fingerprint) throw new LedgerError('La referencia ya se usó con otros datos.');
        return { id: operationId, repeated: true };
      }
      if (command.date < cfg.startDate || (cfg.closedThrough && command.date <= cfg.closedThrough)) throw new LedgerError('La fecha está fuera del período abierto.');
      if (cfg.lastPostedDate && command.date < cfg.lastPostedDate) throw new LedgerError('Registra las operaciones en orden cronológico; no se permite alterar saldos históricos.');
      // Read company/profile within the same transaction, so a concurrent suspension revokes writes.
      const [company, profile] = await Promise.all([tx.get(db.collection('empresas').doc(actor.empresaId)), tx.get(db.collection('usuarios').doc(actor.uid))]);
      const user = profile.data();
      if (company.data()?.estado !== 'activa' || !user || user.empresaId !== actor.empresaId || (user.activo !== undefined && user.activo !== true) || !['dueño', 'admin', 'superadmin'].includes(user.rol)) throw new LedgerError('El operador o la financiera no están habilitados.');
      const meta = { empresaId: actor.empresaId, currency: 'USD', date: command.date, description: command.description.trim(), actor: actor.uid, createdAt: FieldValue.serverTimestamp() };
      if (command.type === 'close') {
        const [balances, accounts] = await Promise.all([tx.get(base.collection('balances')), tx.get(base.collection('savings'))]);
        const net = balances.docs.reduce((sum, d) => exactSum(sum, d.data().net), 0);
        const liability = balances.docs.find(d => d.id === '2101')?.data()?.net || 0;
        const totalSavings = accounts.docs.reduce((sum, d) => { const a = d.data(); available(a.balance, a.held); return exactSum(sum, a.balance); }, 0);
        if (net !== 0 || totalSavings !== -liability) throw new LedgerError('La conciliación presenta diferencias. No se puede cerrar.');
        tx.create(base.collection('closes').doc(command.date), { ...meta, totalSavings, net, balances: balances.docs.map(d => ({ account: d.id, net: d.data().net })) });
        tx.update(base, { closedThrough: command.date });
        tx.create(operationRef, { ...meta, fingerprint, type: command.type });
        return { id: operationId, repeated: false };
      }
      if (command.type === 'open') {
        const client = await tx.get(db.collection('clientes').doc(id(command.clientId)));
        if (client.data()?.empresaId !== actor.empresaId) throw new LedgerError('El cliente no pertenece a esta financiera.');
        const accountRef = base.collection('savings').doc(operationId);
        tx.create(accountRef, { ...meta, clientId: command.clientId, state: 'active', balance: 0, held: 0 });
        tx.create(operationRef, { ...meta, fingerprint, type: command.type });
        return { id: operationId, repeated: false };
      }
      if (command.type === 'hold' || command.type === 'release') {
        const holdRef = base.collection('holds').doc(command.type === 'release' ? id(command.holdId) : operationId);
        const hold = command.type === 'release' ? await tx.get(holdRef) : null;
        if (command.type === 'release' && (!hold?.exists || hold.data()?.state !== 'active')) throw new LedgerError('El bloqueo no está activo.');
        const savingsId = command.type === 'hold' ? command.savingsId : hold!.data()!.savingsId;
        const accountRef = base.collection('savings').doc(id(savingsId));
        const snap = await tx.get(accountRef); const account = snap.data();
        if (!account || account.state !== 'active' || account.currency !== 'USD') throw new LedgerError('Cuenta no disponible.');
        const amount = command.type === 'hold' ? command.amount : hold!.data()!.amount;
        const nextHeld = exactSum(account.held, command.type === 'hold' ? amount : -amount);
        available(account.balance, nextHeld);
        tx.update(accountRef, { held: nextHeld });
        if (command.type === 'hold') tx.create(holdRef, { ...meta, savingsId, amount, state: 'active' });
        else tx.update(holdRef, { state: 'released', releasedBy: actor.uid, releaseOperation: operationId });
        tx.create(operationRef, { ...meta, fingerprint, type: command.type });
        return { id: operationId, repeated: false };
      }
      let lines: Line[]; let reversal: string | null = null;
      if (command.type === 'reverse') {
        const originalRef = base.collection('entries').doc(id(command.entryId));
        const [original, reversed] = await Promise.all([tx.get(originalRef), tx.get(base.collection('reversals').doc(command.entryId))]);
        if (!original.exists || reversed.exists || original.data()?.reverses) throw new LedgerError('El asiento no puede revertirse o ya fue revertido.');
        if (command.date < original.data()!.date) throw new LedgerError('El reverso no puede preceder al asiento original.');
        lines = reverseLines(original.data()!.lines); reversal = command.entryId;
      } else if (command.type === 'journal') {
        if (!command.source?.trim() || command.source.length > 160 || command.lines.some(l => l.account === '2101')) throw new LedgerError('Indica la referencia de origen; los ahorros se registran mediante su operación específica.');
        lines = command.lines;
      } else if (command.type === 'transfer') {
        if (command.savingsId === command.targetId) throw new LedgerError('Selecciona dos cuentas diferentes.');
        lines = [{ account: '2101', savingsId: command.savingsId, debit: command.amount, credit: 0 }, { account: '2101', savingsId: command.targetId, debit: 0, credit: command.amount }];
      } else {
        if (!['1101', '1102'].includes(command.cash)) throw new LedgerError('Selecciona caja o bancos.');
        const deposit = command.type === 'deposit';
        lines = [{ account: command.cash, debit: deposit ? command.amount : 0, credit: deposit ? 0 : command.amount }, { account: '2101', savingsId: command.savingsId, debit: deposit ? 0 : command.amount, credit: deposit ? command.amount : 0 }];
      }
      const totals = validateLines(lines);
      const savingsDelta = new Map<string, number>(); const glDelta = new Map<string, number>();
      for (const line of lines) {
        glDelta.set(line.account, exactSum(glDelta.get(line.account) || 0, line.debit - line.credit));
        if (line.savingsId) { id(line.savingsId); savingsDelta.set(line.savingsId, exactSum(savingsDelta.get(line.savingsId) || 0, line.credit - line.debit)); }
      }
      const savings = await Promise.all([...savingsDelta.keys()].map(key => tx.get(base.collection('savings').doc(key))));
      const balances = await Promise.all([...glDelta.keys()].map(key => tx.get(base.collection('balances').doc(key))));
      const savingsUpdates = savings.map(snap => {
        const data = snap.data();
        if (!data || data.state !== 'active' || data.currency !== 'USD') throw new LedgerError('Cuenta de ahorro no disponible en esta financiera.');
        const balance = exactSum(data.balance, savingsDelta.get(snap.id)!); available(balance, data.held);
        return { ref: snap.ref, balance };
      });
      const balanceUpdates = balances.map(snap => ({ ref: snap.ref, code: snap.id, net: exactSum(snap.data()?.net || 0, glDelta.get(snap.id)!) }));
      if (balanceUpdates.some(b => ['1101', '1102'].includes(b.code) && b.net < 0)) throw new LedgerError('Caja o banco no tiene fondos suficientes.');
      for (const update of savingsUpdates) tx.update(update.ref, { balance: update.balance });
      for (const update of balanceUpdates) tx.set(update.ref, { net: update.net, currency: 'USD' });
      tx.create(base.collection('entries').doc(operationId), { ...meta, lines, totals, reverses: reversal, source: command.type === 'journal' ? command.source : command.type });
      if (reversal) tx.create(base.collection('reversals').doc(reversal), { entryId: operationId, ...meta });
      tx.create(operationRef, { ...meta, fingerprint, type: command.type });
      tx.update(base, { lastPostedDate: command.date });
      return { id: operationId, repeated: false };
    });
  };
}
