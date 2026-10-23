# Etapa 2: núcleo contable de Finova

## Alcance de esta entrega

Moneda base USD, precisión de centavos enteros y fecha inicial obtenida del `fechaDesembolso` válido más antiguo **de cada financiera**. Se consultó el historial sin modificarlo y se comprobó que existen fechas iniciales distintas por empresa. No se usa una fecha global de otra empresa. Una empresa sin préstamos queda sin fecha hasta contar con una apertura documentada. Las fechas inválidas se señalan, no se reemplazan silenciosamente.

La pantalla Contabilidad incluye catálogo, balance de comprobación del libro nuevo, diario, diagnóstico del historial, saldos de ahorro y simulador de partida doble. El simulador solo usa memoria de la página; no envía operaciones ni crea documentos. Las cuentas e inversiones heredadas permanecen independientes del nuevo libro. Un balance vacío no equivale a que la empresa tenga patrimonio cero.

El núcleo servidor implementa apertura de cuentas individuales, depósitos, retiros, transferencias internas, bloqueos y liberaciones, asientos generales, reversos únicos y cierres con conciliación del pasivo de ahorro contra cuentas individuales. Son capacidades del motor verificadas en emuladores; los canales operativos de ahorro y sus pantallas transaccionales corresponden a la etapa 3.

## Invariantes

- Cada asiento tiene entre 2 y 40 líneas, cuentas reconocidas y débitos iguales a créditos. Se rechazan fracciones de centavo, valores no finitos y sumas fuera de los enteros seguros de JavaScript.
- Moneda única explícita USD. No hay conversión cambiaria ni mezcla de monedas.
- Un asiento publicado no se edita o borra. El reverso crea otro asiento y una relación única; no modifica el original, no revierte dos veces y respeta fondos disponibles.
- Los ahorros se representan en el pasivo 2101 y en una cuenta individual. Un asiento general no puede usar 2101 para eludir el saldo individual.
- Saldo disponible = saldo contable menos bloqueos. No se admiten saldos negativos ni bloqueos superiores al saldo.
- El diario, las cuentas individuales, los saldos del mayor y la clave de idempotencia se guardan en una sola transacción. Retiros simultáneos compiten por los mismos documentos y se revalidan al reintentar. El rechazo no deja efectos parciales.
- Cada solicitud usa una referencia idempotente. Repetirla con los mismos datos no duplica la operación; cambiar sus datos la invalida. El cliente debe conservar la misma referencia ante un reintento de red.
- Caja y bancos no pueden quedar con saldo acreedor. Las operaciones se registran en orden cronológico y no pueden preceder al inicio ni afectar un período cerrado. Un reverso se fecha en un período abierto, nunca antes del original.
- Los cierres verifican que el mayor cuadre y que el total de las cuentas individuales sea igual al pasivo de ahorro. Esto no sustituye arqueo físico ni conciliación contra extractos bancarios.
- Solo administradores de la misma financiera activa pueden utilizar la API. La transacción vuelve a comprobar perfil, rol y estado de empresa para atender suspensiones concurrentes. Ningún navegador, ni siquiera de superadmin, lee o escribe directamente las colecciones contables.

## Protección de producción

La publicación pone el módulo en **preparación**, con API de consulta y simulador disponibles. No se habilitó `FINOVA_ACCOUNTING_WRITES_ENABLED`. Además de esa autorización global del servidor, cada documento `accounting/{empresaId}` requiere `version: 1`, `currency: USD`, `enabled: true`, `startDate` válida, `openingReconciled: true` y `openingApprovedBy` registrado. No existe una API de navegador para activar esas condiciones.

No se crean saldos de apertura a partir de `saldoRestante`: el saldo contractual incluye intereses y no equivale al capital contable. La fecha más antigua define el inicio solicitado, pero no reconstruye hechos económicos que no están documentados. No se convierten contratos de inversionistas en depósitos de ahorro.

Las operaciones antiguas de préstamos y pagos siguen funcionando con su flujo actual y **todavía no generan asientos automáticamente**. El libro nuevo no debe usarse como balance institucional hasta completar la incorporación conciliada y el enlace atómico de esos flujos.

## Conciliación previa

