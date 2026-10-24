# Experiencia operativa

## Alcance de esta entrega

- Búsqueda por nombre e identificación, filtros persistentes por usuario y financiera, paginación de pantalla y tarjetas móviles en clientes, créditos y cobros.
- Eliminación de clientes con botón de solo ícono, nombre accesible y confirmación con protección del historial.
- Crédito en dos pasos: condiciones y revisión del cronograma. Distribución de centavos sin pérdida de capital en créditos nuevos; no modifica cronogramas existentes.
- Revisión del cobro antes de guardar, separación entre recibo registrado y correo aceptado, y acceso al recibo.
- Perfil editable sin cambios de rol, correo o financiera; indicador interno con motivo y auditoría; suspensión de financiera con motivo y control de concurrencia.
- Agenda de solicitudes, seguimiento y cobranza con asignación, historial, idempotencia y paginación desde el servidor. No aprueba créditos, registra cobros ni envía comunicaciones.
- Mora calculada con saldo pendiente y fecha de negocio; errores de consulta visibles; vista previa de reportes con alcance de cada indicador.
- Recuperación de contraseña y QR de segundo factor generado localmente.

La paginación de las listas tradicionales limita lo mostrado en pantalla, no las lecturas de Firebase. La agenda sí usa cursores del servidor.

## Despliegue

Publicar los índices adicionales conservando los cuatro índices existentes. Ejecutar las pruebas de seguridad, integración de API, capital, contabilidad, búsqueda y respaldos, además de TypeScript y compilación. No activar contabilidad por variables de producción: sus rutas rechazan explícitamente VERCEL_ENV=production.

## Cooperativa de ahorro en Ecuador

El núcleo contable y el simulador de ahorro permanecen exclusivamente en laboratorio. No hay apertura de cuentas ni depósitos o retiros reales en esta entrega. No se convierte automáticamente el historial.

Pendientes para una siguiente entrega: caja y gastos con cierre y conciliación, unificación de fuentes de financiamiento, registro de socios y productos de ahorro, integración contable con créditos y saldos iniciales conciliados. El catálogo y los controles regulatorios deben validarse para la entidad antes de activar operaciones reales. También quedan pendientes aplicaciones de campo sin conexión y conexiones bancarias.

La configuración del remitente corporativo y los respaldos diarios administrados siguen pendientes por decisión del usuario. Los respaldos locales cifrados no equivalen a recuperación continua ni a una instantánea consistente de toda la base.
