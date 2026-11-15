// js/data.js - Base de datos simulada y modelo de datos para FINOVA Inversionistas

const FINOVA_INITIAL_DATA = {
  empresa: {
    nombre: "FINOVA Soluciones Financieras",
    ruc: "1792482910001",
    moneda: "USD",
    tasaPromedioCartera: 20.0, // 20% mensual cobrado a clientes de microcréditos
    capitalTotalRecibido: 53000.00,
    capitalAsignadoPrestamos: 38000.00,
    capitalOtrosUsos: 15000.00,
    capitalDevueltoTotal: 3500.00,
    capitalPendienteDevolucion: 49500.00,
    interesesCobradosCarteraFondeada: 7600.00,
    rendimientosDevengadosTotal: 4120.00,
    rendimientosPagadosTotal: 2840.00,
    rendimientosPendientesPago: 1280.00,
    margenFinancieroBruto: 3480.00 // (7600 cobrados de cartera - 4120 rendimientos inversionistas)
  },

  inversionistas: [
    {
      id: "INV-001",
      nombre: "Ing. Roberto Andrade Carrión",
      tipoDocumento: "RUC",
      documento: "1718293849001",
      tipoPersona: "Natural con RUC",
      email: "roberto.andrade@inversiones.ec",
      telefono: "+593 99 823 4512",
      ciudad: "Quito, Ecuador",
      direccion: "Av. República de El Salvador 890 y Moscú, Edif. Torre Nova, Of. 602",
      bancoDestino: "Banco Pichincha",
      tipoCuenta: "Corriente",
      numeroCuenta: "2100489234",
      titularCuenta: "Roberto Andrade Carrión",
      fechaRegistro: "2026-01-10",
      estado: "activo",
      calificacionRiesgo: "Preferencial A+",
      // Finanzas del inversionista
      totalAportado: 8000.00,
      capitalAsignadoPrestamos: 2000.00,
      capitalOtrosUsos: 6000.00,
      capitalDevuelto: 0.00,
      capitalPendiente: 8000.00,
      acuerdoVigente: {
        id: "ACU-001",
        codigo: "CONTR-2026-014",
        tasaMensualPactada: 3.5, // 3.5% mensual (muy diferente al 20% de FINOVA)
        modalidadPago: "Interés mensual, Capital al vencimiento",
        frecuenciaPago: "Mensual",
        plazoMeses: 12,
        fechaInicio: "2026-01-15",
        fechaVencimiento: "2027-01-15",
        garantiaPactada: "Pagaré a la vista respaldado por cartera",
        diaCorte: 15
      },
      interesesCobradosCartera: 840.00,
      rendimientoDevengado: 560.00,
      rendimientoPagado: 280.00,
      rendimientoPendiente: 280.00,
      proximoVencimiento: "2026-10-15",
      notas: "Fondeador clave para la cartera de microcréditos de comercio textil. Requiere reporte mensual por correo."
    },
    {
      id: "INV-002",
      nombre: "Dra. Elena Valdivieso Morales",
      tipoDocumento: "Cédula",
      documento: "0912456782",
      tipoPersona: "Natural",
      email: "elena.valdivieso@clinicamed.ec",
      telefono: "+593 98 412 9081",
      ciudad: "Guayaquil, Ecuador",
      direccion: "Samborondón, Km 2.5 Vía La Puntilla, Urb. Las Riberas",
      bancoDestino: "Banco Guayaquil",
      tipoCuenta: "Ahorros",
      numeroCuenta: "0014872930",
      titularCuenta: "Elena Valdivieso Morales",
      fechaRegistro: "2026-02-01",
      estado: "activo",
      calificacionRiesgo: "Preferencial A+",
      totalAportado: 15000.00,
      capitalAsignadoPrestamos: 11000.00,
      capitalOtrosUsos: 4000.00,
      capitalDevuelto: 2500.00,
      capitalPendiente: 12500.00,
      acuerdoVigente: {
        id: "ACU-002",
        codigo: "CONTR-2026-029",
        tasaMensualPactada: 3.0,
        modalidadPago: "Amortización de Capital + Interés Trimestral",
        frecuenciaPago: "Mensual",
        plazoMeses: 18,
        fechaInicio: "2026-02-01",
        fechaVencimiento: "2027-08-01",
        garantiaPactada: "Contrato notariado de mutuo dinerario",
        diaCorte: 30
      },
      interesesCobradosCartera: 3850.00,
      rendimientoDevengado: 2250.00,
      rendimientoPagado: 1800.00,
      rendimientoPendiente: 450.00,
      proximoVencimiento: "2026-10-30",
      notas: "Inversión estructurada con devolución programada de capital trimestral de $2,500."
    },
    {
      id: "INV-003",
      nombre: "Lcdo. Marco Silva Cárdenas",
      tipoDocumento: "Cédula",
      documento: "1103948215",
      tipoPersona: "Natural",
      email: "msilva.corp@outlook.com",
      telefono: "+593 97 901 3344",
      ciudad: "Cuenca, Ecuador",
      direccion: "Gran Colombia 12-45 y Tarqui",
      bancoDestino: "Banco del Austro",
      tipoCuenta: "Corriente",
      numeroCuenta: "3004921102",
      titularCuenta: "Marco Silva Cárdenas",
      fechaRegistro: "2026-03-12",
      estado: "activo",
      calificacionRiesgo: "Estándar B",
      totalAportado: 5000.00,
      capitalAsignadoPrestamos: 5000.00,
      capitalOtrosUsos: 0.00,
      capitalDevuelto: 1000.00,
      capitalPendiente: 4000.00,
      acuerdoVigente: {
        id: "ACU-003",
        codigo: "CONTR-2026-041",
        tasaMensualPactada: 4.0,
        modalidadPago: "Interés mensual, Capital al vencimiento",
        frecuenciaPago: "Mensual",
        plazoMeses: 6,
        fechaInicio: "2026-03-15",
        fechaVencimiento: "2026-09-15",
        garantiaPactada: "Pagaré a la orden",
        diaCorte: 15
      },
      interesesCobradosCartera: 1410.00,
      rendimientoDevengado: 810.00,
      rendimientoPagado: 560.00,
      rendimientoPendiente: 250.00,
      proximoVencimiento: "2026-10-15",
      notas: "El contrato culmina en renovación por 6 meses adicionales. Pago de intereses puntual."
    },
    {
      id: "INV-004",
      nombre: "Valores & Capitales Futuro Cía. Ltda.",
      tipoDocumento: "RUC",
      documento: "1792837465001",
      tipoPersona: "Jurídica",
      email: "contacto@capitalesfuturo.ec",
      telefono: "+593 2 245 9900",
      ciudad: "Quito, Ecuador",
      direccion: "Av. Amazonas N36-152 y Naciones Unidas, Torre B, Piso 8",
      bancoDestino: "Banco Internacional",
      tipoCuenta: "Corriente",
      numeroCuenta: "0500192847",
      titularCuenta: "Valores & Capitales Futuro Cía. Ltda.",
      fechaRegistro: "2026-05-18",
      estado: "activo",
      calificacionRiesgo: "Institucional AAA",
      totalAportado: 25000.00,
      capitalAsignadoPrestamos: 20000.00,
      capitalOtrosUsos: 5000.00,
      capitalDevuelto: 0.00,
      capitalPendiente: 25000.00,
      acuerdoVigente: {
        id: "ACU-004",
        codigo: "CONTR-2026-088",
        tasaMensualPactada: 2.8,
        modalidadPago: "Rendimiento mensual pagadero a cuenta corporativa",
        frecuenciaPago: "Mensual",
        plazoMeses: 24,
        fechaInicio: "2026-05-20",
        fechaVencimiento: "2028-05-20",
        garantiaPactada: "Fideicomiso de garantía de flujos",
        diaCorte: 20
      },
      interesesCobradosCartera: 1500.00,
      rendimientoDevengado: 500.00,
      rendimientoPagado: 200.00,
      rendimientoPendiente: 300.00,
      proximoVencimiento: "2026-10-20",
      notas: "Vehículo institucional. Permite reasignación dinámica de fondos a créditos tipo microempresa."
    }
  ],

  // Préstamos existentes en FINOVA que son fondeados o candidatos a fondeo
  prestamosFinova: [
    {
      id: "PREST-1049",
      clienteNombre: "Carlos Mendoza Salazar",
      clienteDocumento: "1720394851",
      montoOriginal: 1200.00,
      tasaMensualFinanciera: 20.0,
      plazoMeses: 3,
      modalidad: "Fijo Quincenal (6 cuotas)",
      fechaDesembolso: "2026-01-20",
      totalInteresPactado: 240.00,
      totalAPagar: 1440.00,
      saldoRestante: 0.00,
      estado: "completado",
      inversionistaFondeadorId: "INV-001",
      inversionistaNombre: "Ing. Roberto Andrade Carrión",
      montoFondeado: 1200.00,
      porcentajeFondeo: 100.0,
      interesEfectivamenteCobrado: 240.00,
      capitalRecuperado: 1200.00
    },
    {
      id: "PREST-1052",
      clienteNombre: "Andrea Torres Vivar",
      clienteDocumento: "1719283740",
      montoOriginal: 800.00,
      tasaMensualFinanciera: 20.0,
      plazoMeses: 2,
      modalidad: "Fijo Semanal (8 cuotas)",
      fechaDesembolso: "2026-02-05",
      totalInteresPactado: 160.00,
      totalAPagar: 960.00,
      saldoRestante: 0.00,
      estado: "completado",
      inversionistaFondeadorId: "INV-001",
      inversionistaNombre: "Ing. Roberto Andrade Carrión",
      montoFondeado: 800.00,
      porcentajeFondeo: 100.0,
      interesEfectivamenteCobrado: 160.00,
      capitalRecuperado: 800.00
    },
    {
      id: "PREST-1070",
      clienteNombre: "Manuel Ortiz Cevallos",
      clienteDocumento: "0923847561",
      montoOriginal: 3500.00,
      tasaMensualFinanciera: 20.0,
      plazoMeses: 4,
      modalidad: "Fijo Mensual (4 cuotas)",
      fechaDesembolso: "2026-02-15",
      totalInteresPactado: 1400.00,
      totalAPagar: 4900.00,
      saldoRestante: 1225.00,
      estado: "activo",
      inversionistaFondeadorId: "INV-002",
      inversionistaNombre: "Dra. Elena Valdivieso Morales",
      montoFondeado: 3500.00,
      porcentajeFondeo: 100.0,
      interesEfectivamenteCobrado: 1050.00,
      capitalRecuperado: 2625.00
    },
    {
      id: "PREST-1085",
      clienteNombre: "Distribuidora San José S.A.",
      clienteDocumento: "1792948572001",
      montoOriginal: 7500.00,
      tasaMensualFinanciera: 18.0,
      plazoMeses: 6,
      modalidad: "Francés Mensual",
      fechaDesembolso: "2026-03-01",
      totalInteresPactado: 2450.00,
      totalAPagar: 9950.00,
      saldoRestante: 3316.00,
      estado: "activo",
      inversionistaFondeadorId: "INV-002",
      inversionistaNombre: "Dra. Elena Valdivieso Morales",
      montoFondeado: 7500.00,
      porcentajeFondeo: 100.0,
      interesEfectivamenteCobrado: 1800.00,
      capitalRecuperado: 4834.00
    },
    {
      id: "PREST-1102",
      clienteNombre: "Patricio Gómez León",
      clienteDocumento: "1104859203",
      montoOriginal: 5000.00,
      tasaMensualFinanciera: 20.0,
      plazoMeses: 3,
      modalidad: "Fijo Quincenal",
      fechaDesembolso: "2026-03-20",
      totalInteresPactado: 1500.00,
      totalAPagar: 6500.00,
      saldoRestante: 2166.00,
      estado: "activo",
      inversionistaFondeadorId: "INV-003",
      inversionistaNombre: "Lcdo. Marco Silva Cárdenas",
      montoFondeado: 5000.00,
      porcentajeFondeo: 100.0,
      interesEfectivamenteCobrado: 1000.00,
      capitalRecuperado: 3334.00
    },
    {
      id: "PREST-1140",
      clienteNombre: "Comercializadora AgroSur Cía.",
      clienteDocumento: "1793847592001",
      montoOriginal: 20000.00,
      tasaMensualFinanciera: 16.0,
      plazoMeses: 12,
      modalidad: "Amortización Mensual",
      fechaDesembolso: "2026-05-25",
      totalInteresPactado: 7200.00,
      totalAPagar: 27200.00,
      saldoRestante: 20400.00,
      estado: "activo",
      inversionistaFondeadorId: "INV-004",
      inversionistaNombre: "Valores & Capitales Futuro Cía. Ltda.",
      montoFondeado: 20000.00,
      porcentajeFondeo: 100.0,
      interesEfectivamenteCobrado: 1500.00,
      capitalRecuperado: 5300.00
    },
    // Préstamos que necesitan fondos (disponibles para asignación de nuevos aportes)
    {
      id: "PREST-1155",
      clienteNombre: "Gladys Lucía Zambrano",
      clienteDocumento: "1715938472",
      montoOriginal: 1500.00,
      tasaMensualFinanciera: 20.0,
      plazoMeses: 3,
      modalidad: "Fijo Quincenal",
      fechaDesembolso: "2026-10-10",
      totalInteresPactado: 300.00,
      totalAPagar: 1800.00,
      saldoRestante: 1800.00,
      estado: "pendiente_fondeo",
      inversionistaFondeadorId: null,
      inversionistaNombre: "Pendiente de Asignación",
      montoFondeado: 0.00,
      porcentajeFondeo: 0.0,
      interesEfectivamenteCobrado: 0.00,
      capitalRecuperado: 0.00
    },
    {
      id: "PREST-1158",
      clienteNombre: "Taller Mecánico El Especialista",
      clienteDocumento: "1792847192001",
      montoOriginal: 4500.00,
      tasaMensualFinanciera: 20.0,
      plazoMeses: 6,
      modalidad: "Fijo Mensual",
      fechaDesembolso: "2026-10-12",
      totalInteresPactado: 1350.00,
      totalAPagar: 5850.00,
      saldoRestante: 5850.00,
      estado: "pendiente_fondeo",
      inversionistaFondeadorId: null,
      inversionistaNombre: "Pendiente de Asignación",
      montoFondeado: 0.00,
      porcentajeFondeo: 0.0,
      interesEfectivamenteCobrado: 0.00,
      capitalRecuperado: 0.00
    }
  ],

  // Aportes de capital registrados con comprobantes
  aportes: [
    {
      id: "APO-001",
      inversionistaId: "INV-001",
      inversionistaNombre: "Ing. Roberto Andrade Carrión",
      monto: 8000.00,
      fechaAporte: "2026-01-15",
      cuentaReceptoraFinova: "Banco Pichincha - Cta Corriente #2100892019 (FINOVA)",
      medioPago: "Transferencia Interbancaria SPEI",
      numeroComprobante: "TRANSF-8849201",
      comprobanteUrl: "#",
      estado: "confirmado",
      capitalAsignadoPrestamos: 2000.00,
      capitalOtrosUsos: 6000.00,
      estadoAsignacion: "completamente_asignado", // $2000 prestamos + $6000 otros usos = $8000
      registradoPor: "Admin FINOVA (Carlos Rivas)",
      observaciones: "Aporte inicial según contrato CONTR-2026-014. Fondea $2,000 en préstamos directos y $6,000 pasa a tesorería/otros usos."
    },
    {
      id: "APO-002",
      inversionistaId: "INV-002",
      inversionistaNombre: "Dra. Elena Valdivieso Morales",
      monto: 15000.00,
      fechaAporte: "2026-02-01",
      cuentaReceptoraFinova: "Banco Guayaquil - Cta Cte #109283719 (FINOVA)",
      medioPago: "Cheque de Gerencia #99401",
      numeroComprobante: "DEP-7738291",
      comprobanteUrl: "#",
      estado: "confirmado",
      capitalAsignadoPrestamos: 11000.00,
      capitalOtrosUsos: 4000.00,
      estadoAsignacion: "completamente_asignado",
      registradoPor: "Admin FINOVA (Carlos Rivas)",
      observaciones: "Asignación distribuida a 2 créditos comerciales y $4,000 fondo de liquidez y reserva."
    },
    {
      id: "APO-003",
      inversionistaId: "INV-003",
      inversionistaNombre: "Lcdo. Marco Silva Cárdenas",
      monto: 5000.00,
      fechaAporte: "2026-03-12",
      cuentaReceptoraFinova: "Banco Pichincha - Cta Corriente #2100892019 (FINOVA)",
      medioPago: "Transferencia Directa",
      numeroComprobante: "TRANSF-9021844",
      comprobanteUrl: "#",
      estado: "confirmado",
      capitalAsignadoPrestamos: 5000.00,
      capitalOtrosUsos: 0.00,
      estadoAsignacion: "completamente_asignado",
      registradoPor: "Admin FINOVA (Carlos Rivas)",
      observaciones: "100% destinado al crédito PREST-1102 de Patricio Gómez."
    },
    {
      id: "APO-004",
      inversionistaId: "INV-004",
      inversionistaNombre: "Valores & Capitales Futuro Cía. Ltda.",
      monto: 25000.00,
      fechaAporte: "2026-05-18",
      cuentaReceptoraFinova: "Banco Internacional - Cta Cte #029384710 (FINOVA)",
      medioPago: "Transferencia Institucional Banco Central",
      numeroComprobante: "BCE-2026-559102",
      comprobanteUrl: "#",
      estado: "confirmado",
      capitalAsignadoPrestamos: 20000.00,
      capitalOtrosUsos: 5000.00,
      estadoAsignacion: "completamente_asignado",
      registradoPor: "Admin FINOVA (Carlos Rivas)",
      observaciones: "Fondeo corporativo de gran volumen. $20k colocado en AgroSur y $5k en caja de colocación rápida."
    }
  ],

  // Destino y Asignación de cada aporte
  asignaciones: [
    {
      id: "ASIG-001",
      aporteId: "APO-001",
      inversionistaId: "INV-001",
      tipoDestino: "prestamo",
      referenciaId: "PREST-1049",
      destinoNombre: "Préstamo #1049 - Carlos Mendoza ($1,200.00)",
      monto: 1200.00,
      fecha: "2026-01-20",
      justificacion: "Colocación de crédito para capital de trabajo en confección textil.",
      registradoPor: "Admin FINOVA"
    },
    {
      id: "ASIG-002",
      aporteId: "APO-001",
      inversionistaId: "INV-001",
      tipoDestino: "prestamo",
      referenciaId: "PREST-1052",
      destinoNombre: "Préstamo #1052 - Andrea Torres ($800.00)",
      monto: 800.00,
      fecha: "2026-02-05",
      justificacion: "Colocación de microcrédito comercial.",
      registradoPor: "Admin FINOVA"
    },
    {
      id: "ASIG-003",
      aporteId: "APO-001",
      inversionistaId: "INV-001",
      tipoDestino: "otros_usos",
      referenciaId: "USO-001",
      destinoNombre: "Caja Operativa / Disponibilidad General",
      monto: 6000.00,
      fecha: "2026-01-15",
      justificacion: "Respaldo de liquidez, caja disponible para operaciones generales y futuros desembolsos de la financiera.",
      registradoPor: "Admin FINOVA"
    },
    {
      id: "ASIG-004",
      aporteId: "APO-002",
      inversionistaId: "INV-002",
      tipoDestino: "prestamo",
      referenciaId: "PREST-1070",
      destinoNombre: "Préstamo #1070 - Manuel Ortiz ($3,500.00)",
      monto: 3500.00,
      fecha: "2026-02-15",
      justificacion: "Financiamiento de inventario para papelería.",
      registradoPor: "Admin FINOVA"
    },
    {
      id: "ASIG-005",
      aporteId: "APO-002",
      inversionistaId: "INV-002",
      tipoDestino: "prestamo",
      referenciaId: "PREST-1085",
      destinoNombre: "Préstamo #1085 - Distribuidora San José ($7,500.00)",
      monto: 7500.00,
      fecha: "2026-03-01",
      justificacion: "Crédito a distribuidora alimenticia con rotación mensual.",
      registradoPor: "Admin FINOVA"
    },
    {
      id: "ASIG-006",
      aporteId: "APO-002",
      inversionistaId: "INV-002",
      tipoDestino: "otros_usos",
      referenciaId: "USO-002",
      destinoNombre: "Fondo de Reserva de Liquidez",
      monto: 4000.00,
      fecha: "2026-02-01",
      justificacion: "Encaje bancario para respaldar retiros y devoluciones de capital programadas.",
      registradoPor: "Admin FINOVA"
    },
    {
      id: "ASIG-007",
      aporteId: "APO-003",
      inversionistaId: "INV-003",
      tipoDestino: "prestamo",
      referenciaId: "PREST-1102",
      destinoNombre: "Préstamo #1102 - Patricio Gómez ($5,000.00)",
      monto: 5000.00,
      fecha: "2026-03-20",
      justificacion: "Crédito automotriz de rápida amortización.",
      registradoPor: "Admin FINOVA"
    },
    {
      id: "ASIG-008",
      aporteId: "APO-004",
      inversionistaId: "INV-004",
      tipoDestino: "prestamo",
      referenciaId: "PREST-1140",
      destinoNombre: "Préstamo #1140 - Comercializadora AgroSur ($20,000.00)",
      monto: 20000.00,
      fecha: "2026-05-25",
      justificacion: "Fondeo masivo institucional con pagaré agroindustrial.",
      registradoPor: "Admin FINOVA"
    },
    {
      id: "ASIG-009",
      aporteId: "APO-004",
      inversionistaId: "INV-004",
      tipoDestino: "otros_usos",
      referenciaId: "USO-003",
      destinoNombre: "Fondo de Colocación Inmediata",
      monto: 5000.00,
      fecha: "2026-05-18",
      justificacion: "Disponible en cuenta corriente para asignación a nuevas solicitudes en evaluación.",
      registradoPor: "Admin FINOVA"
    }
  ],

  // Recuperación y Atribución de Cobros Reales de Cartera
  recuperacionCobros: [
    {
      id: "REC-001",
      fechaCobro: "2026-02-05",
      prestamoId: "PREST-1049",
      clienteNombre: "Carlos Mendoza Salazar",
      cuotaNumero: "Cuota 1 de 6",
      totalCobrado: 240.00,
      capitalRecuperado: 200.00,
      interesCobrado: 40.00,
      inversionistaId: "INV-001",
      inversionistaNombre: "Ing. Roberto Andrade Carrión",
      montoInteresAtribuido: 40.00,
      estadoAtribucion: "efectivamente_cobrado",
      comprobanteRecibo: "REC-PAG-0081"
    },
    {
      id: "REC-002",
      fechaCobro: "2026-02-20",
      prestamoId: "PREST-1049",
      clienteNombre: "Carlos Mendoza Salazar",
      cuotaNumero: "Cuota 2 de 6",
      totalCobrado: 240.00,
      capitalRecuperado: 200.00,
      interesCobrado: 40.00,
      inversionistaId: "INV-001",
      inversionistaNombre: "Ing. Roberto Andrade Carrión",
      montoInteresAtribuido: 40.00,
      estadoAtribucion: "efectivamente_cobrado",
      comprobanteRecibo: "REC-PAG-0094"
    },
    {
      id: "REC-003",
      fechaCobro: "2026-03-05",
      prestamoId: "PREST-1052",
      clienteNombre: "Andrea Torres Vivar",
      cuotaNumero: "Cuotas 1-4 semanales",
      totalCobrado: 480.00,
      capitalRecuperado: 400.00,
      interesCobrado: 80.00,
      inversionistaId: "INV-001",
      inversionistaNombre: "Ing. Roberto Andrade Carrión",
      montoInteresAtribuido: 80.00,
      estadoAtribucion: "efectivamente_cobrado",
      comprobanteRecibo: "REC-PAG-0112"
    },
    {
      id: "REC-004",
      fechaCobro: "2026-04-15",
      prestamoId: "PREST-1070",
      clienteNombre: "Manuel Ortiz Cevallos",
      cuotaNumero: "Cuota 2 de 4",
      totalCobrado: 1225.00,
      capitalRecuperado: 875.00,
      interesCobrado: 350.00,
      inversionistaId: "INV-002",
      inversionistaNombre: "Dra. Elena Valdivieso Morales",
      montoInteresAtribuido: 350.00,
      estadoAtribucion: "efectivamente_cobrado",
      comprobanteRecibo: "REC-PAG-0178"
    },
    {
      id: "REC-005",
      fechaCobro: "2026-05-01",
      prestamoId: "PREST-1085",
      clienteNombre: "Distribuidora San José S.A.",
      cuotaNumero: "Cuota 2 de 6",
      totalCobrado: 1658.00,
      capitalRecuperado: 1250.00,
      interesCobrado: 408.00,
      inversionistaId: "INV-002",
      inversionistaNombre: "Dra. Elena Valdivieso Morales",
      montoInteresAtribuido: 408.00,
      estadoAtribucion: "efectivamente_cobrado",
      comprobanteRecibo: "REC-PAG-0205"
    },
    {
      id: "REC-006",
      fechaCobro: "2026-06-20",
      prestamoId: "PREST-1102",
      clienteNombre: "Patricio Gómez León",
      cuotaNumero: "Cuota 6 de 6",
      totalCobrado: 1083.00,
      capitalRecuperado: 833.00,
      interesCobrado: 250.00,
      inversionistaId: "INV-003",
      inversionistaNombre: "Lcdo. Marco Silva Cárdenas",
      montoInteresAtribuido: 250.00,
      estadoAtribucion: "efectivamente_cobrado",
      comprobanteRecibo: "REC-PAG-0279"
    },
    {
      id: "REC-007",
      fechaCobro: "2026-09-25",
      prestamoId: "PREST-1140",
      clienteNombre: "Comercializadora AgroSur Cía.",
      cuotaNumero: "Cuota 4 de 12",
      totalCobrado: 2266.00,
      capitalRecuperado: 1766.00,
      interesCobrado: 500.00,
      inversionistaId: "INV-004",
      inversionistaNombre: "Valores & Capitales Futuro Cía. Ltda.",
      montoInteresAtribuido: 500.00,
      estadoAtribucion: "efectivamente_cobrado",
      comprobanteRecibo: "REC-PAG-0412"
    }
  ],

  // Obligaciones y Rendimientos Devengados según Acuerdos Contractuales
  obligaciones: [
    {
      id: "OBL-001",
      inversionistaId: "INV-001",
      inversionistaNombre: "Ing. Roberto Andrade Carrión",
      periodo: "Enero - Febrero 2026",
      baseCalculoCapital: 8000.00,
      tasaPactadaMensual: 3.5,
      montoRendimiento: 280.00, // $8,000 * 3.5% = $280.00
      fechaCorte: "2026-02-15",
      fechaVencimientoPago: "2026-02-18",
      estado: "pagado",
      fechaPagoRealizado: "2026-02-17",
      pagoIdRef: "PAG-INV-001"
    },
    {
      id: "OBL-002",
      inversionistaId: "INV-001",
      inversionistaNombre: "Ing. Roberto Andrade Carrión",
      periodo: "Septiembre - Octubre 2026",
      baseCalculoCapital: 8000.00,
      tasaPactadaMensual: 3.5,
      montoRendimiento: 280.00,
      fechaCorte: "2026-10-15",
      fechaVencimientoPago: "2026-10-18",
      estado: "pendiente",
      fechaPagoRealizado: null,
      pagoIdRef: null
    },
    {
      id: "OBL-003",
      inversionistaId: "INV-002",
      inversionistaNombre: "Dra. Elena Valdivieso Morales",
      periodo: "Mayo - Junio 2026 (Rendimiento + Cuota Capital)",
      baseCalculoCapital: 15000.00,
      tasaPactadaMensual: 3.0,
      montoRendimiento: 450.00, // $15,000 * 3% = $450
      devolucionCapitalPactada: 2500.00,
      montoTotalObligacion: 2950.00,
      fechaCorte: "2026-06-30",
      fechaVencimientoPago: "2026-07-05",
      estado: "pagado",
      fechaPagoRealizado: "2026-07-04",
      pagoIdRef: "PAG-INV-002"
    },
    {
      id: "OBL-004",
      inversionistaId: "INV-002",
      inversionistaNombre: "Dra. Elena Valdivieso Morales",
      periodo: "Septiembre - Octubre 2026",
      baseCalculoCapital: 12500.00, // Capital remanente tras devolución de $2,500
      tasaPactadaMensual: 3.0,
      montoRendimiento: 375.00, // $12,500 * 3% = $375
      devolucionCapitalPactada: 0.00,
      montoTotalObligacion: 375.00,
      fechaCorte: "2026-10-30",
      fechaVencimientoPago: "2026-11-04",
      estado: "pendiente",
      fechaPagoRealizado: null,
      pagoIdRef: null
    },
    {
      id: "OBL-005",
      inversionistaId: "INV-003",
      inversionistaNombre: "Lcdo. Marco Silva Cárdenas",
      periodo: "Septiembre - Octubre 2026",
      baseCalculoCapital: 4000.00,
      tasaPactadaMensual: 4.0,
      montoRendimiento: 160.00, // $4,000 * 4% = $160
      devolucionCapitalPactada: 0.00,
      montoTotalObligacion: 160.00,
      fechaCorte: "2026-10-15",
      fechaVencimientoPago: "2026-10-18",
      estado: "pendiente",
      fechaPagoRealizado: null,
      pagoIdRef: null
    },
    {
      id: "OBL-006",
      inversionistaId: "INV-004",
      inversionistaNombre: "Valores & Capitales Futuro Cía. Ltda.",
      periodo: "Septiembre - Octubre 2026",
      baseCalculoCapital: 25000.00,
      tasaPactadaMensual: 2.8,
      montoRendimiento: 700.00, // $25,000 * 2.8% = $700
      devolucionCapitalPactada: 0.00,
      montoTotalObligacion: 700.00,
      fechaCorte: "2026-10-20",
      fechaVencimientoPago: "2026-10-23",
      estado: "pendiente",
      fechaPagoRealizado: null,
      pagoIdRef: null
    }
  ],

  // Pagos y Devoluciones Ejecutados a Inversionistas
  pagosInversionistas: [
    {
      id: "PAG-INV-001",
      inversionistaId: "INV-001",
      inversionistaNombre: "Ing. Roberto Andrade Carrión",
      tipoPago: "rendimiento",
      concepto: "Pago de Rendimiento Período Ene-Feb 2026 (Tasa 3.5%)",
      montoTotal: 280.00,
      desglose: {
        capitalDevuelto: 0.00,
        rendimientoNeto: 280.00,
        retencionImpuesto: 0.00
      },
      fechaPago: "2026-02-17",
      cuentaOrigenFinova: "Banco Pichincha - Cta Corriente #2100892019",
      cuentaDestinoInversionista: "Banco Pichincha - Cta Cte #2100489234",
      numeroTransferencia: "TRANSF-OUT-99210",
      comprobanteUrl: "#",
      estado: "confirmado",
      aprobadoPor: "Gerencia Financiera (Carlos Rivas)",
      observaciones: "Pago mensual acordado en contrato CONTR-2026-014."
    },
    {
      id: "PAG-INV-002",
      inversionistaId: "INV-002",
      inversionistaNombre: "Dra. Elena Valdivieso Morales",
      tipoPago: "mixto", // Capital + Rendimiento
      concepto: "Devolución Parcial de Capital ($2,500) + Rendimiento Mayo-Junio ($450)",
      montoTotal: 2950.00,
      desglose: {
        capitalDevuelto: 2500.00,
        rendimientoNeto: 450.00,
        retencionImpuesto: 0.00
      },
      fechaPago: "2026-07-04",
      cuentaOrigenFinova: "Banco Guayaquil - Cta Cte #109283719",
      cuentaDestinoInversionista: "Banco Guayaquil - Ahorros #0014872930",
      numeroTransferencia: "TRANSF-OUT-104921",
      comprobanteUrl: "#",
      estado: "confirmado",
      aprobadoPor: "Gerencia Financiera (Carlos Rivas)",
      observaciones: "Amortización trimestral de capital según anexo contractual 2."
    },
    {
      id: "PAG-INV-003",
      inversionistaId: "INV-003",
      inversionistaNombre: "Lcdo. Marco Silva Cárdenas",
      tipoPago: "capital",
      concepto: "Devolución Parcial de Capital Solicitada",
      montoTotal: 1000.00,
      desglose: {
        capitalDevuelto: 1000.00,
        rendimientoNeto: 0.00,
        retencionImpuesto: 0.00
      },
      fechaPago: "2026-08-15",
      cuentaOrigenFinova: "Banco Pichincha - Cta Corriente #2100892019",
      cuentaDestinoInversionista: "Banco del Austro - Cta Cte #3004921102",
      numeroTransferencia: "TRANSF-OUT-119280",
      comprobanteUrl: "#",
      estado: "confirmado",
      aprobadoPor: "Gerencia Financiera (Carlos Rivas)",
      observaciones: "Retiro voluntario parcial con preaviso de 15 días."
    }
  ],

  // Libro Mayor / Extracto de Movimientos
  libroMayor: [
    {
      id: "LIB-001",
      fecha: "2026-01-15",
      inversionistaId: "INV-001",
      inversionistaNombre: "Roberto Andrade",
      tipoMovimiento: "Aporte Capital (+)",
      referencia: "APO-001",
      monto: 8000.00,
      saldoCapital: 8000.00,
      saldoRendimientos: 0.00,
      glosa: "Ingreso de capital fresco a cuenta FINOVA Banco Pichincha",
      estado: "confirmado"
    },
    {
      id: "LIB-002",
      fecha: "2026-01-20",
      inversionistaId: "INV-001",
      inversionistaNombre: "Roberto Andrade",
      tipoMovimiento: "Asignación Préstamo",
      referencia: "ASIG-001 / PREST-1049",
      monto: 1200.00,
      saldoCapital: 8000.00,
      saldoRendimientos: 0.00,
      glosa: "Fondeo a crédito Carlos Mendoza ($1,200 al 20% mensual)",
      estado: "confirmado"
    },
    {
      id: "LIB-003",
      fecha: "2026-02-05",
      inversionistaId: "INV-001",
      inversionistaNombre: "Roberto Andrade",
      tipoMovimiento: "Asignación Préstamo",
      referencia: "ASIG-002 / PREST-1052",
      monto: 800.00,
      saldoCapital: 8000.00,
      saldoRendimientos: 0.00,
      glosa: "Fondeo a crédito Andrea Torres ($800 al 20% mensual)",
      estado: "confirmado"
    },
    {
      id: "LIB-004",
      fecha: "2026-02-15",
      inversionistaId: "INV-001",
      inversionistaNombre: "Roberto Andrade",
      tipoMovimiento: "Rendimiento Devengado (+)",
      referencia: "OBL-001",
      monto: 280.00,
      saldoCapital: 8000.00,
      saldoRendimientos: 280.00,
      glosa: "Corte mensual según acuerdo 3.5% mensual sobre $8,000",
      estado: "confirmado"
    },
    {
      id: "LIB-005",
      fecha: "2026-02-17",
      inversionistaId: "INV-001",
      inversionistaNombre: "Roberto Andrade",
      tipoMovimiento: "Pago Rendimiento (-)",
      referencia: "PAG-INV-001",
      monto: 280.00,
      saldoCapital: 8000.00,
      saldoRendimientos: 0.00,
      glosa: "Liquidación bancaria de rendimientos transferida a Banco Pichincha",
      estado: "confirmado"
    },
    {
      id: "LIB-006",
      fecha: "2026-02-01",
      inversionistaId: "INV-002",
      inversionistaNombre: "Elena Valdivieso",
      tipoMovimiento: "Aporte Capital (+)",
      referencia: "APO-002",
      monto: 15000.00,
      saldoCapital: 15000.00,
      saldoRendimientos: 0.00,
      glosa: "Ingreso de capital con cheque gerencia Banco Guayaquil",
      estado: "confirmado"
    },
    {
      id: "LIB-007",
      fecha: "2026-07-04",
      inversionistaId: "INV-002",
      inversionistaNombre: "Elena Valdivieso",
      tipoMovimiento: "Devolución Capital (-)",
      referencia: "PAG-INV-002",
      monto: 2500.00,
      saldoCapital: 12500.00,
      saldoRendimientos: 0.00,
      glosa: "Amortización de capital acordada en contrato",
      estado: "confirmado"
    }
  ],

  // Auditoría y Bitácora de Trazabilidad Inmutable
  auditoria: [
    {
      id: "AUD-001",
      fechaHora: "2026-01-15 09:30:14",
      usuario: "carlos.rivas@finova.ec",
      rol: "Gerente General",
      modulo: "Aportes de Capital",
      accion: "REGISTRO_APORTE",
      descripcion: "Se registró el aporte de $8,000.00 para Ing. Roberto Andrade (Comprobante TRANSF-8849201).",
      ip: "190.152.120.44",
      reversado: false
    },
    {
      id: "AUD-002",
      fechaHora: "2026-01-20 11:15:02",
      usuario: "carlos.rivas@finova.ec",
      rol: "Gerente General",
      modulo: "Asignación de Fondos",
      accion: "ASIGNACION_PRESTAMO",
      descripcion: "Se asignaron $1,200.00 del aporte APO-001 al préstamo PREST-1049 de Carlos Mendoza.",
      ip: "190.152.120.44",
      reversado: false
    },
    {
      id: "AUD-003",
      fechaHora: "2026-02-17 16:40:22",
      usuario: "ana.martinez@finova.ec",
      rol: "Jefa de Tesorería",
      modulo: "Pagos a Inversionistas",
      accion: "LIQUIDACION_RENDIMIENTO",
      descripcion: "Se ejecutó transferencia bancaria por $280.00 a favor de Roberto Andrade.",
      ip: "190.152.120.50",
      reversado: false
    },
    {
      id: "AUD-004",
      fechaHora: "2026-07-04 10:18:30",
      usuario: "ana.martinez@finova.ec",
      rol: "Jefa de Tesorería",
      modulo: "Devoluciones de Capital",
      accion: "DEVOLUCION_CAPITAL",
      descripcion: "Transferencia de amortización de capital de $2,500.00 a Dra. Elena Valdivieso.",
      ip: "190.152.120.50",
      reversado: false
    }
  ]
};

