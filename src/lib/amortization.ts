import { addDays,addMonths,addWeeks,format,isValid,parseISO } from "date-fns";
import { cents } from "./money";
export interface AmortizationInput {
  monto: number; tasaInteres: number; periodoTasa?: "mensual" | "anual";
  tipoInteres: "fijo" | "saldo_deudor"; frecuenciaPago: "diario" | "semanal" | "quincenal" | "mensual";
  numeroCuotas: number; fechaPrimerPago: string;
}
export interface CuotaProyectada { numeroCuota: number; fechaVencimiento: string; capital: number; interes: number; totalCuota: number; saldoPendiente: number }
export function installmentDate(first: string, frequency: AmortizationInput["frecuenciaPago"], index: number) {
  const date = parseISO(first);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(first) || !isValid(date) || format(date, "yyyy-MM-dd") !== first) throw new Error("Fecha inválida");
  const next = frequency === "mensual" ? addMonths(date, index) : frequency === "semanal" ? addWeeks(date, index) : addDays(date, index * (frequency === "quincenal" ? 15 : 1));
  return format(next, "yyyy-MM-dd");
}
export function generateAmortizationTable(input: AmortizationInput): CuotaProyectada[] {
  const { monto, tasaInteres, numeroCuotas: n, tipoInteres, frecuenciaPago, fechaPrimerPago, periodoTasa = "mensual" } = input;
  if (cents(monto) <= 0 || !Number.isInteger(n) || n < 1 || n > 360 || cents(monto) < n || !Number.isFinite(tasaInteres) || tasaInteres < 0 || tasaInteres > 100) throw new Error("Condiciones financieras inválidas");
  if (!["fijo", "saldo_deudor"].includes(tipoInteres) || !["diario", "semanal", "quincenal", "mensual"].includes(frecuenciaPago) || !["mensual", "anual"].includes(periodoTasa)) throw new Error("Modalidad inválida");
  const rate = tasaInteres / (periodoTasa === "anual" ? 12 : 1) / ({ diario: 30, semanal: 4, quincenal: 2, mensual: 1 }[frecuenciaPago]) / 100;
  const principal = cents(monto), base = Math.floor(principal / n);
  const fixed = rate === 0 ? principal / n : principal * rate / (1 - Math.pow(1 + rate, -n));
  let balance = principal;
  return Array.from({ length: n }, (_, i) => {
    const interest = Math.round((tipoInteres === "fijo" ? principal : balance) * rate);
    const capital = i === n - 1 ? balance : tipoInteres === "fijo" ? base : Math.min(balance, Math.max(0, Math.round(fixed) - interest));
    balance -= capital;
    return { numeroCuota: i + 1, fechaVencimiento: installmentDate(fechaPrimerPago, frecuenciaPago, i), capital: capital / 100, interes: interest / 100, totalCuota: (capital + interest) / 100, saldoPendiente: balance / 100 };
  });
}
