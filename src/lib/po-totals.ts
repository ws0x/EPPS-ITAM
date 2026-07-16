/**
 * Exact totals formulas replicated from the real Excel PO template - never
 * let a user type a total, always derive it here (server actions + PDF
 * rendering both call this so the two can't drift apart).
 */
export type PoTotalsInput = {
  lines: Array<{ unitPrice: number; quantity: number }>;
  vatRegistered: boolean;
  advancePaymentRegistered: boolean;
  eInvoiced: boolean;
  miscAmount: number | null;
};

export function computePoTotals({ lines, vatRegistered, advancePaymentRegistered, eInvoiced, miscAmount }: PoTotalsInput) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const vatAmount = vatRegistered ? subtotal * 0.14 : 0;
  // Inverse logic per the template: WHT applies when NOT registered for advance payments.
  const whtAmount = advancePaymentRegistered ? 0 : subtotal * 0.01;
  const misc = miscAmount ?? 0;
  const miscWithVat = eInvoiced ? misc * 1.14 : misc;
  const totalAmount = subtotal + vatAmount + miscWithVat - whtAmount;

  return { subtotal, vatAmount, whtAmount, miscWithVat, totalAmount };
}