// Utilidades del simulador
class FinovaDataStore {
  constructor() {
    const saved = localStorage.getItem("FINOVA_INVESTOR_DATA_V1");
    if (saved) {
      try {
        this.data = JSON.parse(saved);
      } catch (e) {
        this.data = JSON.parse(JSON.stringify(FINOVA_INITIAL_DATA));
      }
    } else {
      this.data = JSON.parse(JSON.stringify(FINOVA_INITIAL_DATA));
      this.save();
    }
  }

  save() {
    localStorage.setItem("FINOVA_INVESTOR_DATA_V1", JSON.stringify(this.data));
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(FINOVA_INITIAL_DATA));
    this.save();
  }

  // Métodos de consulta
  getEmpresa() {
    return this.data.empresa;
  }

  getInversionistas() {
    return this.data.inversionistas;
  }

  getInversionistaById(id) {
    return this.data.inversionistas.find(inv => inv.id === id);
  }

  getAportes() {
    return this.data.aportes;
  }

  getAportesByInversionista(invId) {
    return this.data.aportes.filter(a => a.inversionistaId === invId);
  }

  getAsignaciones() {
    return this.data.asignaciones;
  }

  getPrestamosFinova() {
    return this.data.prestamosFinova;
  }

  getRecuperacionCobros() {
    return this.data.recuperacionCobros;
  }

  getObligaciones() {
    return this.data.obligaciones;
  }

  getPagosInversionistas() {
    return this.data.pagosInversionistas;
  }

  getLibroMayor() {
    return this.data.libroMayor;
  }

  getAuditoria() {
    return this.data.auditoria;
  }

  // Operaciones de negocio
  agregarInversionista(nuevo) {
    const id = `INV-${String(this.data.inversionistas.length + 1).padStart(3, '0')}`;
    const inv = {
      id,
      nombre: nuevo.nombre,
      tipoDocumento: nuevo.tipoDocumento || "Cédula",
      documento: nuevo.documento,
      tipoPersona: nuevo.tipoPersona || "Natural",
      email: nuevo.email,
      telefono: nuevo.telefono,
      ciudad: nuevo.ciudad || "Quito, Ecuador",
      direccion: nuevo.direccion || "Av. Principal",
      bancoDestino: nuevo.bancoDestino || "Banco Pichincha",
      tipoCuenta: nuevo.tipoCuenta || "Ahorros",
      numeroCuenta: nuevo.numeroCuenta || "0000000000",
      titularCuenta: nuevo.titularCuenta || nuevo.nombre,
      fechaRegistro: new Date().toISOString().split('T')[0],
      estado: "activo",
      calificacionRiesgo: nuevo.calificacionRiesgo || "Estándar B",
      totalAportado: 0.00,
      capitalAsignadoPrestamos: 0.00,
      capitalOtrosUsos: 0.00,
      capitalDevuelto: 0.00,
      capitalPendiente: 0.00,
      acuerdoVigente: {
        id: `ACU-${String(this.data.inversionistas.length + 1).padStart(3, '0')}`,
        codigo: `CONTR-2026-${String(Math.floor(Math.random() * 800) + 100)}`,
        tasaMensualPactada: parseFloat(nuevo.tasaMensualPactada) || 3.0,
        modalidadPago: nuevo.modalidadPago || "Interés mensual, Capital al vencimiento",
        frecuenciaPago: "Mensual",
        plazoMeses: parseInt(nuevo.plazoMeses) || 12,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaVencimiento: nuevo.fechaVencimiento || "2027-10-14",
        garantiaPactada: nuevo.garantiaPactada || "Pagaré a la orden",
        diaCorte: parseInt(nuevo.diaCorte) || 15
      },
      interesesCobradosCartera: 0.00,
      rendimientoDevengado: 0.00,
      rendimientoPagado: 0.00,
      rendimientoPendiente: 0.00,
      proximoVencimiento: "2026-11-15",
      notas: nuevo.notas || "Nuevo inversionista registrado."
    };

    this.data.inversionistas.unshift(inv);
    
    // Log auditoría
    this.registrarAuditoria("Inversionistas", "CREAR_INVERSIONISTA", `Se dio de alta el expediente de ${inv.nombre} (${inv.id}).`);
    this.save();
    return inv;
  }

  agregarAporte(datos) {
    const inv = this.getInversionistaById(datos.inversionistaId);
    if (!inv) throw new Error("Inversionista no encontrado");

    const id = `APO-${String(this.data.aportes.length + 1).padStart(3, '0')}`;
    const monto = parseFloat(datos.monto);

    const aporte = {
      id,
      inversionistaId: inv.id,
      inversionistaNombre: inv.nombre,
      monto,
      fechaAporte: datos.fechaAporte || new Date().toISOString().split('T')[0],
      cuentaReceptoraFinova: datos.cuentaReceptoraFinova || "Banco Pichincha - Cta Cte #2100892019",
      medioPago: datos.medioPago || "Transferencia Interbancaria",
      numeroComprobante: datos.numeroComprobante || `DEP-${Date.now().toString().slice(-6)}`,
      comprobanteUrl: "#",
      estado: "confirmado",
      capitalAsignadoPrestamos: 0.00,
      capitalOtrosUsos: 0.00,
      estadoAsignacion: "pendiente_asignar",
      registradoPor: "Admin FINOVA",
      observaciones: datos.observaciones || "Aporte de capital."
    };

    this.data.aportes.unshift(aporte);

    // Actualizar saldos del inversionista
    inv.totalAportado += monto;
    inv.capitalPendiente += monto;

    // Actualizar saldos generales empresa
    this.data.empresa.capitalTotalRecibido += monto;
    this.data.empresa.capitalPendienteDevolucion += monto;

    // Asiento Libro Mayor
    this.data.libroMayor.unshift({
      id: `LIB-${String(this.data.libroMayor.length + 1).padStart(3, '0')}`,
      fecha: aporte.fechaAporte,
      inversionistaId: inv.id,
      inversionistaNombre: inv.nombre,
      tipoMovimiento: "Aporte Capital (+)",
      referencia: aporte.id,
      monto,
      saldoCapital: inv.capitalPendiente,
      saldoRendimientos: inv.rendimientoPendiente,
      glosa: `Aporte recibido mediante ${aporte.medioPago} Ref: ${aporte.numeroComprobante}`,
      estado: "confirmado"
    });

    this.registrarAuditoria("Aportes de Capital", "REGISTRO_APORTE", `Aporte de $${monto.toFixed(2)} registrado para ${inv.nombre}.`);
    this.save();
    return aporte;
  }

  asignarFondos(datos) {
    const aporte = this.data.aportes.find(a => a.id === datos.aporteId);
    if (!aporte) throw new Error("Aporte no encontrado");
    const inv = this.getInversionistaById(aporte.inversionistaId);

    const monto = parseFloat(datos.monto);
    const tipo = datos.tipoDestino; // 'prestamo' o 'otros_usos'

    const id = `ASIG-${String(this.data.asignaciones.length + 1).padStart(3, '0')}`;
    const nuevaAsig = {
      id,
      aporteId: aporte.id,
      inversionistaId: inv.id,
      tipoDestino: tipo,
      referenciaId: datos.referenciaId,
      destinoNombre: datos.destinoNombre,
      monto,
      fecha: datos.fecha || new Date().toISOString().split('T')[0],
      justificacion: datos.justificacion || "Asignación de fondos",
      registradoPor: "Admin FINOVA"
    };

    this.data.asignaciones.unshift(nuevaAsig);

    if (tipo === 'prestamo') {
      aporte.capitalAsignadoPrestamos += monto;
      inv.capitalAsignadoPrestamos += monto;
      this.data.empresa.capitalAsignadoPrestamos += monto;

      // Actualizar el préstamo si existe
      const prestamo = this.data.prestamosFinova.find(p => p.id === datos.referenciaId);
      if (prestamo) {
        prestamo.inversionistaFondeadorId = inv.id;
        prestamo.inversionistaNombre = inv.nombre;
        prestamo.montoFondeado = (prestamo.montoFondeado || 0) + monto;
        prestamo.porcentajeFondeo = Math.min(100, Math.round((prestamo.montoFondeado / prestamo.montoOriginal) * 100));
        prestamo.estado = prestamo.porcentajeFondeo >= 100 ? "activo" : "fondeo_parcial";
      }
    } else {
      aporte.capitalOtrosUsos += monto;
      inv.capitalOtrosUsos += monto;
      this.data.empresa.capitalOtrosUsos += monto;
    }

    const totalAsignado = aporte.capitalAsignadoPrestamos + aporte.capitalOtrosUsos;
    if (totalAsignado >= aporte.monto) {
      aporte.estadoAsignacion = "completamente_asignado";
    } else {
      aporte.estadoAsignacion = "parcialmente_asignado";
    }

    this.data.libroMayor.unshift({
      id: `LIB-${String(this.data.libroMayor.length + 1).padStart(3, '0')}`,
      fecha: nuevaAsig.fecha,
      inversionistaId: inv.id,
      inversionistaNombre: inv.nombre,
      tipoMovimiento: tipo === 'prestamo' ? "Asignación Préstamo" : "Asignación Otros Usos",
      referencia: `${nuevaAsig.id} / ${nuevaAsig.referenciaId}`,
      monto,
      saldoCapital: inv.capitalPendiente,
      saldoRendimientos: inv.rendimientoPendiente,
      glosa: `Destino: ${nuevaAsig.destinoNombre}. ${nuevaAsig.justificacion}`,
      estado: "confirmado"
    });

    this.registrarAuditoria("Asignación de Fondos", "ASIGNACION_CAPITAL", `Se asignaron $${monto.toFixed(2)} de ${inv.nombre} a ${nuevaAsig.destinoNombre}.`);
    this.save();
    return nuevaAsig;
  }

  registrarPagoInversionista(datos) {
    const inv = this.getInversionistaById(datos.inversionistaId);
    if (!inv) throw new Error("Inversionista no encontrado");

    const idPago = `PAG-INV-${String(this.data.pagosInversionistas.length + 1).padStart(3, '0')}`;
    const montoTotal = parseFloat(datos.montoTotal);
    const montoCapital = parseFloat(datos.montoCapital || 0);
    const montoRendimiento = parseFloat(datos.montoRendimiento || 0);

    const pago = {
      id: idPago,
      inversionistaId: inv.id,
      inversionistaNombre: inv.nombre,
      tipoPago: datos.tipoPago, // 'rendimiento', 'capital', 'mixto'
      concepto: datos.concepto || `Liquidación a favor de ${inv.nombre}`,
      montoTotal,
      desglose: {
        capitalDevuelto: montoCapital,
        rendimientoNeto: montoRendimiento,
        retencionImpuesto: 0.00
      },
      fechaPago: datos.fechaPago || new Date().toISOString().split('T')[0],
      cuentaOrigenFinova: datos.cuentaOrigenFinova || "Banco Pichincha - Cta Corriente #2100892019",
      cuentaDestinoInversionista: `${inv.bancoDestino} - ${inv.tipoCuenta} #${inv.numeroCuenta}`,
      numeroTransferencia: datos.numeroTransferencia || `TRANSF-OUT-${Date.now().toString().slice(-5)}`,
      comprobanteUrl: "#",
      estado: "confirmado",
      aprobadoPor: "Gerencia Financiera",
      observaciones: datos.observaciones || "Liquidación procesada correctamente."
    };

    this.data.pagosInversionistas.unshift(pago);

    // Actualizar saldos del inversionista
    if (montoCapital > 0) {
      inv.capitalDevuelto += montoCapital;
      inv.capitalPendiente = Math.max(0, inv.capitalPendiente - montoCapital);
      this.data.empresa.capitalDevueltoTotal += montoCapital;
      this.data.empresa.capitalPendienteDevolucion = Math.max(0, this.data.empresa.capitalPendienteDevolucion - montoCapital);
    }

    if (montoRendimiento > 0) {
      inv.rendimientoPagado += montoRendimiento;
      inv.rendimientoPendiente = Math.max(0, inv.rendimientoPendiente - montoRendimiento);
      this.data.empresa.rendimientosPagadosTotal += montoRendimiento;
      this.data.empresa.rendimientosPendientesPago = Math.max(0, this.data.empresa.rendimientosPendientesPago - montoRendimiento);
    }

    // Actualizar obligación si vino vinculada
    if (datos.obligacionId) {
      const obl = this.data.obligaciones.find(o => o.id === datos.obligacionId);
      if (obl) {
        obl.estado = "pagado";
        obl.fechaPagoRealizado = pago.fechaPago;
        obl.pagoIdRef = pago.id;
      }
    }

    // Registrar en Libro Mayor
    this.data.libroMayor.unshift({
      id: `LIB-${String(this.data.libroMayor.length + 1).padStart(3, '0')}`,
      fecha: pago.fechaPago,
      inversionistaId: inv.id,
      inversionistaNombre: inv.nombre,
      tipoMovimiento: montoCapital > 0 && montoRendimiento > 0 ? "Pago Mixto (Cap+Rend) (-)" : (montoCapital > 0 ? "Devolución Capital (-)" : "Pago Rendimiento (-)"),
      referencia: pago.id,
      monto: montoTotal,
      saldoCapital: inv.capitalPendiente,
      saldoRendimientos: inv.rendimientoPendiente,
      glosa: `${pago.concepto}. Ref: ${pago.numeroTransferencia}`,
      estado: "confirmado"
    });

    this.registrarAuditoria("Pagos y Devoluciones", "PAGO_INVERSIONISTA", `Se ejecutó pago por $${montoTotal.toFixed(2)} (Cap: $${montoCapital.toFixed(2)}, Rend: $${montoRendimiento.toFixed(2)}) a ${inv.nombre}.`);
    this.save();
    return pago;
  }

  generarCorteDevengado(inversionistaId) {
    const inv = this.getInversionistaById(inversionistaId);
    if (!inv) throw new Error("Inversionista no encontrado");

    const tasa = inv.acuerdoVigente.tasaMensualPactada;
    const base = inv.capitalPendiente;
    const rendimiento = parseFloat(((base * tasa) / 100).toFixed(2));

    const idObl = `OBL-${String(this.data.obligaciones.length + 1).padStart(3, '0')}`;
    const hoy = new Date();
    const fechaCorte = hoy.toISOString().split('T')[0];
    const fechaVenc = new Date(hoy.setDate(hoy.getDate() + 5)).toISOString().split('T')[0];

    const nuevaObl = {
      id: idObl,
      inversionistaId: inv.id,
      inversionistaNombre: inv.nombre,
      periodo: `Corte Mensual ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
      baseCalculoCapital: base,
      tasaPactadaMensual: tasa,
      montoRendimiento: rendimiento,
      devolucionCapitalPactada: 0.00,
      montoTotalObligacion: rendimiento,
      fechaCorte,
      fechaVencimientoPago: fechaVenc,
      estado: "pendiente",
      fechaPagoRealizado: null,
      pagoIdRef: null
    };

    this.data.obligaciones.unshift(nuevaObl);
    inv.rendimientoDevengado += rendimiento;
    inv.rendimientoPendiente += rendimiento;
    this.data.empresa.rendimientosDevengadosTotal += rendimiento;
    this.data.empresa.rendimientosPendientesPago += rendimiento;

    this.data.libroMayor.unshift({
      id: `LIB-${String(this.data.libroMayor.length + 1).padStart(3, '0')}`,
      fecha: fechaCorte,
      inversionistaId: inv.id,
      inversionistaNombre: inv.nombre,
      tipoMovimiento: "Rendimiento Devengado (+)",
      referencia: nuevaObl.id,
      monto: rendimiento,
      saldoCapital: inv.capitalPendiente,
      saldoRendimientos: inv.rendimientoPendiente,
      glosa: `Devengo contractual: ${tasa}% mensual sobre capital pendiente de $${base.toFixed(2)}`,
      estado: "confirmado"
    });

    this.registrarAuditoria("Obligaciones y Rendimientos", "DEVENGAR_RENDIMIENTO", `Devengo generado: $${rendimiento.toFixed(2)} para ${inv.nombre}.`);
    this.save();
    return nuevaObl;
  }

  reversarMovimiento(referenciaId, motivo) {
    // Buscar en libro mayor
    const asiento = this.data.libroMayor.find(l => l.referencia.includes(referenciaId) || l.id === referenciaId);
    if (!asiento) throw new Error("Movimiento no encontrado para reversión");
    if (asiento.estado === "reversado") throw new Error("El movimiento ya ha sido reversado previamente");

    asiento.estado = "reversado";
    const inv = this.getInversionistaById(asiento.inversionistaId);

    // Crear contra-asiento de reverso
    const contraAsientoId = `LIB-${String(this.data.libroMayor.length + 1).padStart(3, '0')}`;
    this.data.libroMayor.unshift({
      id: contraAsientoId,
      fecha: new Date().toISOString().split('T')[0],
      inversionistaId: asiento.inversionistaId,
      inversionistaNombre: asiento.inversionistaNombre,
      tipoMovimiento: `REVERSO [${asiento.tipoMovimiento}]`,
      referencia: `REV-${referenciaId}`,
      monto: -asiento.monto,
      saldoCapital: inv ? inv.capitalPendiente : 0,
      saldoRendimientos: inv ? inv.rendimientoPendiente : 0,
      glosa: `Contra-asiento por reverso de ${asiento.id}. Motivo justificado: ${motivo}`,
      estado: "confirmado"
    });

    this.registrarAuditoria("Auditoría y Reversiones", "REVERSO_CONTABLE", `Se reversó el movimiento ${asiento.id} (${asiento.tipoMovimiento}) por $${asiento.monto}. Motivo: ${motivo}`);
    this.save();
    return true;
  }

  registrarAuditoria(modulo, accion, descripcion) {
    const log = {
      id: `AUD-${String(this.data.auditoria.length + 1).padStart(3, '0')}`,
      fechaHora: new Date().toISOString().replace('T', ' ').slice(0, 19),
      usuario: "carlos.rivas@finova.ec",
      rol: "Administrador / Gerente",
      modulo,
      accion,
      descripcion,
      ip: "190.152.120.44",
      reversado: false
    };
    this.data.auditoria.unshift(log);
  }
};

window.finovaStore = new FinovaDataStore();
