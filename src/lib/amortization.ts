import { addDays, addWeeks, addMonths, parseISO, format } from "date-fns";

export interface AmortizationInput {
  monto: number;
  tasaInteres: number; // Tasa nominal ingresada
  periodoTasa?: 'mensual' | 'anual'; // El periodo de la tasa ingresada
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

function calcularTasaPorCuota(tasaInput: number, periodoTasa: string, frecuenciaPago: string): number {
  let tasaMensual = tasaInput;

  // Convertir todo a tasa mensual primero como base
  if (periodoTasa === 'anual') {
    tasaMensual = tasaInput / 12;
  }

  // Fraccionar la tasa mensual según la frecuencia de pago usando estándar comercial simple
  switch (frecuenciaPago) {
    case 'diario':
      return tasaMensual / 30; // 30 días = 1 mes
    case 'semanal':
      return tasaMensual / 4; // 4 semanas = 1 mes
    case 'quincenal':
      return tasaMensual / 2; // 2 quincenas = 1 mes
    case 'mensual':
      return tasaMensual;
    default:
      return tasaMensual;
  }
}

export function generateAmortizationTable(input: AmortizationInput): CuotaProyectada[] {
  const { monto, tasaInteres, tipoInteres, frecuenciaPago, numeroCuotas, fechaPrimerPago, periodoTasa = 'mensual' } = input;
  
  const cuotas: CuotaProyectada[] = [];
  let saldoActual = monto;
  let fechaActual = parseISO(fechaPrimerPago);
  
  // Convertir la tasa nominal a la tasa efectiva decimal por periodo de cuota
  const tasaEfectivaDecimal = calcularTasaPorCuota(tasaInteres, periodoTasa, frecuenciaPago) / 100;

  if (tipoInteres === 'fijo') {
    // Interés simple
    const interesPorCuota = monto * tasaEfectivaDecimal;
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
    // Sistema francés
    let cuotaFija = monto * (tasaEfectivaDecimal * Math.pow(1 + tasaEfectivaDecimal, numeroCuotas)) / (Math.pow(1 + tasaEfectivaDecimal, numeroCuotas) - 1);
    if (tasaEfectivaDecimal === 0) cuotaFija = monto / numeroCuotas;

    for (let i = 1; i <= numeroCuotas; i++) {
      const interes = saldoActual * tasaEfectivaDecimal;
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
