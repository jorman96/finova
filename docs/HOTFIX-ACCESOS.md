# Corrección aislada de accesos

Esta rama parte de la versión productiva y contiene únicamente el arreglo del alta de usuarios: validación por campo, contraseña mínima coherente con el servidor, conflicto de correo duplicado, selección de dueño o administrador y formulario adaptable compartido con Equipo.

No contiene el núcleo contable, sus rutas, sus reglas ni su activación. No cambia cuentas existentes ni crea usuarios automáticamente. El administrador de plataforma elige la empresa y el rol; un dueño solo crea miembros permitidos en su propia empresa. Se conservan revocación de sesiones, límite de solicitudes y auditoría.

La prueba integrada verifica siete casos adicionales de creación, normalización, duplicados y límites de permisos en emuladores. La publicación está pendiente de autorización explícita del usuario. La etapa 2 permanece en su rama de pruebas.
