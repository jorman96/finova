import { notFound } from 'next/navigation';
import AccountingWorkbench from '@/components/accounting/AccountingWorkbench';
export default function AccountingPage() {
  if (process.env.VERCEL_ENV === 'production' || process.env.FINOVA_ACCOUNTING_WORKBENCH_ENABLED !== 'true') notFound();
  return <AccountingWorkbench />;
}
