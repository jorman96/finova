import { addDays, addWeeks, addMonths, parseISO, format } from "date-fns";

export interface AmortizationInput {
  monto: number;
  tasaInteres: number; // Tasa por periodo de cuota
  tipoInteres: 'fijo' | 'saldo_deudor';
  frecuenciaPago: 'diario' | 'semanal' | 'quincenal' | 'mensual';
  numeroCuotas: number;
  fechaPrimerPago: string;
}

export interface CuotaProyectada {
  numeroCuota: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  totalCuota: number;
  saldoPendiente: number;
}

export function generateAmortizationTable(input: AmortizationInput): CuotaProyectada[] {
  const { monto, tasaInteres, tipoInteres, frecuenciaPago, numeroCuotas, fechaPrimerPago } = input;
  
  const cuotas: CuotaProyectada[] = [];
  let saldoActual = monto;
  let fechaActual = parseISO(fechaPrimerPago);
  const tasaDecimal = tasaInteres / 100;

  if (tipoInteres === 'fijo') {
    // Interés simple directo sobre el monto inicial (ej. 10% del préstamo = monto * 0.10, si la tasaInteres es por cuota)
    // Usualmente "fijo" en prestamos informales significa que cada cuota tiene el mismo interes
    const interesPorCuota = monto * tasaDecimal;
    const capitalPorCuota = monto / numeroCuotas;
    const cuotaFija = capitalPorCuota + interesPorCuota;

    for (let i = 1; i <= numeroCuotas; i++) {
      saldoActual -= capitalPorCuota;
      cuotas.push({
        numeroCuota: i,
        fechaVencimiento: format(fechaActual, "yyyy-MM-dd"),
        capital: Number(capitalPorCuota.toFixed(2)),
        interes: Number(interesPorCuota.toFixed(2)),
        totalCuota: Number(cuotaFija.toFixed(2)),
        saldoPendiente: Number(Math.max(0, saldoActual).toFixed(2))
      });
      fechaActual = getNextDate(fechaActual, frecuenciaPago);
    }
  } else if (tipoInteres === 'saldo_deudor') {
    // Sistema francés (amortización sobre saldo)
    let cuotaFija = monto * (tasaDecimal * Math.pow(1 + tasaDecimal, numeroCuotas)) / (Math.pow(1 + tasaDecimal, numeroCuotas) - 1);
    if (tasaDecimal === 0) cuotaFija = monto / numeroCuotas;

    for (let i = 1; i <= numeroCuotas; i++) {
      const interes = saldoActual * tasaDecimal;
      const capital = cuotaFija - interes;
      saldoActual -= capital;
      
      cuotas.push({
        numeroCuota: i,
        fechaVencimiento: format(fechaActual, "yyyy-MM-dd"),
        capital: Number(capital.toFixed(2)),
        interes: Number(interes.toFixed(2)),
        totalCuota: Number(cuotaFija.toFixed(2)),
        saldoPendiente: Number(Math.max(0, saldoActual).toFixed(2))
      });
      fechaActual = getNextDate(fechaActual, frecuenciaPago);
    }
  }

  return cuotas;
}

function getNextDate(currentDate: Date, frecuencia: string): Date {
  switch (frecuencia) {
    case 'diario': return addDays(currentDate, 1);
    case 'semanal': return addWeeks(currentDate, 1);
    case 'quincenal': return addDays(currentDate, 15);
    case 'mensual': return addMonths(currentDate, 1);
    default: return addMonths(currentDate, 1);
  }
}
