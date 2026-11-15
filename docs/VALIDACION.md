# Entrega y validación local

## Cambios aplicados

- Roles y perfiles: retirada de promociones y creación de superadministradores desde navegador; validación de usuario y empresa activos; control de roles asignables; acceso visual acorde al rol.
- Firestore y Storage: separación por empresa, reglas para inversionistas y bloqueo de escrituras monetarias directas. Archivos nuevos bajo rutas empresariales con límite de tamaño y tipo.
- Portal: código de acceso por correo, intentos limitados, expiración, cookie HttpOnly y cierre real de sesión.
- Operaciones: API transaccional para préstamos, inversiones, cobros, pagos a inversionistas, aportes, anulaciones, ajustes de indicador y tesorería; claves de idempotencia y auditoría.
- Cobros: importes en centavos, reparto efectivo de capital/interés por abono y secuencia transaccional para anular en orden correcto, incluso con solicitudes simultáneas.
- Cronogramas: capital reconciliado en última cuota y fechas mensuales ancladas al día original. Contratos históricos no se recalculan automáticamente.
- Indicadores: mora derivada de fecha y saldo, fechas de negocio, cifras del período diferenciadas de históricas y ausencia de estimaciones arbitrarias para pagos antiguos.
- Operación: tesorería, gastos, retiros, transferencias, conciliación manual y proyección de compromisos de 30 días; respaldo empresarial en JSON.
- Consultas: paginación por cursor en clientes, préstamos, pagos y mora; resumen del dashboard en servidor con caché corta e invalidación financiera.
- Experiencia: menú móvil con manejo de foco de la biblioteca, recuperación de contraseña, vista previa de abonos, indicador de pago explicado, fechas correctas en tesorería y reintento de recibos.
- Dependencias: Next.js 16.4.1; exportación Excel con ExcelJS; retirada de la CLI y plugin PWA antiguos, conservando sus estilos locales con licencia. El service worker solo almacena recursos estáticos.
- Mantenimiento: documentación, auditoría de datos con modo de lectura predeterminado y flujo de CI para comprobaciones futuras.

## Pruebas ejecutadas

- 12 pruebas de dominio y Excel: principal exacto, suma de cuotas, fin de mes y año bisiesto, entrada inválida, abonos parciales, mora y zona horaria, inversiones pequeñas, roles, desglose histórico, destinos del proxy, generación/relectura de Excel e importación dinámica de ExcelJS.
- 6 pruebas de reglas con Firebase 12.19.0: modificación de roles, separación entre empresas, bloqueo de escrituras monetarias, acceso a empresa, privacidad de inversionistas y permisos/tipo/tamaño de Storage.
- 14 comprobaciones integradas con Next.js y emuladores: autenticación, usuario inactivo, rol cajero, acceso entre empresas, alta atómica de préstamo, reintento idempotente, cobros simultáneos, orden de reversos, exceso de pago, pagos a inversionistas concurrentes, restricción de superadministradores, correo y proxy, coincidencia de dashboard/mora/reportes, tesorería/conciliación/respaldo y sesión OTP/cierre del portal.
- Revisión visual con datos ficticios: ingreso del dueño, dashboard, menú móvil, navegación y tesorería en móvil y escritorio; pantalla de configuración de reportes.

El intento de comprobar la descarga de Excel desde el navegador se atascó y el servidor demo expiró. No se declara esa descarga como validada visualmente. Una comprobación adicional detectó la diferencia entre exportación CommonJS y carga dinámica; se corrigió y se añadió una prueba específica. La generación y relectura del archivo sí están verificadas automáticamente.

## Límites de la entrega

- No se desplegaron reglas ni aplicación y no se modificaron datos productivos.
- Antes de publicar se requieren revisión de perfiles, conciliación del historial sin desglose y migración de caminos antiguos de Storage. Ver `OPERACION.md`.
- El correo real y su dominio remitente necesitan una prueba en el entorno de destino; las suites desactivan los envíos externos.
- El respaldo JSON no incluye binarios ni Auth, no reemplaza copias administradas y no constituye una instantánea consistente entre colecciones.
- El dashboard aún reconstruye resúmenes leyendo el historial cuando no existe una caché válida; para un volumen institucional conviene materializar acumulados diarios.
- La auditoría de dependencias de producción terminó sin vulnerabilidades reportadas. Persisten cinco alertas altas de la cadena de herramientas de desarrollo asociada a `braces`/`fast-glob`/ESLint; no se forzaron degradaciones incompatibles para ocultarlas.
- Las pruebas aportan evidencia de los casos cubiertos; no certifican ausencia absoluta de errores ni cumplimiento regulatorio.

## Evolución institucional recomendada

El siguiente salto es un núcleo contable de doble partida con autorización separada de quien registra la operación. Cada desembolso, cobro, fondeo y reverso debe producir asientos balanceados, vinculados al documento original, con cierres diarios y conciliación contra extractos. Encima de ese núcleo pueden añadirse expedientes de crédito, políticas de aprobación, límites por rol, MFA, análisis de cartera por antigüedad y cohortes, y un repositorio analítico con acumulados diarios.

Esta evolución requiere un diseño contable revisado, una estrategia de migración reconciliada y validación de los requisitos locales de operación. La prioridad es obtener saldos institucionales reproducibles y control interno antes de automatizar decisiones de crédito.
