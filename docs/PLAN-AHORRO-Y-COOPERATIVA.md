# Evolución de Finova: crédito, ahorro y operación financiera

Propuesta de trabajo; no está implementada ni constituye autorización para captar depósitos. Antes de una operación real hay que definir país, figura jurídica, organismo supervisor y productos permitidos con asesoría especializada. Los plazos siguientes son orientativos y deben ajustarse tras esa definición.

## Etapa 1: base operativa y seguridad (2–4 semanas)

Inventariar y conciliar datos históricos. Resolver dependencias vulnerables y migrar perfiles sin interrumpir accesos. Separar desarrollo, pruebas y producción; agregar autenticación multifactor para administradores, mínimo privilegio, copias administradas y restauración ensayada. Mantener bitácora, monitoreo de errores y alertas de fallas. Criterio de salida: restauración comprobada y permisos probados por cada rol y empresa.

## Etapa 2: núcleo contable (4–6 semanas)

Crear catálogo de cuentas y libro de partida doble. Cada operación produce asientos inmutables que cuadran; los errores se corrigen con reversos. Separar activos (caja, bancos, cartera), pasivos (ahorros por cliente), patrimonio, ingresos y gastos. Usar importes exactos, monedas explícitas, idempotencia y control de concurrencia. Incluir cuentas de ahorro, movimientos, bloqueos, saldo contable y saldo disponible; nunca editar un saldo a mano. Criterio de salida: ninguna operación descuadra y retiros simultáneos no generan saldos negativos.

## Etapa 3: ahorro y cajas (4–6 semanas)

Apertura y estados de cuenta, depósitos, retiros, transferencias internas, ahorro programado y metas. Intereses con reglas versionadas, devengo diario y capitalización según contrato. Cajas por sucursal y usuario, apertura/cierre, arqueos y conciliación bancaria. Doble aprobación para operaciones superiores a límites definidos. No reutilizar los contratos de inversionistas como cuentas de ahorro: su naturaleza contable y contractual difiere. Criterio de salida: conciliación de la cuenta individual, el libro mayor y caja/banco con diferencias identificadas y resueltas.

## Etapa 4: experiencia y piloto controlado

Ficha 360 de la persona con pestañas Perfil, Créditos, Ahorros, Movimientos, Documentos y Alertas. Menú: Personas, Créditos, Ahorros, Caja, Contabilidad, Riesgos y Administración. Portal de cliente con saldo disponible, estado de cuenta y solicitudes que requieren aprobación; ninguna operación financiera irreversible depende únicamente del navegador. Agregar accesibilidad y diseño móvil. Piloto en entorno de prueba con personas ficticias, después operación limitada conforme a autorizaciones aplicables.

## Etapa 5: gestión institucional

Panel de liquidez, vencimientos, mora, concentración, posición de caja y rendimiento; comparar cifras contra contabilidad. Gestión documental y conocimiento del cliente, seguimiento de casos y reportes exigidos por la jurisdicción. Definir responsables, tolerancias de interrupción, recuperación, incidentes y dependencias de proveedores. Evaluar depósitos a plazo y canales bancarios después de estabilizar el núcleo.

Recomendación principal: iniciar por contabilidad y conciliación, antes de añadir una pantalla de ahorros. Una interfaz bancaria necesita un registro confiable del dinero y controles operativos para sostenerla.

Referencia: Comité de Basilea, Principios de resiliencia operativa (2021), https://www.bis.org/bcbs/publ/d516.pdf. Resalta gobierno, continuidad probada, incidentes, proveedores y resiliencia tecnológica. No sustituye normas locales ni certifica cumplimiento de Finova.
