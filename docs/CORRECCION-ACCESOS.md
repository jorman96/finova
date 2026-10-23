# Corrección de creación de accesos

## Problemas comprobados

El formulario de asignación de dueño no mostraba el mínimo de 12 caracteres exigido por el servidor, no permitía seleccionar administrador y desaparecía cuando la financiera tenía un dueño. La ventana usaba un ancho reducido sin controlar el alto disponible. En la inspección productiva el navegador autocompletó credenciales de la sesión actual dentro del alta de una cuenta nueva; no se enviaron esos datos ni se crearon cuentas reales.

## Solución

Un formulario compartido entre Súper Admin y Equipo identifica la financiera destino, separa datos personales y permisos, y permite elegir los roles autorizados en cada contexto. La opción Crear acceso permanece disponible aunque exista dueño; en empresas suspendidas se deshabilita con explicación. El dueño conserva la capacidad de crear un administrador de su misma empresa, pero no puede crear otro dueño ni administrar otras financieras.

El formulario valida correo, nombre y longitud de contraseña; el servidor vuelve a validar los datos y entrega errores por campo. Un correo duplicado responde con conflicto y no modifica la cuenta existente. Correo y nombre se normalizan sin alterar contraseñas. Documento y teléfono son opcionales, de acuerdo con el contrato de la API.

La ventana tiene ancho adaptable, encabezado y acciones persistentes, desplazamiento interno y distribución de una o dos columnas según el espacio. Incluye etiquetas asociadas, ayuda contextual, foco en el campo con error, control para mostrar contraseña, estado de envío y cierre protegido durante el guardado. La contraseña se identifica como nueva y el formulario se desmonta al cerrar para descartar sus valores. El navegador conserva sus propias políticas de autocompletado: los atributos del formulario reducen confusiones pero no garantizan controlar todos los gestores de contraseñas.

## Verificación

Se inspeccionó el formulario original con la sesión productiva autorizada de superadmin, sin enviar el alta ni cambiar permisos. El nuevo diseño se verificó en el navegador local con datos ficticios y una ventana de altura limitada: acciones visibles, desplazamiento del contenido, rol administrador, errores de campos vacíos y foco en nombre. La consola no mostró errores durante ese recorrido.

La regresión integrada comprueba creación de dueño y administrador por plataforma, administrador local por dueño, normalización, contraseña corta, correo duplicado sin modificar la cuenta previa, rechazo a otros roles y separación entre empresas. Las pruebas utilizan exclusivamente demo-finova y emuladores. No se publican cambios ni se habilitan operaciones contables: la etapa 2 permanece solo en pruebas por instrucción del usuario.

Para revisar el flujo de plataforma local: `firebase emulators:exec --config firebase.security-test.json --project demo-finova --only auth,firestore "node scripts/accounting-local-preview.mjs --platform"`. El script muestra las credenciales de su cuenta ficticia; nunca utiliza credenciales productivas en la aplicación de prueba.