La consulta compara, por préstamo, `totalPagar - suma(pagos.monto)` contra `saldoRestante`, siempre dentro de la misma financiera. Señala pagos sin crédito de esa empresa, importes inválidos, fracciones de centavo y diferencias de saldo. Muestra el total de observaciones y hasta 20 referencias, sin corregir registros. No certifica devengo, mora, principal, saldos bancarios ni procedencia de efectivo; una diferencia requiere explicación documental.

## Activación operativa pendiente

1. Confirmar el catálogo con el responsable contable y ampliarlo para obligaciones con inversionistas, intereses por cobrar, provisiones y otros rubros aplicables. El catálogo inicial es una base de implementación, no un plan regulatorio certificado.
2. Obtener extractos, arqueo y composición de cartera, obligaciones, patrimonio e intereses a la fecha inicial de cada empresa. Documentar diferencias del diagnóstico y su resolución sin borrar historia.
3. Preparar y aprobar los asientos de apertura y la incorporación histórica. Si el historial no permite reconstruir todo desde la fecha solicitada, documentar la limitación y acordar un corte verificable antes de activar; no inventar saldos.
4. Ensayar esa incorporación en un Firebase de staging aislado, con respaldo y comparación del antes/después. La recuperación de credenciales, custodia externa, correo y alertas de la etapa 1 siguen pendientes.
5. Integrar desembolso, cobro, fondeo, gasto y reverso heredados con el asiento en la **misma transacción de servidor**; retirar las escrituras financieras directas del navegador solo cuando todos los consumidores estén migrados. No usar disparadores posteriores como garantía de atomicidad.
6. Probar conciliación institucional, permisos y recuperación con responsables. Habilitar la escritura global y por financiera únicamente tras la apertura aprobada y esos enlaces; agregar doble aprobación y cajas durante la etapa 3.

## Verificación y límites

Pruebas del motor en `demo-finova` local: precisión, balance, concurrencia, idempotencia, bloqueos, transferencia, aislamiento, reversos, desactivación, apertura aprobada, cierre y orden cronológico. Las pruebas integradas de API comprueban autenticación, roles, fecha propia de empresa y bloqueo de escritura en preparación. Las reglas impiden escritura directa de datos contables para todos los roles. La CI repite estas pruebas y compila producción.

Los cierres y el diagnóstico consultan las cuentas o el historial completo de la empresa; la versión inicial es apropiada para validar el núcleo actual, no para declarar escalabilidad bancaria. El documento de configuración serializa las operaciones por empresa para proteger el orden y debe medirse antes de aumentar volumen. El diario visible muestra 50 asientos y la vista de ahorro 200 cuentas, con avisos de truncado. No son estados de cuenta completos ni un cierre exportable. La aprobación dual, caja por sucursal, intereses de ahorro y canales operativos se implementan después de la conciliación; esta entrega no autoriza captación de depósitos.

Rollback: volver a la aplicación anterior no requiere migrar o borrar datos heredados; no se cambió su esquema. Mantener desactivada la escritura contable. Si posteriormente se registran asientos reales, conservar el libro y la compatibilidad con sus controles; no eliminarlo como mecanismo de reversión.

## Evidencia de esta entrega

La aplicación pasó 56 comprobaciones: 13 del núcleo contable, 10 de reglas, 31 integradas de API, una de búsqueda y una de cifrado. La compilación y la CI de la aplicación aprobaron. En el navegador local se verificaron acceso con una cuenta ficticia, catálogo, detección de una diferencia contractual, simulación balanceada de USD 100.25 y rechazo de USD 1.001. Después de simular se comprobó que no existían documentos contables ni asientos en el emulador; la consola del navegador no mostró errores.

Se generó un respaldo cifrado actualizado de 215 documentos, 4 identidades y 5 archivos. Las huellas antes/después de diez colecciones de usuarios y operación coinciden. Los respaldos y sus claves permanecen excluidos de Git y de despliegues. La publicación de esta etapa está pendiente de autorización explícita: la revisión automática rechazó crear un despliegue de producción a partir de la solicitud general de iniciar la etapa 2. No se modificaron el dominio productivo, las reglas publicadas ni la rama main.

Para repetir la demostración local con datos ficticios: `firebase emulators:exec --config firebase.security-test.json --project demo-finova --only auth,firestore "node scripts/accounting-local-preview.mjs"`. El script exige esos emuladores y el proyecto demo, vacía las credenciales del proceso hijo y mantiene deshabilitada la escritura contable. Las credenciales sintéticas se muestran únicamente para acceder a esa demostración local.
