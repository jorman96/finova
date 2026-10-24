import { OperationsWorkspace } from '@/components/gestion/OperationsWorkspace';
export default async function GestionPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const query = await searchParams;
  return <OperationsWorkspace initialClientId={typeof query.cliente === 'string' ? query.cliente : ''} />;
}
