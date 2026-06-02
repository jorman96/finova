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
