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
  if (!Number.isFinite(monto) || monto <= 0 || !Number.isSafeInteger(Math.round(monto * 100)) || Math.abs(monto * 100 - Math.round(monto * 100)) > 0.00001 || !Number.isFinite(tasaInteres) || tasaInteres < 0 || !Number.isInteger(numeroCuotas) || numeroCuotas < 1 || numeroCuotas > 200 || Math.round(monto * 100) < numeroCuotas || !/^\d{4}-\d{2}-\d{2}$/.test(fechaPrimerPago) || isNaN(parseISO(fechaPrimerPago).getTime())) throw new Error('Revisa monto, tasa, fecha y número de cuotas (1 a 200). El monto debe tener hasta dos decimales y cubrir al menos un centavo de capital por cuota.');

  const cuotas: CuotaProyectada[] = [];
  let fechaActual = parseISO(fechaPrimerPago);

  // Convertir la tasa nominal a la tasa efectiva decimal por periodo de cuota
  const tasaEfectivaDecimal = calcularTasaPorCuota(tasaInteres, periodoTasa, frecuenciaPago) / 100;
  let remainingCents = Math.round(monto * 100);
  const principalCents = remainingCents;
  const cumulativePrincipal = (i: number) => Number((BigInt(principalCents) * BigInt(i) + BigInt(Math.floor(numeroCuotas / 2))) / BigInt(numeroCuotas));

  if (tipoInteres === 'fijo') {
    // Interés simple
    const interesPorCuota = monto * tasaEfectivaDecimal;

    for (let i = 1; i <= numeroCuotas; i++) {
      const capitalCents = cumulativePrincipal(i) - cumulativePrincipal(i - 1);
      const interestCents = Math.round(interesPorCuota * 100);
      if (!Number.isSafeInteger(interestCents) || !Number.isSafeInteger(capitalCents + interestCents)) throw new Error('Las condiciones exceden la precisión monetaria admitida.');
      remainingCents -= capitalCents;
      cuotas.push({
        numeroCuota: i,
        fechaVencimiento: format(fechaActual, "yyyy-MM-dd"),
        capital: capitalCents / 100,
        interes: interestCents / 100,
        totalCuota: (capitalCents + interestCents) / 100,
        saldoPendiente: remainingCents / 100
      });
      fechaActual = getNextDate(fechaActual, frecuenciaPago);
    }
  } else if (tipoInteres === 'saldo_deudor') {
    // Sistema francés
    let cuotaFija = monto * (tasaEfectivaDecimal * Math.pow(1 + tasaEfectivaDecimal, numeroCuotas)) / (Math.pow(1 + tasaEfectivaDecimal, numeroCuotas) - 1);
    if (tasaEfectivaDecimal === 0) cuotaFija = monto / numeroCuotas;
    if (!Number.isFinite(cuotaFija)) throw new Error('Las condiciones exceden los límites del simulador.');

    for (let i = 1; i <= numeroCuotas; i++) {
      const interestCents = Math.round(remainingCents * tasaEfectivaDecimal);
      const capitalCents = tasaEfectivaDecimal === 0 ? cumulativePrincipal(i) - cumulativePrincipal(i - 1) : i === numeroCuotas ? remainingCents : Math.min(remainingCents, Math.max(0, Math.round(cuotaFija * 100) - interestCents));
      if (!Number.isSafeInteger(interestCents) || !Number.isSafeInteger(capitalCents + interestCents) || capitalCents + interestCents <= 0) throw new Error('El monto y el plazo generan cuotas sin importe válido. Revisa las condiciones.');
      remainingCents -= capitalCents;

      cuotas.push({
        numeroCuota: i,
        fechaVencimiento: format(fechaActual, "yyyy-MM-dd"),
        capital: capitalCents / 100,
        interes: interestCents / 100,
        totalCuota: (capitalCents + interestCents) / 100,
        saldoPendiente: remainingCents / 100
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
