export interface Usuario {
  uid: string;
  nombre: string;
  email: string;
  documento?: string; // Nuevo
  telefono?: string;  // Nuevo
  rol: 'superadmin' | 'admin' | 'dueño' | 'gestor' | 'cobrador' | 'cajero' | 'consulta';
  empresaId: string;
  activo: boolean;
  createdAt: any;
}

export interface CuentaBancaria {
  id: string;
  banco: string;
  numero: string;
  tipo: string;
  titular: string;
}

export interface InyeccionCapital {
  id: string;
  monto: number;
  fecha: string;
  observaciones: string;
  registradoPor: string;
}

export interface MovimientoBitacoraCapital {
  id: string;
  tipo: 'inyeccion' | 'reversion' | 'ajuste';
  monto: number;
  fecha: string;
  motivo: string;
  registradoPor: string;
  usuarioEmail?: string;
  usuarioRol?: string;
  inyeccionIdRef?: string;
}

export interface Empresa {
  id: string;
  nombre: string; // Nombre Comercial
  razonSocial: string;
  identificacionFiscal: string; // RUC/NIT
  direccion: string;
  telefono: string;
  email: string;
  pais: string;
  moneda: string;
  plan: 'basico' | 'pro' | 'premium';
  estado: 'activa' | 'suspendida';
  capitalInicial?: number; // Inversión inicial original
  inyeccionesCapital?: InyeccionCapital[];
  bitacoraCapital?: MovimientoBitacoraCapital[];
  cuentasBancarias?: CuentaBancaria[];
  createdAt: any;
}

export interface Cliente {
  id: string;
  empresaId: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  fechaNacimiento: string;
  genero: string;
  estadoCivil: string;
  telefonoPrincipal: string;
  telefonoSecundario?: string;
  correo: string;
  direccion: string;
  
  // Información laboral
  empresa: string;
  cargo: string;
  ingresosMensuales: number;
  antiguedadLaboral: string;
  
  // Referencias
  referencia1: string;
  telefonoRef1: string;
  referencia2?: string;
  telefonoRef2?: string;

  // Estado financiero/Resumen
  estado: 'activo' | 'moroso' | 'cerrado' | 'nuevo';
  score?: number;
  documentos?: { nombre: string; url: string }[];
  createdAt: any;
}

export interface Prestamo {
  id: string;
  empresaId: string;
  clienteId: string;
  clienteNombre: string;
  monto: number;
  tasaInteres: number;
  tipoInteres: 'fijo' | 'saldo_deudor';
  frecuenciaPago: 'diario' | 'semanal' | 'quincenal' | 'mensual';
  numeroCuotas: number;
  fechaDesembolso: string;
  fechaPrimerPago: string;
  garantia: string;
  observaciones: string;
  
  // Financiero
  totalInteres: number;
  totalPagar: number;
  saldoRestante: number;
  
  estado: 'activo' | 'completado' | 'moroso';
  createdAt: any;
}

export interface Cuota {
  id: string;
  empresaId: string;
  prestamoId: string;
  clienteId: string;
  numeroCuota: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  totalCuota: number;
  saldoPendiente: number; // Saldo de capital restante después de esta cuota
  estado: 'pendiente' | 'pagada' | 'vencida' | 'parcial';
  montoPagado: number;
  fechaPago?: string;
}

export interface Pago {
  id: string;
  empresaId: string;
  prestamoId: string;
  clienteId: string;
  clienteNombre?: string;
  monto: number;
  metodo: string;
  cuentaDestino?: string;
  observaciones: string;
  comprobanteUrl?: string | null;
  fecha: any;
  registradoPor: string;
}

export interface Inversionista {
  id: string;
  empresaId: string;
  nombres: string;
  apellidos?: string;
  identificacion: string; // Cédula o RUC
  telefono: string;
  correo?: string;
  direccion?: string;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  titularCuenta?: string;
  estado: 'activo' | 'inactivo';
  totalInvertido?: number;
  totalPagado?: number;
  saldoPendiente?: number;
  createdAt: any;
}

export type ModalidadPagoInversionista = 
  | 'interes_mensual_capital_al_vencimiento' // Interés cada mes, capital al final
  | 'cuota_amortizada_mensual'              // Capital + interés prorrateado mes a mes
  | 'devolucion_capital_en_cuotas';          // Sin interés: solo capital en cuotas mensuales

export interface InversionContrato {
  id: string;
  empresaId: string;
  inversionistaId: string;
  inversionistaNombre: string;
  inversionistaIdentificacion?: string;
  montoTotal: number;
  montoCartera: number;   // Destinado a préstamos (fondo prestable)
  montoOtros: number;     // Destinado a otros gastos/pagos
  tieneInteres: boolean;
  tasaInteresMensual: number; // % mensual pactado
  modalidadPago: ModalidadPagoInversionista;
  plazoMeses: number;
  fechaInicio: string;
  fechaPrimerPago: string;
  totalInteresPagar: number;
  totalPagar: number;
  totalPagado: number;
  saldoPendiente: number;
  estado: 'activo' | 'liquidado' | 'cancelado';
  observaciones?: string;
  createdAt: any;
}

export interface CuotaInversionista {
  id: string;
  empresaId: string;
  inversionContratoId: string;
  inversionistaId: string;
  numeroCuota: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  totalCuota: number;
  montoPagado: number;
  saldoRestante: number;
  estado: 'pendiente' | 'pagada' | 'parcial';
  fechaPago?: string;
}

export interface PagoInversionista {
  id: string;
  empresaId: string;
  inversionContratoId: string;
  inversionistaId: string;
  inversionistaNombre?: string;
  cuotaInversionistaId?: string;
  numeroCuota?: number;
  monto: number;
  montoCapital: number;
  montoInteres: number;
  metodo: string;
  cuentaOrigen?: string;
  observaciones?: string;
  comprobanteUrl?: string | null;
  fecha: any;
  registradoPor: string;
}

