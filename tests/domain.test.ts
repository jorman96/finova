import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAmortizationTable, installmentDate } from "../src/lib/amortization";
import { generarCronogramaInversion } from "../src/lib/calculadoraInversion";
import { cents, splitPayment } from "../src/lib/money";
import { businessDate, isOverdue, daysOverdue } from "../src/lib/business-date";
import { allocatePayment } from "../src/lib/payment-allocation";
import { canAssignRole, canAccessPage } from "../src/lib/permissions";
import { exactCollectedInterest } from "../src/lib/dashboard-metrics";
import { validateImageUrl } from "../src/lib/safe-image";
const base = { monto: 100, tasaInteres: 0, numeroCuotas: 3, tipoInteres: "fijo" as const, frecuenciaPago: "mensual" as const, fechaPrimerPago: "2026-01-31" };
test("principal reconciles to the cent for both loan systems and all frequencies", () => {
  for (const tipoInteres of ["fijo", "saldo_deudor"] as const) for (const frecuenciaPago of ["diario", "semanal", "quincenal", "mensual"] as const) {
    for (const monto of [100, 1234.56, 10000.01]) for (const numeroCuotas of [3, 7, 12, 36]) {
      const rows = generateAmortizationTable({ ...base, monto, numeroCuotas, tipoInteres, frecuenciaPago, tasaInteres: 2 });
      assert.equal(rows.reduce((s, c) => s + cents(c.capital), 0), cents(monto));
      assert.equal(rows.at(-1)!.saldoPendiente, 0);
      rows.forEach(c => assert.equal(cents(c.totalCuota), cents(c.capital) + cents(c.interes)));
    }
  }
});
test("end of month is anchored and leap dates are supported", () => {
  assert.equal(installmentDate("2026-01-31", "mensual", 1), "2026-02-28");
  assert.equal(installmentDate("2026-01-31", "mensual", 2), "2026-03-31");
  assert.equal(installmentDate("2024-01-31", "mensual", 1), "2024-02-29");
  assert.throws(() => installmentDate("2026-02-30", "mensual", 0));
});
test("invalid loans are rejected instead of creating empty or nonfinite schedules", () => {
  for (const changes of [{ numeroCuotas: 0 }, { numeroCuotas: 1.5 }, { monto: NaN }, { monto: -1 }, { tasaInteres: -2 }]) assert.throws(() => generateAmortizationTable({ ...base, ...changes }));
});
test("partial payments never count the whole installment interest twice", () => {
  const a = splitPayment(90, 10, 0, 5), b = splitPayment(90, 10, 5, 25), c = splitPayment(90, 10, 30, 70);
  assert.equal(a.interes + b.interes + c.interes, 10);
  assert.equal(a.capital + b.capital + c.capital, 90);
  assert.throws(() => splitPayment(90, 10, 90, 11));
});
test("payments apply in order; overdue partial payments remain overdue", () => {
  const rows = [2, 1].map(n => ({ id: String(n), numeroCuota: n, capital: 90, interes: 10, totalCuota: 100, montoPagado: 0, estado: "pendiente", fechaVencimiento: "2026-01-01" }));
  const result = allocatePayment(rows, 120, "2026-01-02");
  assert.deepEqual(result.map(r => [r.cuotaId, r.montoAbonado, r.estado]), [["1", 100, "pagada"], ["2", 20, "vencida"]]);
  assert.throws(() => allocatePayment(rows, 201, "2026-01-02"));
});
test("mora follows the business date, not UTC midnight", () => {
  assert.equal(businessDate(new Date("2026-10-15T02:00:00Z")), "2026-10-14");
  const c = { fechaVencimiento: "2026-10-14", totalCuota: 100, montoPagado: 10, estado: "parcial" };
  assert.equal(isOverdue(c, "2026-10-14"), false);
  assert.equal(isOverdue(c, "2026-10-15"), true);
  assert.equal(isOverdue({ ...c, estado: "anulada" }, "2026-10-15"), false);
  assert.equal(daysOverdue("2026-10-14", "2026-10-15"), 1);
});
test("all investor schedules return the exact principal", () => {
  for (const modalidadPago of ["interes_mensual_capital_al_vencimiento", "cuota_amortizada_mensual", "devolucion_capital_en_cuotas"] as const) {
    const s = generarCronogramaInversion({ montoTotal: 100, tasaInteresMensual: 2, tieneInteres: true, plazoMeses: 3, fechaPrimerPago: "2026-01-31", modalidadPago });
    assert.equal(s.totalCapital, 100);
    assert.equal(s.cuotas[2].fechaVencimiento, "2026-03-31");
  }
  const tiny = generarCronogramaInversion({ montoTotal: 1.23, tasaInteresMensual: 0, tieneInteres: false, plazoMeses: 70, fechaPrimerPago: "2026-01-31", modalidadPago: "devolucion_capital_en_cuotas" });
  assert.equal(tiny.totalCapital, 1.23);
  assert.ok(tiny.cuotas.every(c => c.capital >= 0));
});
test("owners cannot grant platform access; cashiers cannot access management pages", () => {
  assert.equal(canAssignRole("dueño", "superadmin"), false);
  assert.equal(canAssignRole("dueño", "dueño"), false);
  assert.equal(canAssignRole("dueño", "cajero"), true);
  assert.equal(canAssignRole("cajero", "admin"), false);
  assert.equal(canAccessPage("cajero", "/master/migration"), false);
  assert.equal(canAccessPage("consulta", "/inversionistas"), false);
});
test("legacy interest is marked unknown; voided payments never inflate income", () => {
  assert.deepEqual(exactCollectedInterest([{ desgloseVersion: 1, montoInteres: 5 }, { cuotasAplicadas: [{ interes: 10 }] }, { desgloseVersion: 1, montoInteres: 20, anulado: true }]), { amount: 5, missing: 1 });
});
test("image proxy accepts only tenant storage and rejects redirects to arbitrary hosts", () => {
  assert.ok(validateImageUrl("https://firebasestorage.googleapis.com/v0/b/test/o/empresas%2Fa%2Flogo.png?alt=media", "a", "test"));
  for (const url of ["http://127.0.0.1/internal", "https://example.org/a.png", "https://firebasestorage.googleapis.com/v0/b/test/o/empresas%2Fb%2Flogo.png", "https://firebasestorage.googleapis.com.evil.test/a.png"]) assert.throws(() => validateImageUrl(url, "a", "test"));
});

