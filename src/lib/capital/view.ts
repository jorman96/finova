export type Agreement = { id: string; injectionId: string; beneficiary: string; principal: number; financeCost: number; total: number; monthly: number; reserveBps: number; paid: number; principalPaid: number; financeCostPaid: number; reserved: number; state: string };
export type Due = { id: string; agreementId: string; number: number; dueDate: string; total: number; principal: number; financeCost: number; paid: number; reserved: number };
export type Lot = { id: string; receiptId: string; loanId: string; date: string; source: string; interest: number; reserved: number; spent: number; restricted: number };
export type Reserve = { id: string; agreementId: string; installmentId: string; lotId: string; source: string; amount: number; remaining: number };
export type Payout = { id: string; agreementId: string; installmentId: string; date: string; amount: number; principal: number; financeCost: number; source: string; reference: string; proofUrl: string | null; reversed: boolean };
export type Restriction = { id: string; lotId: string; amount: number; reason: string; released: boolean };
export type CapitalView = {
  empresaId: string; enabled: boolean; truncated: boolean; initialCapital: number;
  totals: { collected?: number; reserved?: number; spent?: number; restricted?: number; outflow?: number; unverifiedReceipts?: number };
  injections: { id: string; monto: number; fecha: string; observaciones: string }[];
  banks: { id: string; banco: string; numero: string }[];
  agreements: Agreement[]; installments: Due[]; lots: Lot[]; reserves: Reserve[]; payouts: Payout[]; restrictions: Restriction[];
  claims: { id: string; lotId: string; agreementId: string; used: number }[];
  reversals: { id: string; payoutId: string; date: string; reason: string; amount: number; reference: string }[];
  contributions: { id: string; amount: number; returned: boolean; reference: string; reason: string; date: string }[];
  contribution_returns: { id: string; contributionId: string; amount: number; reason: string; reference: string; date: string }[];
};
