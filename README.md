# Finova

Aplicación de gestión de cartera, cobros, fondeo de inversionistas y tesorería con Next.js, React y Firebase.

## Desarrollo

Usa Node 24. Instala las dependencias con `npm ci`, configura las variables de Firebase y correo descritas en `docs/OPERACION.md` y ejecuta `npm run dev`.

## Validación

- `npm run lint`: reglas de código y React.
- `npx tsc --noEmit`: tipos.
- `npm test`: cálculos monetarios, calendarios y permisos.
- `npm run test:rules`: reglas de Firestore y Storage en emuladores.
- `npm run test:integration`: APIs y transacciones con Next.js y Firebase demo.
- `npm run build`: compilación de producción.

Las pruebas de emuladores requieren Java 21 y Firebase CLI 15.19.0. No conectan con producción.

## Documentación operativa

Consulta [Operación y transición segura](docs/OPERACION.md) antes de publicar reglas o aplicación. Los perfiles existentes, desgloses históricos y caminos antiguos de archivos requieren revisión antes del cambio. No ejecutes migraciones que recalculen contratos o reasignen empresas automáticamente.

Los cambios financieros se validan en servidor, conservan auditoría y usan idempotencia. El dashboard diferencia cifras históricas, cifras del período y desgloses no verificados. La aplicación conserva el historial mediante anulaciones en lugar de borrar transacciones.
