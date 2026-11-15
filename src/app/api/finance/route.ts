import { generateAmortizationTable } from "@/lib/amortization";
import { businessDate,isOverdue } from "@/lib/business-date";
import { generarCronogramaInversion } from "@/lib/calculadoraInversion";
import { financeSchema } from "@/lib/finance-schema";
import { adminDb } from "@/lib/firebase-admin";
import { cents,sumMoney } from "@/lib/money";
import { allocatePayment,type PayableInstallment } from "@/lib/payment-allocation";
import { collectors,managers } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { validateImageUrl } from "@/lib/safe-image";
import { ApiError,apiError,assertTenant,requireActor } from "@/lib/server-auth";
import { FieldValue,type DocumentData } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

async function chunkedBatchDelete(refs: FirebaseFirestore.DocumentReference[]) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
    const chunk = refs.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
  }
}

async function chunkedBatchUpdate(items: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[]) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();
    for (const item of chunk) batch.update(item.ref, item.data);
    await batch.commit();
  }
}

async function chunkedBatchCreate(items: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[]) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();
    for (const item of chunk) batch.create(item.ref, item.data);
    await batch.commit();
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, collectors);
    const data = financeSchema.parse(await request.json());
    if (data.action !== "payment" && !managers.includes(actor.rol)) throw new ApiError(403, "Esta operación requiere un administrador.");
    await rateLimit("finance:" + actor.uid, 120, 60_000);
    const now = new Date();
    const empresaRef = adminDb.collection("empresas").doc(actor.empresaId);
    const operationRef = adminDb.collection("financial_operations").doc(actor.uid + "_" + data.requestId);
    const fingerprint = createHash("sha256").update(JSON.stringify(data)).digest("hex");

    const deferredDeletes: FirebaseFirestore.DocumentReference[] = [];
    const deferredUpdates: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];
    const deferredCreates: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];

    const result = await adminDb.runTransaction(async tx => {
      const [previous, company] = await Promise.all([tx.get(operationRef), tx.get(empresaRef)]);
      if (previous.exists) {
        if (previous.data()!.fingerprint !== fingerprint) throw new ApiError(409, "La solicitud ya se utilizó con otros datos.");
        return previous.data()!.result;
      }
      if (company.data()?.estado !== "activa") throw new ApiError(403, "La empresa no está activa.");
      const today = businessDate(now, company.data()?.zonaHoraria);
      const get = async (collection: string, id: string) => {
        const ref = adminDb.collection(collection).doc(id), snap = await tx.get(ref);
        if (!snap.exists) throw new ApiError(404, "Registro no encontrado.");
        const record = snap.data()!;
        assertTenant(actor, record.empresaId);
        return { ref, record };
      };
      const audit = (id: string) => tx.create(adminDb.collection("auditoria").doc(), {
        empresaId: actor.empresaId, usuarioId: actor.uid, usuarioNombre: actor.nombre, accion: data.action,
        registroId: id, requestId: data.requestId, fecha: now,
        motivo: "motivo" in data ? data.motivo : "observaciones" in data ? data.observaciones : "",
      });
      const ledger = (id: string, amount: number, direction: "ingreso" | "egreso", kind: string, account: string, extra = {}) => {
        tx.create(adminDb.collection("movimientos_caja").doc(), { empresaId: actor.empresaId, origenId: id, monto: amount, direccion: direction, tipo: kind, cuenta: account, conciliado: false, fecha: now, fechaStr: today, registradoPor: actor.uid, ...extra });
      };
      let id = "";
      if (data.action === "score") {
        const client = await get("clientes", data.clienteId);
        id = client.ref.id;
        tx.update(client.ref, { score: data.score });
        tx.create(adminDb.collection("auditoria").doc(), { empresaId: actor.empresaId, accion: "score_anterior", registroId: id, anterior: client.record.score ?? 50, nuevo: data.score, motivo: data.motivo, usuarioId: actor.uid, fecha: now });
      } else if (data.action === "loan") {
        const { record: client, ref: clientRef } = await get("clientes", data.clienteId);
        if (data.fechaPrimerPago < data.fechaDesembolso) throw new ApiError(400, "El primer pago debe ser posterior o igual al desembolso.");
        let installments;
        try { installments = generateAmortizationTable(data); }
        catch { throw new ApiError(400, "Las condiciones no permiten generar cuotas válidas. Revisa monto, plazo y fechas."); }
        const ref = adminDb.collection("prestamos").doc(); id = ref.id;
        const conditions = { clienteId: data.clienteId, monto: data.monto, tasaInteres: data.tasaInteres, periodoTasa: data.periodoTasa, tipoInteres: data.tipoInteres, frecuenciaPago: data.frecuenciaPago, numeroCuotas: data.numeroCuotas, fechaDesembolso: data.fechaDesembolso, fechaPrimerPago: data.fechaPrimerPago };
        const total = sumMoney(installments.map(c => c.totalCuota));
        tx.create(ref, { ...conditions, empresaId: actor.empresaId, clienteNombre: `${client.nombres} ${client.apellidos}`, totalInteres: sumMoney(installments.map(c => c.interes)), totalPagar: total, saldoRestante: total, estado: "activo", convencionTasa: "nominal_comercial_30_dias_4_semanas", politicaAbono: "interes_primero_v1", createdAt: now });
        if (installments.length <= 350) {
          for (const cuota of installments) tx.create(adminDb.collection("cuotas").doc(), { ...cuota, empresaId: actor.empresaId, prestamoId: id, clienteId: data.clienteId, estado: isOverdue(cuota, today) ? "vencida" : "pendiente", montoPagado: 0 });
        } else {
          deferredCreates.push(...installments.map(cuota => ({
            ref: adminDb.collection("cuotas").doc(),
            data: { ...cuota, empresaId: actor.empresaId, prestamoId: id, clienteId: data.clienteId, estado: isOverdue(cuota, today) ? "vencida" : "pendiente", montoPagado: 0 }
          })));
        }
        if (client.estado === "nuevo") tx.update(clientRef, { estado: "activo" });
        ledger(id, data.monto, "egreso", "desembolso", "Caja General");
      } else if (data.action === "payment" || data.action === "investor_payment") {
        const investor = data.action === "investor_payment";
        const { ref, record } = await get(investor ? "inversion_contratos" : "prestamos", investor ? data.contratoId : data.prestamoId);
        if (["cancelado", "completado", "liquidado", "reestructurado"].includes(record.estado)) throw new ApiError(409, "El contrato no admite nuevos pagos.");
        const relation = investor ? "inversionContratoId" : "prestamoId";
        const cuotas = await tx.get(adminDb.collection(investor ? "cuotas_inversionistas" : "cuotas").where("empresaId", "==", actor.empresaId).where(relation, "==", ref.id));
        const all = cuotas.docs.map(d => ({ ...d.data(), id: d.id } as PayableInstallment));
        const selected = investor && data.cuotaId ? all.filter(c => c.id === data.cuotaId) : all;
        if (cents(data.monto) > cents(record[investor ? "saldoPendiente" : "saldoRestante"])) throw new ApiError(409, "El monto supera el saldo actual. Actualiza la pantalla.");
        let applied;
        try { applied = allocatePayment(selected, data.monto, today); }
        catch (error) { throw new ApiError(409, error instanceof Error ? error.message : "Abono inválido"); }
        const person = await get(investor ? "inversionistas" : "clientes", record[investor ? "inversionistaId" : "clienteId"]);
        if (!investor && ["transferencia", "deposito"].includes(data.metodo) && !company.data()?.cuentasBancarias?.some((a: { id: string }) => a.id === data.cuentaDestino)) throw new ApiError(400, "Selecciona una cuenta bancaria válida de tu empresa.");
        if (data.comprobanteUrl) {
          try { validateImageUrl(data.comprobanteUrl, actor.empresaId, process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ""); }
          catch { throw new ApiError(400, "Comprobante no válido para esta empresa."); }
        }
        const paymentRef = adminDb.collection(investor ? "pagos_inversionistas" : "pagos").doc(); id = paymentRef.id;
        for (const a of applied) tx.update(adminDb.collection(investor ? "cuotas_inversionistas" : "cuotas").doc(a.cuotaId), { montoPagado: a.montoPagado, estado: a.estado, ...(investor ? { saldoRestante: a.saldoRestante } : {}), fechaPago: now.toISOString() });
        const remaining = (cents(record[investor ? "saldoPendiente" : "saldoRestante"]) - cents(data.monto)) / 100;
        const paidById = new Map(applied.map(a => [a.cuotaId, a.montoPagado]));
        const overdue = all.some(c => isOverdue({ ...c, montoPagado: paidById.get(c.id) ?? c.montoPagado }, today));
        const sequence = (record.paymentSequence || 0) + 1;
        tx.update(ref, investor ? { paymentSequence: sequence, saldoPendiente: remaining, totalPagado: (cents(record.totalPagado || 0) + cents(data.monto)) / 100, estado: remaining === 0 ? "liquidado" : "activo" } : { paymentSequence: sequence, saldoRestante: remaining, estado: remaining === 0 ? "completado" : overdue ? "moroso" : "activo" });
        if (investor) tx.update(person.ref, { totalPagado: FieldValue.increment(data.monto), saldoPendiente: FieldValue.increment(-data.monto) });
        else if (remaining === 0) tx.update(person.ref, { score: Math.min(100, (person.record.score ?? 50) + 10) });
        const payment: DocumentData = { empresaId: actor.empresaId, [relation]: ref.id, monto: data.monto, metodo: data.metodo, observaciones: data.observaciones, comprobanteUrl: data.comprobanteUrl || null, cuotasAplicadas: applied, montoCapital: sumMoney(applied.map(a => a.capital)), montoInteres: sumMoney(applied.map(a => a.interes)), desgloseVersion: 1, fecha: now, fechaStr: today, registradoPor: actor.nombre, usuarioId: actor.uid, anulado: false };
        payment.secuencia = sequence;
        if (investor) Object.assign(payment, { inversionistaId: record.inversionistaId, inversionistaNombre: record.inversionistaNombre, inversionContratoId: ref.id, cuotaInversionistaId: data.cuotaId || null, numeroCuota: applied.length === 1 ? applied[0].numeroCuota : null, cuentaOrigen: data.cuentaOrigen });
        else Object.assign(payment, { clienteId: record.clienteId, clienteNombre: record.clienteNombre, cuentaDestino: data.cuentaDestino || null, scoreIncrementado: remaining === 0 ? Math.min(10, 100 - (person.record.score ?? 50)) : 0 });
        tx.create(paymentRef, payment);
        ledger(id, data.monto, investor ? "egreso" : "ingreso", investor ? "pago_inversionista" : "cobro", investor ? data.cuentaOrigen : data.cuentaDestino || "Caja General");
      } else if (data.action === "investment") {
        const person = await get("inversionistas", data.inversionistaId);
        if (person.record.estado !== "activo") throw new ApiError(409, "El inversionista está inactivo.");
        if (cents(data.montoCartera) + cents(data.montoOtros) !== cents(data.montoTotal) || data.fechaPrimerPago < data.fechaInicio) throw new ApiError(400, "Distribución de fondos o fechas inválidas.");
        let schedule;
        try { schedule = generarCronogramaInversion(data); }
        catch { throw new ApiError(400, "Las condiciones de la inversión no generan un cronograma válido."); }
        const ref = adminDb.collection("inversion_contratos").doc(); id = ref.id;
        const conditions = { inversionistaId: data.inversionistaId, montoTotal: data.montoTotal, montoCartera: data.montoCartera, montoOtros: data.montoOtros, tieneInteres: data.tieneInteres, tasaInteresMensual: data.tasaInteresMensual, modalidadPago: data.modalidadPago, plazoMeses: data.plazoMeses, fechaInicio: data.fechaInicio, fechaPrimerPago: data.fechaPrimerPago, observaciones: data.observaciones };
        tx.create(ref, { ...conditions, empresaId: actor.empresaId, inversionistaNombre: `${person.record.nombres} ${person.record.apellidos || ""}`.trim(), totalInteresPagar: schedule.totalInteres, totalPagar: schedule.totalPagar, totalPagado: 0, saldoPendiente: schedule.totalPagar, estado: "activo", createdAt: now });
        if (schedule.cuotas.length <= 350) {
          for (const c of schedule.cuotas) tx.create(adminDb.collection("cuotas_inversionistas").doc(), { ...c, empresaId: actor.empresaId, inversionContratoId: id, inversionistaId: data.inversionistaId, montoPagado: 0, saldoRestante: c.totalCuota, estado: "pendiente" });
        } else {
          deferredCreates.push(...schedule.cuotas.map(c => ({
            ref: adminDb.collection("cuotas_inversionistas").doc(),
            data: { ...c, empresaId: actor.empresaId, inversionContratoId: id, inversionistaId: data.inversionistaId, montoPagado: 0, saldoRestante: c.totalCuota, estado: "pendiente" }
          })));
        }
        tx.update(person.ref, { totalInvertido: FieldValue.increment(data.montoTotal), saldoPendiente: FieldValue.increment(schedule.totalPagar) });
        ledger(id, data.montoTotal, "ingreso", "fondeo", "Caja General");
      } else if (data.action === "reverse_payment") {
        const payment = await get("pagos", data.pagoId);
        if (payment.record.anulado) throw new ApiError(409, "El pago ya está anulado.");
        const loan = await get("prestamos", payment.record.prestamoId);
        const client = await get("clientes", payment.record.clienteId);
        const cuotas = await tx.get(adminDb.collection("cuotas").where("empresaId", "==", actor.empresaId).where("prestamoId", "==", loan.ref.id));
        const laterPayments = await tx.get(adminDb.collection("pagos").where("empresaId", "==", actor.empresaId).where("prestamoId", "==", loan.ref.id));
        if (!payment.record.secuencia || laterPayments.docs.some(p => !p.data().anulado && p.data().secuencia > payment.record.secuencia)) throw new ApiError(409, "Anula primero los pagos posteriores para conservar el reparto de intereses.");
        const current = new Map(cuotas.docs.map(d => [d.id, d]));
        const reversed = new Map<string, number>();
        for (const a of payment.record.cuotasAplicadas) {
          const doc = current.get(a.cuotaId), c = doc?.data();
          if (!doc || !c || cents(c.montoPagado) < cents(a.montoAbonado)) throw new ApiError(409, "Las cuotas requieren conciliación antes de revertir.");
          const paid = (cents(c.montoPagado) - cents(a.montoAbonado)) / 100;
          reversed.set(doc.id, paid);
          tx.update(doc.ref, { montoPagado: paid, estado: isOverdue({ ...c, fechaVencimiento: c.fechaVencimiento, totalCuota: c.totalCuota, montoPagado: paid }, today) ? "vencida" : paid > 0 ? "parcial" : "pendiente" });
        }
        const overdue = cuotas.docs.some(d => isOverdue({ ...d.data(), fechaVencimiento: d.data().fechaVencimiento, totalCuota: d.data().totalCuota, montoPagado: reversed.get(d.id) ?? d.data().montoPagado }, today));
        tx.update(loan.ref, { saldoRestante: (cents(loan.record.saldoRestante) + cents(payment.record.monto)) / 100, estado: overdue ? "moroso" : "activo" });
        tx.update(payment.ref, { anulado: true, anuladoPor: actor.uid, motivoAnulacion: data.motivo, fechaAnulacion: now });
        if (payment.record.scoreIncrementado) tx.update(client.ref, { score: Math.max(0, (client.record.score ?? 50) - payment.record.scoreIncrementado) });
        id = payment.ref.id;
        ledger(id, payment.record.monto, "egreso", "reversion_cobro", payment.record.cuentaDestino || "Caja General");
      } else if (data.action === "cancel_loan") {
        const loan = await get("prestamos", data.prestamoId);
        if (loan.record.estado === "cancelado") throw new ApiError(409, "El préstamo ya está anulado.");
        const payments = await tx.get(adminDb.collection("pagos").where("empresaId", "==", actor.empresaId).where("prestamoId", "==", loan.ref.id));
        if (payments.docs.some(d => !d.data().anulado)) throw new ApiError(409, "Anula y concilia los cobros antes de anular el crédito.");
        const cuotas = await tx.get(adminDb.collection("cuotas").where("empresaId", "==", actor.empresaId).where("prestamoId", "==", loan.ref.id));
        tx.update(loan.ref, { estado: "cancelado", saldoRestante: 0, anuladoPor: actor.uid, motivoAnulacion: data.motivo, fechaAnulacion: now });
        if (cuotas.docs.length <= 350) {
          for (const c of cuotas.docs) tx.update(c.ref, { estado: "anulada" });
        } else {
          deferredUpdates.push(...cuotas.docs.map(c => ({ ref: c.ref, data: { estado: "anulada" } })));
        }
        id = loan.ref.id;
        ledger(id, loan.record.monto, "ingreso", "reversion_desembolso", "Caja General");
      } else if (data.action === "delete_loan") {
        if (!managers.includes(actor.rol)) throw new ApiError(403, "Solo el dueño o administrador puede eliminar créditos.");
        const loan = await get("prestamos", data.prestamoId);
        const client = await get("clientes", loan.record.clienteId);
        const cuotas = await tx.get(adminDb.collection("cuotas").where("empresaId", "==", actor.empresaId).where("prestamoId", "==", loan.ref.id));
        const payments = await tx.get(adminDb.collection("pagos").where("empresaId", "==", actor.empresaId).where("prestamoId", "==", loan.ref.id));
        const childRefs = [...cuotas.docs.map(d => d.ref), ...payments.docs.map(d => d.ref)];
        if (childRefs.length <= 350) {
          for (const r of childRefs) tx.delete(r);
        } else {
          deferredDeletes.push(...childRefs);
        }
        tx.delete(loan.ref);
        const otherLoans = await tx.get(adminDb.collection("prestamos").where("empresaId", "==", actor.empresaId).where("clienteId", "==", client.ref.id));
        const remaining = otherLoans.docs.filter(d => d.id !== loan.ref.id);
        if (remaining.length === 0) {
          tx.update(client.ref, { estado: "nuevo" });
        }
        id = loan.ref.id;
        if (loan.record.estado !== "cancelado") {
          ledger(id, loan.record.monto, "ingreso", "reversion_desembolso", "Caja General", { motivo: `Eliminación de crédito erróneo: ${data.motivo}` });
        }
      } else if (data.action === "refinance_loan") {
        if (!managers.includes(actor.rol)) throw new ApiError(403, "Solo el dueño o administrador puede reestructurar créditos.");
        const oldLoan = await get("prestamos", data.prestamoId);
        if (["cancelado", "completado", "reestructurado"].includes(oldLoan.record.estado)) {
          throw new ApiError(409, "Solo se pueden reestructurar créditos activos o en mora.");
        }
        let installments;
        try {
          installments = generateAmortizationTable({
            monto: data.nuevoMonto,
            tasaInteres: data.tasaInteres,
            periodoTasa: data.periodoTasa,
            tipoInteres: data.tipoInteres,
            frecuenciaPago: data.frecuenciaPago,
            numeroCuotas: data.numeroCuotas,
            fechaPrimerPago: data.fechaPrimerPago,
          });
        } catch {
          throw new ApiError(400, "Las condiciones de reestructuración no permiten generar cuotas válidas.");
        }
        const newLoanRef = adminDb.collection("prestamos").doc();
        id = newLoanRef.id;
        const total = sumMoney(installments.map(c => c.totalCuota));

        tx.update(oldLoan.ref, {
          estado: "reestructurado",
          saldoRestante: 0,
          reestructuradoPor: actor.uid,
          fechaReestructuracion: now,
          motivoReestructuracion: data.motivo,
          nuevoPrestamoId: id,
        });

        const oldCuotas = await tx.get(adminDb.collection("cuotas").where("empresaId", "==", actor.empresaId).where("prestamoId", "==", oldLoan.ref.id));
        const pendingOld = oldCuotas.docs.filter(c => c.data().estado !== "pagada");
        if (pendingOld.length <= 150) {
          for (const c of pendingOld) tx.update(c.ref, { estado: "reestructurada" });
        } else {
          deferredUpdates.push(...pendingOld.map(c => ({ ref: c.ref, data: { estado: "reestructurada" } })));
        }

        const newConditions = {
          clienteId: oldLoan.record.clienteId,
          monto: data.nuevoMonto,
          tasaInteres: data.tasaInteres,
          periodoTasa: data.periodoTasa,
          tipoInteres: data.tipoInteres,
          frecuenciaPago: data.frecuenciaPago,
          numeroCuotas: data.numeroCuotas,
          fechaDesembolso: today,
          fechaPrimerPago: data.fechaPrimerPago,
        };
        tx.create(newLoanRef, {
          ...newConditions,
          empresaId: actor.empresaId,
          clienteNombre: oldLoan.record.clienteNombre,
          totalInteres: sumMoney(installments.map(c => c.interes)),
          totalPagar: total,
          saldoRestante: total,
          estado: "activo",
          esReestructuracion: true,
          prestamoOrigenId: oldLoan.ref.id,
          convencionTasa: "nominal_comercial_30_dias_4_semanas",
          politicaAbono: "interes_primero_v1",
          createdAt: now,
        });

        if (installments.length <= 150) {
          for (const cuota of installments) {
            tx.create(adminDb.collection("cuotas").doc(), {
              ...cuota,
              empresaId: actor.empresaId,
              prestamoId: id,
              clienteId: oldLoan.record.clienteId,
              estado: isOverdue(cuota, today) ? "vencida" : "pendiente",
              montoPagado: 0,
            });
          }
        } else {
          deferredCreates.push(...installments.map(cuota => ({
            ref: adminDb.collection("cuotas").doc(),
            data: {
              ...cuota,
              empresaId: actor.empresaId,
              prestamoId: id,
              clienteId: oldLoan.record.clienteId,
              estado: isOverdue(cuota, today) ? "vencida" : "pendiente",
              montoPagado: 0,
            },
          })));
        }

        ledger(id, data.nuevoMonto, "egreso", "reestructuracion", "Caja General", {
          prestamoOrigenId: oldLoan.ref.id,
          noAfectaSaldoReal: true,
          motivo: `Reestructuración de crédito #${oldLoan.ref.id.slice(-6)}: ${data.motivo}`,
        });
      } else if (data.action === "capital" || data.action === "reverse_capital") {
        const companyData = company.data()!;
        const injections: DocumentData[] = companyData.inyeccionesCapital || [], log: DocumentData[] = companyData.bitacoraCapital || [];
        id = data.requestId;
        let amount = 0;
        if (data.action === "capital") {
          amount = data.monto;
          injections.push({ id, monto: data.monto, observaciones: data.motivo, fecha: now.toISOString(), registradoPor: actor.nombre });
        } else {
          const item = injections.find(x => x.id === data.inyeccionId);
          if (!item || item.revertida) throw new ApiError(409, "Aporte no disponible para reversión.");
          amount = -item.monto; item.revertida = true;
        }
        log.unshift({ id, tipo: data.action === "capital" ? "inyeccion" : "reversion", monto: amount, fecha: now.toISOString(), motivo: data.motivo, registradoPor: actor.nombre, usuarioRol: actor.rol, inyeccionIdRef: data.action === "capital" ? id : data.inyeccionId });
        tx.update(empresaRef, { inyeccionesCapital: injections, bitacoraCapital: log });
        ledger(id, Math.abs(amount), amount > 0 ? "ingreso" : "egreso", "aporte_capital", "Caja General");
      } else if (data.action === "cash") {
        const accounts = ["Caja General", ...(company.data()?.cuentasBancarias || []).map((a: { id: string }) => a.id)];
        if (!accounts.includes(data.cuentaOrigen) || (data.tipo === "transferencia" && !accounts.includes(data.cuentaDestino))) throw new ApiError(400, "Cuenta bancaria no válida para esta empresa.");
        if (data.tipo === "transferencia" && (!data.cuentaDestino || data.cuentaDestino === data.cuentaOrigen)) throw new ApiError(400, "Indica una cuenta destino diferente.");
        id = data.requestId;
        ledger(id, data.monto, data.tipo === "ingreso" ? "ingreso" : "egreso", data.tipo, data.cuentaOrigen, { motivo: data.motivo, referencia: data.referencia });
        if (data.tipo === "transferencia") ledger(id, data.monto, "ingreso", data.tipo, data.cuentaDestino!, { motivo: data.motivo, referencia: data.referencia });
      } else if (data.action === "reconcile") {
        const movement = await get("movimientos_caja", data.movimientoId);
        if (movement.record.conciliado) throw new ApiError(409, "El movimiento ya fue conciliado.");
        id = movement.ref.id;
        tx.update(movement.ref, { conciliado: true, referencia: data.referencia, conciliadoPor: actor.uid, fechaConciliacion: now });
      }
      tx.update(empresaRef, { financialRevision: FieldValue.increment(1) });
      audit(id);
      const response = { success: true, id };
      tx.create(operationRef, { empresaId: actor.empresaId, fingerprint, result: response, fecha: now });
      return response;
    });

    if (deferredDeletes.length > 0) await chunkedBatchDelete(deferredDeletes);
    if (deferredUpdates.length > 0) await chunkedBatchUpdate(deferredUpdates);
    if (deferredCreates.length > 0) await chunkedBatchCreate(deferredCreates);

    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
