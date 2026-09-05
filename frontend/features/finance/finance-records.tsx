"use client";

export interface FinanceInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  currency: string;
  issueDate?: string;
  dueDate: string;
  paid: number;
  outstanding: number;
  daysOverdue: number;
  customer: { id: string; displayName: string };
  payments: {
    id: string;
    receiptNumber: string;
    amount: string;
    refundedAmount: string;
    paidAt: string;
  }[];
  collectionFollowUps: {
    id: string;
    title: string;
    description: string | null;
    dueAt: string;
    status: string;
    assignedTo: {
      id: string;
      firstName: string;
      lastName: string | null;
    };
  }[];
}

export interface FinanceExpense {
  id: string;
  title: string;
  category: string;
  amount: string;
  expenseDate: string;
  vendor: string | null;
  notes: string | null;
  status: "RECORDED" | "VOIDED";
}

export const formatMoney = (value: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export function FinanceRecords({
  invoices,
  expenses,
  canManage,
  saving,
  expandedFollowUpId,
  onRecordPayment,
  onCreateFollowUp,
  onToggleFollowUp,
  onEditExpense,
  onArchiveExpense,
  view = "all",
  currency = "INR",
}: {
  invoices: FinanceInvoice[];
  expenses: FinanceExpense[];
  canManage: boolean;
  saving: boolean;
  expandedFollowUpId: string | null;
  onRecordPayment: (invoice: FinanceInvoice) => void;
  onCreateFollowUp: (invoice: FinanceInvoice) => void;
  onToggleFollowUp: (followUpId: string) => void;
  onEditExpense: (expense: FinanceExpense) => void;
  onArchiveExpense: (expenseId: string) => void;
  view?: "all" | "invoices" | "expenses";
  currency?: string;
}) {
  return (
    <div className="finance-columns">
      {view !== "expenses" && <section>
        <h3>Customer invoices</h3>
        {invoices.length === 0 ? (
          <div className="finance-empty">
            <strong>No invoices yet</strong>
            <p>Create the first real customer invoice when you are ready.</p>
          </div>
        ) : (
          invoices.map((invoice) => {
            const followUp = invoice.collectionFollowUps[0];
            return (
              <article
                key={invoice.id}
                className={invoice.status === "OVERDUE" ? "invoice-overdue" : ""}
              >
                <div>
                  <strong>{invoice.invoiceNumber}</strong>
                  <small>
                    {invoice.customer.displayName} · <span className="finance-status" data-status={invoice.status}>{invoice.status.replaceAll("_", " ")}</span>
                    {invoice.daysOverdue
                      ? ` · ${invoice.daysOverdue} days overdue`
                      : ""}
                  </small>
                  <small>
                    {invoice.issueDate && <>Issued {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(invoice.issueDate))} · </>}
                    Due{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(new Date(invoice.dueDate))}
                  </small>
                </div>
                <div className="invoice-balance">
                  <small>Total {formatMoney(Number(invoice.total), currency)}</small>
                  <strong>{formatMoney(invoice.outstanding, currency)} due</strong>
                  <small>{formatMoney(invoice.paid, currency)} received</small>
                </div>
                {canManage &&
                  invoice.outstanding > 0 &&
                  !["DRAFT", "CANCELED"].includes(invoice.status) && (
                    <div className="invoice-actions">
                      <button onClick={() => onRecordPayment(invoice)}>
                        Record payment
                      </button>
                      {followUp ? (
                        <button onClick={() => onToggleFollowUp(followUp.id)}>
                          View existing follow-up
                        </button>
                      ) : (
                        <button
                          disabled={saving}
                          onClick={() => onCreateFollowUp(invoice)}
                        >
                          Create follow-up
                        </button>
                      )}
                    </div>
                  )}
                {followUp && expandedFollowUpId === followUp.id && (
                  <div className="invoice-follow-up-detail">
                    <strong>{followUp.title}</strong>
                    <span>
                      {followUp.status} · Due{" "}
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(followUp.dueAt))}
                    </span>
                    <span>
                      Assigned to {followUp.assignedTo.firstName}{" "}
                      {followUp.assignedTo.lastName ?? ""}
                    </span>
                    {followUp.description && <p>{followUp.description}</p>}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>}
      {view !== "invoices" && <section>
        <h3>Expenses</h3>
        {expenses.length === 0 ? (
          <div className="finance-empty">
            <strong>No expenses yet</strong>
            <p>Recorded business expenses will appear here.</p>
          </div>
        ) : (
          expenses.map((expense) => (
            <article key={expense.id}>
              <div>
                <strong>{expense.title}</strong>
                <small>{expense.category}</small>
              </div>
              <strong>{formatMoney(Number(expense.amount), currency)}</strong>
              {canManage && (
                <div className="invoice-actions">
                  <button onClick={() => onEditExpense(expense)}>Edit</button>
                  <button onClick={() => onArchiveExpense(expense.id)}>
                    Archive
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </section>}
    </div>
  );
}
