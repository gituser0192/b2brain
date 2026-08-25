export interface MatchableInvoice { id: string; invoiceNumber: string; total: number; customerEmail: string | null; payments: { amount: number; refundedAmount: number }[]; }
export function findExactPaymentMatch(input: { externalReference: string; payerContact: string | null; amount: number }, invoices: MatchableInvoice[]) {
  const reference = input.externalReference.trim().toLowerCase(), contact = input.payerContact?.trim().toLowerCase();
  const candidates = invoices.filter((invoice) => {
    const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount - payment.refundedAmount, 0), outstanding = invoice.total - paid;
    const referenceMatch = reference === invoice.invoiceNumber.toLowerCase() || reference.includes(invoice.invoiceNumber.toLowerCase());
    const contactAmountMatch = Boolean(contact && invoice.customerEmail?.toLowerCase() === contact && Math.abs(outstanding - input.amount) <= 0.001);
    return input.amount <= outstanding + 0.001 && (referenceMatch || contactAmountMatch);
  });
  return candidates.length === 1 ? { matched: true as const, invoiceId: candidates[0]!.id } : { matched: false as const, reason: candidates.length > 1 ? "AMBIGUOUS" as const : "NO_EXACT_MATCH" as const };
}
