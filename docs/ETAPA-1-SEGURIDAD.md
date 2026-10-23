# Etapa 1: seguridad y continuidad compatibles

## Alcance

Parte de producción 4d515b8. Se conservan los usuarios, sus contraseñas, roles y empresa. No hay migración automática, borrado ni recálculo monetario. Los perfiles sin `activo` conservan acceso; `activo:false` y valores inválidos se rechazan. Se retira la autopromoción a superadministrador y la creación automática de perfiles privilegiados.

Las reglas pasan de acceso global autenticado a alcance por financiera. Los usuarios solo pueden editar datos personales de su perfil; rol, empresa y activación no son editables por ellos. Superadministradores conservan administración de plataforma. Creación de usuarios por servidor, con validación de rol, contraseña nueva de al menos 12 caracteres y auditoría; las contraseñas existentes no se cambian.

Se deshabilita el borrado de préstamos y pagos y el reinicio a cero, conservando los registros. Los reversos históricos requieren conciliación y un flujo posterior auditado; no se estiman ni se sobrescriben saldos. La eliminación protegida de clientes sin historial permanece disponible.

Se eliminan las dependencias xlsx, next-pwa y el CLI de shadcn de producción. ExcelJS mantiene las hojas de exportación. El service worker solo almacena archivos estáticos; elimina las cachés anteriores para no conservar páginas o respuestas financieras. Se incorporan cabeceras de seguridad y registros de errores sin mensajes, documentos o credenciales.

## Acceso y doble factor

La pantalla Seguridad permite verificar correo y configurar manualmente un autenticador TOTP. Requiere confirmar contraseña y un código antes de activar. El proyecto ya usa Identity Platform; se habilita el proveedor opcional después de publicar el flujo de inicio de sesión compatible. Ningún usuario se inscribe automáticamente. El usuario realiza su propia configuración. No se generan códigos de recuperación ficticios.

Recuperación de doble factor: verificar identidad por un canal institucional, comprobar autorizaciones con un segundo responsable y utilizar una cuenta administrativa autorizada en Firebase para gestionar el factor perdido. No enviar contraseñas, claves TOTP ni códigos por chat; no modificar correos ni roles para evadir la recuperación. Registrar el incidente y la intervención. Antes de activar, el usuario debe preparar copia segura de su autenticador y conocer a su responsable de recuperación.

El portal de clientes exige un código de un solo uso al correo registrado; sesiones HttpOnly con vencimiento y cierre real. Correo y proxy de imágenes requieren validación de registros, pertenencia y permisos. No se utiliza un remitente temporal por defecto en producción: debe configurarse un dominio verificado, RESEND_FROM_EMAIL y una credencial válida en el gestor de variables. No se envían correos reales durante las pruebas. La consulta del proveedor devolvió HTTP 400, por lo que la entrega de correo no está validada y el acceso por código al portal depende de resolver esa configuración.

## Copias y recuperación

Se generó respaldo local AES-256-GCM con 215 documentos, 4 identidades de Auth y 5 archivos. La clave queda separada en `.private-backups/keys`; debe trasladarse a una bóveda segura y mantenerse separada de copias distribuidas. Todo el directorio está excluido de Git. No equivale a una instantánea transaccional entre Firestore/Auth/Storage ni a un respaldo administrado con retención.

El ensayo local restaura los 215 documentos conservando tipos y verifica los cinco binarios. Solo admite `demo-finova-recovery`, hosts de emulador locales y destino vacío; no permite sobrescribir producción. Las credenciales de Auth no se restauraron ni se probaron: el inventario de identidades no certifica recuperación de contraseñas. No se hicieron modificaciones de cuentas en producción.

Por decisión del usuario no se habilitan respaldos diarios administrados ni cargos recurrentes. Debe repetirse el respaldo manual antes de cambios de riesgo y almacenarse una copia externa cifrada con su clave en una bóveda diferente.

## Entornos

Desarrollo y previews no pueden usar el proyecto productivo. Las pruebas y CI usan exclusivamente demo-finova y emuladores, nunca secretos reales. La configuración actual de Preview aún apunta al proyecto real: sus compilaciones deben fallar de forma segura hasta configurar un Firebase de staging separado. Esto no bloquea la compilación productiva preparada sin dominio ni el despliegue de producción.

## Verificación y publicación

- Prueba de búsqueda; prueba de cifrado/tipos/autenticidad.
- Nueve pruebas de reglas, siete roles y archivos heredados.
- Veinticinco verificaciones integradas: eliminación, separación, usuarios, respaldos, OTP y logout.
- Compilación, comprobación de tipos y revisión de código de seguridad.
- Comparar la huella de perfiles y los conteos antes y después. El inventario previo no detectó préstamos sin clientes/cuotas, cuotas o pagos sin préstamo, ni clientes sin empresa; eso no constituye conciliación contable de importes.
- Publicar aplicación compatible, verificarla, activar reglas y proveedor TOTP opcional, comprobar navegación y registros. No crear pagos o créditos reales para pruebas.

## Operación y pendientes

Los errores inesperados tienen referencia y registro estructurado; los errores de interfaz pueden guardarse como reportes autenticados con límites de frecuencia. No hay todavía una alerta externa con responsable y tiempo de respuesta acordados. Revisar los logs de Vercel y los incidentes antes de cambios; acordar responsables, objetivos de recuperación y canal de aviso.

Pendientes para cerrar la etapa operativa: configurar y validar correo transaccional, un proyecto de staging real, custodia externa del respaldo/clave, recuperación de credenciales ensayada y responsables de incidentes. Inscripción MFA individual pendiente de cada usuario. Las operaciones financieras siguen usando lógica heredada en el cliente: su traslado completo al servidor y conciliación se debe hacer de forma separada, con validación contable.

Rollback: conservar el despliegue anterior y las reglas previas en el respaldo privado. No reabrir reglas globales por defecto. Una vez inscritos usuarios MFA, mantener siempre un login compatible con TOTP; no volver a un login que ignore el segundo factor.

La auditoría final de producción arroja cero alertas. La auditoría completa conserva cinco alertas en la cadena de ESLint/Next (braces y dependientes); el registro aún publica braces 3.0.3. La alternativa automática sugería degradar Next/ESLint a una versión mayor anterior, por lo que no se aplicó. Son herramientas de desarrollo y no se incluyen en el runtime productivo; deben seguirse hasta una corrección compatible.

## Incidente de preparación de despliegue

La primera carga CLI de prueba incluyó la carpeta privada de respaldo y su clave, aunque Git la ignoraba. Se retiró ese despliegue sin promoverlo al dominio público y se añadieron exclusiones explícitas en .vercelignore. El control de publicación debe consultar la lista de archivos de cada carga y bloquear la activación si encuentra carpetas privadas, claves o archivos de entorno. Los archivos estuvieron en el proyecto Vercel del propietario; borrar el despliegue no demuestra purga inmediata de todas las copias internas del proveedor. No se publicaron en GitHub ni en el directorio público de la aplicación.
