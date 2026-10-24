# Pagos de capital — entrega de pruebas

Esta entrega no está autorizada para producción. No modifica automáticamente aportes existentes ni incorpora la contabilidad de la etapa 2.

## Uso

1. Registrar el aporte realmente recibido, con referencia y confirmación del ingreso. Un aporte existente también puede vincularse sin volver a ingresarlo a caja.
2. Crear un plan: beneficiario, cuota mensual (por ejemplo USD 400), primer vencimiento y porcentaje de intereses elegibles que puede destinarse al compromiso.
3. Declarar si se devuelve solamente capital o capital más un costo total pactado. No se calcula una tasa financiera: el calendario distribuye proporcionalmente el total declarado y ajusta la última cuota.
4. Reservar intereses de cobros verificados. Reservar no registra una salida de dinero.
5. Después del desembolso real, registrar el pago, su fecha, origen, referencia y comprobante opcional. El sistema reduce la obligación y registra la salida.
6. Una restitución requiere que el dinero haya regresado realmente. Conserva el pago original y exige motivo y referencia; las restituciones de una cuota se realizan en orden inverso.

## Integridad

- Importes en centavos enteros y reparto acumulativo proporcional versionado. El capital recuperado no se ofrece como interés disponible.
- Cobros históricos parciales sin desglose verificable quedan pendientes de conciliación. No se inventan sus intereses.
- Operaciones atómicas e identificador de reintento para evitar duplicaciones. Reservas, pagos, restricciones por liquidez y restituciones mantienen trazabilidad.
- Aislamiento por financiera, permisos revisados en servidor y dentro de cada transacción. Cajeros pueden cobrar; dueños y administradores administran planes.
- Referencias obligatorias y archivos limitados al almacenamiento de la propia financiera. No se aceptan enlaces externos arbitrarios.
- Aportes y fuentes bancarias quedan protegidos contra edición directa cuando el control está habilitado. Una devolución no borra el aporte original.

## Alcance y límites

Los intereses cobrados no equivalen a utilidad neta. Existen apartados manuales para gastos y liquidez. Las reservas son presupuestarias; no bloquean una cuenta bancaria ni ejecutan transferencias. La disponibilidad se calcula desde los movimientos registrados y exige confirmación de disponibilidad física; no sustituye una conciliación bancaria. La originación de préstamos existente continúa funcionando y puede consumir liquidez.

El tablero y este módulo descuentan las salidas controladas; los demás informes históricos no constituyen todavía un mayor contable integrado. Esa integración corresponde a la etapa 2 y debe validarse antes de una activación productiva.

El calendario admite hasta 360 cuotas, la cobranza hasta 200 cuotas por préstamo y una reserva hasta 25 lotes. La vista limita los registros consultados y bloquea nuevas acciones y exportación si la información queda truncada. Antes de escalar deben añadirse paginación completa, cierres y conciliación con mayor contable. Las operaciones se serializan por financiera para proteger los saldos.

## Activación y pruebas

Requiere `FINOVA_CAPITAL_PAYMENTS_ENABLED=true`, `NEXT_PUBLIC_CAPITAL_PAYMENTS_ENABLED=true` y configuración del servidor `capital_settings/{empresaId}` con `enabled:true`, `currency:USD`, `policy:proporcional-v1`. No habilitar estos valores en producción sin una entrega autorizada y una conciliación inicial.

`npm run test:capital` verifica el núcleo y las rutas en emuladores. `npm run test:security` verifica las reglas y los flujos anteriores. El entorno local demostrativo requiere exclusivamente el proyecto `demo-finova`; nunca utiliza cuentas reales.
