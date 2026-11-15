import { z } from "zod";
export const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const amountSchema = z.number().finite().positive().max(100_000_000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001, "Usa hasta dos decimales");
const allocationAmount = z.number().finite().nonnegative().max(100_000_000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
const requestId = z.string().uuid();
export const financeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("score"), requestId, clienteId: idSchema, score: z.number().int().min(0).max(100), motivo: z.string().trim().min(10).max(500) }),
  z.object({ action: z.literal("loan"), requestId, clienteId: idSchema, monto: amountSchema, tasaInteres: z.number().min(0).max(100), periodoTasa: z.enum(["mensual","anual"]), tipoInteres: z.enum(["fijo","saldo_deudor"]), frecuenciaPago: z.enum(["diario","semanal","quincenal","mensual"]), numeroCuotas: z.number().int().min(1).max(360), fechaDesembolso: dateSchema, fechaPrimerPago: dateSchema }),
  z.object({ action: z.literal("payment"), requestId, prestamoId: idSchema, monto: amountSchema, metodo: z.enum(["efectivo","transferencia","deposito","cheque"]), cuentaDestino: z.string().max(120).optional(), observaciones: z.string().max(1000).default(""), comprobanteUrl: z.string().url().max(2000).nullable().optional() }),
  z.object({ action: z.literal("investment"), requestId, inversionistaId: idSchema, montoTotal: amountSchema, montoCartera: allocationAmount, montoOtros: allocationAmount, tieneInteres: z.boolean(), tasaInteresMensual: z.number().min(0).max(100), modalidadPago: z.enum(["interes_mensual_capital_al_vencimiento","cuota_amortizada_mensual","devolucion_capital_en_cuotas"]), plazoMeses: z.number().int().min(1).max(120), fechaInicio: dateSchema, fechaPrimerPago: dateSchema, observaciones: z.string().max(1000).default("") }),
  z.object({ action: z.literal("investor_payment"), requestId, contratoId: idSchema, cuotaId: idSchema.optional(), monto: amountSchema, metodo: z.enum(["efectivo","transferencia","deposito","cheque"]), cuentaOrigen: z.string().max(120).default("Caja General"), observaciones: z.string().max(1000).default(""), comprobanteUrl: z.string().url().max(2000).nullable().optional() }),
  z.object({ action: z.literal("reverse_payment"), requestId, pagoId: idSchema, motivo: z.string().trim().min(10).max(500) }),
  z.object({ action: z.literal("cancel_loan"), requestId, prestamoId: idSchema, motivo: z.string().trim().min(10).max(500) }),
  z.object({ action: z.literal("delete_loan"), requestId, prestamoId: idSchema, motivo: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal("refinance_loan"), requestId, prestamoId: idSchema, nuevoMonto: amountSchema, tasaInteres: z.number().min(0).max(100), periodoTasa: z.enum(["mensual","anual"]), tipoInteres: z.enum(["fijo","saldo_deudor"]), frecuenciaPago: z.enum(["diario","semanal","quincenal","mensual"]), numeroCuotas: z.number().int().min(1).max(360), fechaPrimerPago: dateSchema, motivo: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal("capital"), requestId, monto: amountSchema, motivo: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("reverse_capital"), requestId, inyeccionId: idSchema, motivo: z.string().trim().min(10).max(500) }),
  z.object({ action: z.literal("cash"), requestId, tipo: z.enum(["gasto","retiro","ingreso","transferencia"]), monto: amountSchema, cuentaOrigen: z.string().min(1).max(120), cuentaDestino: z.string().max(120).optional(), motivo: z.string().trim().min(5).max(500), referencia: z.string().max(120).default("") }),
  z.object({ action: z.literal("reconcile"), requestId, movimientoId: idSchema, referencia: z.string().trim().min(3).max(120) }),
]);