import { matchesClient } from "../src/lib/client-search";
import { financeSchema } from "../src/lib/finance-schema";
test("client search matches accents, mixed names, document and empty queries", () => {
  const c = { nombres: "José María", apellidos: "Pérez López", cedula: "0912345678" };
  for (const q of ["jose", "PEREZ", "lopez jose", "09123", "   ", "maría pérez"]) assert.equal(matchesClient(c,q), true);
  assert.equal(matchesClient(c,"Ana"), false);
  assert.equal(matchesClient({},"ana"), false);
});
test("delete_loan schema validates uuid, loan id and reason length", () => {
  const valid = {
    action: "delete_loan",
    requestId: "a0000000-0000-4000-8000-000000000001",
    prestamoId: "loan_12345",
    motivo: "Crédito creado con cliente erróneo",
  };
  assert.doesNotThrow(() => financeSchema.parse(valid));
  assert.throws(() => financeSchema.parse({ ...valid, motivo: "abc" }));
  assert.throws(() => financeSchema.parse({ ...valid, requestId: "not-a-uuid" }));
  assert.throws(() => financeSchema.parse({ ...valid, prestamoId: "invalid space!" }));
});
test("refinance_loan schema validates terms and dates", () => {
  const valid = {
    action: "refinance_loan",
    requestId: "a0000000-0000-4000-8000-000000000002",
    prestamoId: "loan_12345",
    nuevoMonto: 500,
    tasaInteres: 5,
    periodoTasa: "mensual" as const,
    tipoInteres: "fijo" as const,
    frecuenciaPago: "mensual" as const,
    numeroCuotas: 6,
    fechaPrimerPago: "2026-12-01",
    motivo: "Convenio de refinanciación por mora",
  };
  assert.doesNotThrow(() => financeSchema.parse(valid));
  assert.throws(() => financeSchema.parse({ ...valid, nuevoMonto: -10 }));
  assert.throws(() => financeSchema.parse({ ...valid, numeroCuotas: 0 }));
  assert.throws(() => financeSchema.parse({ ...valid, fechaPrimerPago: "fecha-invalida" }));
  assert.throws(() => financeSchema.parse({ ...valid, motivo: "a" }));
});
