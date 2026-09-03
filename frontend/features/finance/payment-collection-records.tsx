"use client";

export type PaymentAccount = {
  id: string;
  name: string;
  type: string;
  identifier: string;
  isActive: boolean;
};

export type IncomingTransaction = {
  id: string;
  externalReference: string;
  payerName: string | null;
  amount: string;
  currency: string;
  receivedAt: string;
  status: string;
  notes?: string | null;
  paymentAccount: { name: string };
  payment: { receiptNumber: string; invoice: { invoiceNumber: string } } | null;
};

export type PaymentRefund = {
  id: string;
  amount: string;
  reason: string;
  status: string;
  payment: {
    receiptNumber: string;
    currency: string;
    invoice: { invoiceNumber: string };
  };
};

export type CollectionInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  outstanding: number;
  currency: string;
  customer: { displayName: string };
  payments: {
    id: string;
    receiptNumber: string;
    amount: string;
    refundedAmount: string;
    paidAt: string;
  }[];
};

export function PaymentCollectionRecords({
  metrics,
  transactions,
  accounts,
  invoices,
  refunds,
  canManage,
  money,
  onReconcile,
  onIgnore,
  onRequestRefund,
  onCompleteRefund,
}: {
  metrics: {
    activeAccounts: number;
    unmatchedCount: number;
    unmatchedValue: number;
    matchedValue: number;
    pendingRefunds: number;
  };
  transactions: IncomingTransaction[];
  accounts: PaymentAccount[];
  invoices: CollectionInvoice[];
  refunds: PaymentRefund[];
  canManage: boolean;
  money: (value: number, currency?: string) => string;
  onReconcile: (transaction: IncomingTransaction) => void;
  onIgnore: (transaction: IncomingTransaction) => void;
  onRequestRefund: (payment: CollectionInvoice["payments"][number]) => void;
  onCompleteRefund: (refund: PaymentRefund) => void;
}) {
  return (
    <>
      <div className="collection-metrics">
        <article><span>Active accounts</span><strong>{metrics.activeAccounts}</strong></article>
        <article className={metrics.unmatchedCount ? "warning" : ""}><span>Unmatched</span><strong>{metrics.unmatchedCount}</strong><small>{money(metrics.unmatchedValue)}</small></article>
        <article><span>Reconciled</span><strong>{money(metrics.matchedValue)}</strong></article>
        <article><span>Refund approvals</span><strong>{metrics.pendingRefunds}</strong></article>
      </div>
      <div className="collection-columns">
        <section>
          <h3>Incoming transactions</h3>
          {transactions.length ? transactions.map((transaction) => (
            <article key={transaction.id}>
              <div>
                <small>{transaction.paymentAccount.name} · {transaction.externalReference}</small>
                <strong>{transaction.payerName || "Payer not specified"}</strong>
                <span>{new Date(transaction.receivedAt).toLocaleString()}</span>
                {transaction.payment && <b>{transaction.payment.receiptNumber} · {transaction.payment.invoice.invoiceNumber}</b>}
              </div>
              <strong>{money(Number(transaction.amount), transaction.currency)}</strong>
              <i>{transaction.status}</i>
              {canManage && transaction.status === "UNMATCHED" && (
                <div><button onClick={() => onReconcile(transaction)}>Match invoice</button><button onClick={() => onIgnore(transaction)}>Mark duplicate / Ignore</button></div>
              )}
            </article>
          )) : <p>No incoming payments captured.</p>}
        </section>
        <section>
          <h3>Payment accounts</h3>
          {accounts.length ? accounts.map((account) => (
            <article key={account.id}>
              <div><small>{account.type}</small><strong>{account.name}</strong><span>{account.identifier}</span></div>
              <i>{account.isActive ? "ACTIVE" : "INACTIVE"}</i>
            </article>
          )) : <p>Add a bank, UPI, cash, or gateway account.</p>}
        </section>
      </div>
      <section className="receipt-register">
        <header><h3>Receipts & refunds</h3><span>Refunds require approval by a different authorized user.</span></header>
        {invoices.flatMap((invoice) => invoice.payments.map((payment) => ({ invoice, payment }))).map(({ invoice, payment }) => (
          <article key={`${invoice.id}:${payment.id || payment.receiptNumber}`}>
            <div><strong>{payment.receiptNumber}</strong><small>{invoice.invoiceNumber} · {invoice.customer.displayName}</small></div>
            <span>{money(Number(payment.amount), invoice.currency)}</span>
            <span>{Number(payment.refundedAmount) ? `${money(Number(payment.refundedAmount), invoice.currency)} refunded` : "No refunds"}</span>
            {canManage && Number(payment.amount) > Number(payment.refundedAmount) && <button onClick={() => onRequestRefund(payment)}>Request refund</button>}
          </article>
        ))}
        {refunds.map((refund) => (
          <article key={refund.id}>
            <div><strong>Refund · {refund.payment.receiptNumber}</strong><small>{refund.payment.invoice.invoiceNumber} · {refund.reason}</small></div>
            <span>{money(Number(refund.amount), refund.payment.currency)}</span>
            <i>{refund.status.replaceAll("_", " ")}</i>
            {canManage && refund.status === "APPROVED" && <button onClick={() => onCompleteRefund(refund)}>Mark completed</button>}
          </article>
        ))}
      </section>
    </>
  );
}
