# Pagos de capital

El módulo está habilitado en producción para las financieras activas autorizadas en USD. No modifica automáticamente aportes existentes ni incorpora la contabilidad de la etapa 2.

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

Validación local de esta entrega: 15 pruebas del núcleo, 23 comprobaciones de API, 10 pruebas de reglas, 32 comprobaciones de compatibilidad y 2 pruebas de búsqueda/respaldo, todas satisfactorias. Compilación completa y revisión de tipos satisfactorias. En navegador se verificaron el ingreso ficticio, la navegación, la reserva de USD 400 sobre USD 600 de interés y el formulario de pago. El pago y la restitución se comprobaron con la API en emuladores, sin transferencias reales.

Para abrir la demostración, compilar primero con `npm run test:capital:compile` y ejecutar Firebase CLI con `emulators:exec --config firebase.security-test.json --project demo-finova --only auth,firestore,storage "node scripts/capital-local-preview.mjs"`. Usar `CI=true` evita la comprobación interactiva de actualizaciones del CLI. La cuenta y contraseña impresas son exclusivamente ficticias; los datos del emulador se pierden al cerrar el entorno.


## Capital inicial

El capital inicial es una fuente de fondos ya registrada. Se muestra separado de los intereses y puede vincularse a un plan mediante el origen reservado `finova-initial-capital-v1`. El servidor toma su importe desde `empresa.capitalInicial`, no desde el navegador. Crear el plan no modifica ese campo, no añade una inyección, no aumenta la caja y no crea una obligación automáticamente: requiere la confirmación del dueño. Solo admite un plan por capital inicial y financiera; aportes adicionales conservan su vinculación independiente. No se infiere una fecha de recepción a partir de la creación de la empresa.

## Interfaz adaptable

El encabezado muestra el nombre corto del perfil y su rol real. Usa `nombres` y `apellidos` cuando existen; los perfiles antiguos con un solo `nombre` completo se abreviarán suponiendo dos apellidos, conservando el nombre completo en la ayuda del encabezado. No modifica el nombre almacenado. El cierre de sesión es un icono en el encabezado con etiqueta accesible y confirmación. El menú táctil usa un diálogo con manejo de foco, cierre por Escape y navegación desplazable; se utiliza también en tablets menores de 1024 px.

Los formularios apilan sus columnas en teléfonos, las ventanas limitan su ancho y altura al área visible, las tablas mantienen su propio desplazamiento horizontal y los controles táctiles admiten un mínimo de 44 px. La revisión cubre tamaños de 375, 768 y 1024 px y un caso reducido de 320 px.
