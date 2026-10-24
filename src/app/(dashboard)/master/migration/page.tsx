import Link from 'next/link';
export default function MigrationPage() {
  return <section className="mx-auto max-w-xl space-y-4 py-8">
    <h1 className="text-2xl font-semibold">Migración de datos históricos</h1>
    <p>La reasignación automática está retirada. Los registros conservan su financiera y su historial.</p>
    <p className="text-muted-foreground">Una migración requiere inventario de registros, financiera de destino explícita, respaldo, simulación y validación de resultados. Solicita una revisión administrativa antes de modificar datos históricos.</p>
    <Link href="/master" className="underline">Volver a administración de financieras</Link>
  </section>;
}
