# Entrega de búsqueda y eliminación de clientes

Base: producción aef83a7. Las mejoras generales de la otra carpeta siguen pendientes de migración y no forman parte de esta publicación.

- Nuevo crédito: selector con escritura, lista y teclado; búsqueda por nombre, apellidos o cédula, sin distinguir tildes o mayúsculas. Debe elegirse una coincidencia; escribir texto no crea clientes.
- Clientes: botón Eliminar para dueño, administrador y superadministrador. Confirmación explícita, validación de sesión revocada, perfil no deshabilitado y empresa. Se aceptan perfiles heredados sin campo activo; no se modifican perfiles existentes.
- El servidor impide eliminar cualquier cliente con préstamos, cuotas o pagos, incluidos créditos pagados o cancelados. El borrado permitido y la entrada de auditoría son atómicos. Los archivos adjuntos no se borran.
- La creación de préstamos comprueba el cliente dentro de una transacción y guarda contrato/cuotas juntos. Conviene recargar todas las sesiones antiguas tras publicar.
- Next.js y su configuración de lint se actualizan a 16.4.1. No se modifican reglas ni datos productivos de Firebase.

Validación: compilación completa, comprobación de tipos, lint de archivos nuevos, prueba de búsqueda y diez pruebas integradas de autorización, historial, eliminación y auditoría en emuladores.

Pendientes heredados: dependencias con alertas de seguridad; el endurecimiento general de perfiles, reglas, portal y reportes necesita una migración separada. Esta entrega no constituye una certificación de seguridad ni de cumplimiento bancario.
