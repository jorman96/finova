# Operación y transición segura

## Arquitectura

- Next.js App Router con Firebase Auth para empleados, Firestore y Storage.
- Las operaciones monetarias pasan por `POST /api/finance`: validación Zod, verificación del token revocado, perfil activo, rol, empresa activa, transacción, idempotencia y auditoría.
- El navegador no puede modificar préstamos, cuotas, pagos, saldos de inversionistas ni la bitácora financiera directamente.
- El portal usa códigos de seis dígitos de 10 minutos, hasta cinco intentos y sesiones opacas de una hora. Las sesiones se almacenan con el identificador hasheado y cookie HttpOnly/SameSite.
- El dashboard calcula un resumen en servidor y conserva una caché de 30 segundos, invalidada por la revisión financiera de la empresa. En un historial grande, la reconstrucción todavía requiere leer documentos históricos; conviene materializar acumulados diarios antes de un crecimiento importante.
- El service worker solo guarda recursos de `/_next/static/`. No ofrece operación financiera sin conexión.

## Configuración

Variables públicas de Firebase: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

Variables privadas: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. El remitente debe pertenecer a un dominio verificado. No se simulan envíos exitosos si faltan credenciales.

La zona de negocio se obtiene de `empresas.zonaHoraria`, con respaldo `America/Guayaquil`. La moneda se obtiene de la empresa. Los importes se reciben con hasta dos decimales; el cálculo y reparto monetario usa centavos.

## Permisos

- Superadministrador: administración de plataforma y empresas; las operaciones financieras se limitan a la empresa de su perfil.
- Dueño y administrador: gestión financiera de su empresa. Solo dueño y superadministrador pueden crear usuarios y exportar el respaldo completo.
- Cajero y cobrador: registro de cobros mediante servidor. No crean créditos ni modifican saldos directamente.
- Gestor y consulta: lecturas de cartera. Sin acceso a inversionistas, reportes gerenciales o configuración.
- El dueño no puede asignar roles de dueño o superadministrador. El perfil propio solo admite cambios personales, no rol, empresa o activación.

## Antes del despliegue

1. Exportar un respaldo administrativo de Firestore y Storage y probar una recuperación en un proyecto aislado. El botón de respaldo exporta documentos empresariales; no sustituye un backup administrado, no incluye Firebase Auth ni binarios de Storage y no es una instantánea transaccional entre colecciones.
2. Revisar los perfiles existentes: `activo` debe ser `true` solo para usuarios autorizados. Auditar todos los `superadmin`: la lógica anterior podía promover administradores. No se activan ni degradan perfiles automáticamente.
3. Ejecutar `node scripts/audit-data.mjs --empresa ID`. El modo predeterminado es lectura. Revisar `audit-data-report.json` y protegerlo porque contiene identificadores internos.
4. La opción `--apply` solo completa `anulado: false` y `fechaStr` ausentes en pagos. No modifica acuerdos, tasas, saldos, empresaId o roles. No se debe asumir que pagos antiguos tienen el reparto interés/capital correcto.
5. Conciliar pagos históricos antes de habilitar sus reversos. El servidor rechaza anular pagos sin `desgloseVersion: 1`. Las anulaciones nuevas se hacen en orden inverso de registro y conservan originales.
6. Migrar los archivos antiguos a `empresas/{empresaId}/...` con una herramienta administrativa revisada. Las reglas nuevas bloquean los antiguos caminos globales. Los enlaces de descarga que ya tengan token deben revocarse si fueron compartidos; cambiar reglas no revoca esos enlaces.
7. Confirmar moneda, zona horaria, cuentas y dominio remitente por empresa. El portal requiere un correo registrado para cada cliente.
8. Desplegar aplicación, índices y reglas durante una ventana coordinada. Las versiones anteriores del navegador ya no pueden escribir operaciones financieras directamente. Forzar recarga de clientes después del despliegue.
9. Configurar TTL de `expiresAt` en `portal_sessions`, `portal_challenges` y `rate_limits`. La expiración de acceso se valida incluso antes de que TTL borre los documentos.
10. Ejecutar pruebas de humo con un usuario de cada rol, comprobante real de prueba, entrega de correo, conciliación y descarga de reportes. El remitente y el bucket productivos no son validados por los emuladores.

Comandos de publicación, cuando el entorno haya sido revisado: `firebase deploy --only firestore:rules,firestore:indexes,storage` y el procedimiento de hosting del proyecto. Estos comandos no se ejecutan como parte de las pruebas locales.

## Semántica financiera

- Convención de tasa nominal comercial: anual / 12; mensual / 30 para diaria, / 4 para semanal y / 2 para quincenal. Se muestra antes de crear el crédito y se conserva en el contrato.
- Los vencimientos mensuales se calculan desde la fecha original; enero 31 produce febrero 28 y marzo 31. Quincenal significa cada 15 días.
- Las diferencias de redondeo se compensan en la última cuota. El capital de todas las cuotas coincide con el principal.
- Los abonos cubren primero el interés pendiente de cada cuota y luego capital, en orden de cuota. El reparto aplicado queda guardado en el pago. Cambiar esta política requiere versionarla; no se debe reinterpretar el historial.
- Mora: fecha de vencimiento anterior a la fecha de negocio, con saldo pendiente y cuota no anulada.
- Margen de intermediación: interés cobrado identificado menos interés comprometido del período. No es utilidad neta. Si faltan desgloses históricos no se calcula un margen estimado.
- Caja calculada: capital propio vigente + fondeo total + cobros vigentes − desembolsos no anulados − pagos a inversionistas + ingresos extraordinarios − gastos − retiros. Transferencias no cambian el total. Necesita conciliación contra banco/caja.
- La conciliación actual es una revisión manual con referencia; no es conexión bancaria automática.
- La proyección de 30 días es el calendario pendiente de clientes e inversionistas, no una garantía de cobro ni una proyección completa de gastos futuros.

## Correo y recuperación de fallas

Los recibos se construyen desde el pago real, no desde importes enviados por el navegador. Cobranza comprueba relaciones entre empresa, cliente, préstamo y cuota. `email_jobs` conserva estado, intentos y una concesión temporal para evitar envíos simultáneos. El proveedor recibe una clave de idempotencia estable. Un fallo de correo no revierte un pago guardado. Puede reintentarse el recibo desde el historial del préstamo. Los recordatorios se limitan por usuario y por día.

## Verificación local

Requiere Node 24, Java 21 y Firebase CLI 15.19.0 para emuladores.

```sh
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run test:rules
npm run test:integration
npm run build
```

`test:rules` y `test:integration` usan exclusivamente `demo-finova`, puertos locales 8088, 9098, 9198 y 3109. La suite integrada desactiva el correo y sustituye las credenciales de Firebase en el servidor hijo. No usa los datos productivos.

Los emuladores no validan la existencia de índices en producción, IAM, DNS del correo, entrega real, cuotas del proveedor o restauración de backups. Las pruebas de integración complementan las pruebas unitarias; no demuestran ausencia absoluta de fallas.
