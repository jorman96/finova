import type { Cuota,Pago,Prestamo } from "./index";
export interface ReportData {
  moneda: string; corteMora: string;
  pagos: (Pago & { fechaStr: string; usuarioNombre?: string })[];
  prestamos: Prestamo[];
  mora: (Cuota & { clienteNombre: string })[];
}
