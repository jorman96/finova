export const resetCategories = {
  loans: 'Préstamos, cuotas y cobros',
  clients: 'Clientes y accesos al portal',
  investors: 'Inversionistas, contratos y pagos',
  balances: 'Capital, compromisos y movimientos de caja',
  agenda: 'Gestiones y agenda',
} as const;
export type ResetCategory = keyof typeof resetCategories;
