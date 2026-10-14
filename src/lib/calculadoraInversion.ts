import { addMonths, parseISO, format } from "date-fns";
import { ModalidadPagoInversionista } from "@/types";

export interface CalculoInversionInput {
  montoTotal: number;
  tieneInteres: boolean;
  tasaInteresMensual: number; // Porcentaje mensual ej: 2%
  modalidadPago: ModalidadPagoInversionista;
  plazoMeses: number;
  fechaPrimerPago: string;
}

export interface CuotaInversionProyectada {
  numeroCuota: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  totalCuota: number;
  saldoRestante: number;
}

export interface ResumenInversionProyectada {
  cuotas: CuotaInversionProyectada[];
  totalCapital: number;
  totalInteres: number;
  totalPagar: number;
}

export function generarCronogramaInversion(input: CalculoInversionInput): ResumenInversionProyectada {
  const { montoTotal, tieneInteres, tasaInteresMensual, modalidadPago, plazoMeses, fechaPrimerPago } = input;

  const cuotas: CuotaInversionProyectada[] = [];
  const tasaDecimal = tieneInteres ? Math.max(0, tasaInteresMensual) / 100 : 0;
  let fechaActual = parseISO(fechaPrimerPago);
  let saldoRestante = montoTotal;

  if (modalidadPago === 'interes_mensual_capital_al_vencimiento') {
    // Mes a mes se paga el interés del monto total. En la última cuota se devuelve el capital completo.
    const interesMensual = Number((montoTotal * tasaDecimal).toFixed(2));

    for (let i = 1; i <= plazoMeses; i++) {
      const esUltima = i === plazoMeses;
      const capitalCuota = esUltima ? montoTotal : 0;
      const interesCuota = interesMensual;
      const totalCuota = Number((capitalCuota + interesCuota).toFixed(2));
      saldoRestante = esUltima ? 0 : montoTotal;

      cuotas.push({
        numeroCuota: i,
        fechaVencimiento: format(fechaActual, 'yyyy-MM-dd'),
        capital: capitalCuota,
        interes: interesCuota,
        totalCuota,
        saldoRestante
      });

      fechaActual = addMonths(fechaActual, 1);
    }
  } else if (modalidadPago === 'cuota_amortizada_mensual') {
    // Capital repartido uniformemente + interés acordado sobre el capital
    const capitalPorMes = Number((montoTotal / plazoMeses).toFixed(2));
    const interesPorMes = Number((montoTotal * tasaDecimal).toFixed(2));
    let capitalAcumulado = 0;

    for (let i = 1; i <= plazoMeses; i++) {
      const esUltima = i === plazoMeses;
      const capitalCuota = esUltima ? Number((montoTotal - capitalAcumulado).toFixed(2)) : capitalPorMes;
      capitalAcumulado += capitalCuota;
      const interesCuota = interesPorMes;
      const totalCuota = Number((capitalCuota + interesCuota).toFixed(2));
      saldoRestante = Math.max(0, Number((montoTotal - capitalAcumulado).toFixed(2)));

      cuotas.push({
        numeroCuota: i,
        fechaVencimiento: format(fechaActual, 'yyyy-MM-dd'),
        capital: capitalCuota,
        interes: interesCuota,
        totalCuota,
        saldoRestante
      });

      fechaActual = addMonths(fechaActual, 1);
    }
  } else {
    // 'devolucion_capital_en_cuotas' (Sin interés, división de capital pura)
    const capitalPorMes = Number((montoTotal / plazoMeses).toFixed(2));
    let capitalAcumulado = 0;

    for (let i = 1; i <= plazoMeses; i++) {
      const esUltima = i === plazoMeses;
      const capitalCuota = esUltima ? Number((montoTotal - capitalAcumulado).toFixed(2)) : capitalPorMes;
      capitalAcumulado += capitalCuota;
      const interesCuota = 0;
      const totalCuota = capitalCuota;
      saldoRestante = Math.max(0, Number((montoTotal - capitalAcumulado).toFixed(2)));

      cuotas.push({
        numeroCuota: i,
        fechaVencimiento: format(fechaActual, 'yyyy-MM-dd'),
        capital: capitalCuota,
        interes: interesCuota,
        totalCuota,
        saldoRestante
      });

      fechaActual = addMonths(fechaActual, 1);
    }
  }

  const totalCapital = cuotas.reduce((sum, c) => sum + c.capital, 0);
  const totalInteres = cuotas.reduce((sum, c) => sum + c.interes, 0);
  const totalPagar = Number((totalCapital + totalInteres).toFixed(2));

  return {
    cuotas,
    totalCapital: Number(totalCapital.toFixed(2)),
    totalInteres: Number(totalInteres.toFixed(2)),
    totalPagar
  };
}
