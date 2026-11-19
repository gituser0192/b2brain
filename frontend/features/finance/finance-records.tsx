"use client";
import { useLanguage } from "@/features/language/language";
import { useFinanceText } from "./finance-i18n";

export interface FinanceInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  currency: string;
  issueDate?: string;
  updatedAt?: string;
  dueDate: string;
  paid: number;
  outstanding: number;
  daysOverdue: number;
  customerId: string | null;
  customerName: string | null;
  customer: { id: string; displayName: string } | null;
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
  onIssueInvoice,
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
  onIssueInvoice: (invoice: FinanceInvoice) => void;
  onCreateFollowUp: (invoice: FinanceInvoice) => void;
  onToggleFollowUp: (followUpId: string) => void;
  onEditExpense: (expense: FinanceExpense) => void;
  onArchiveExpense: (expenseId: string) => void;
  view?: "all" | "invoices" | "expenses";
  currency?: string;
}) {
  const language = useLanguage();
  const t = useFinanceText();
  const statusLabel = (status: string) => language === "hi" ? t(status) : status.replaceAll("_", " ");
  return (
    <div className="finance-columns">
      {view !== "expenses" && <section>
        <h3>{t("Customer invoices")}</h3>
        {invoices.length === 0 ? (
          <div className="finance-empty">
            <strong>{t("No invoices yet")}</strong>
            <p>{t("Create the first real customer invoice when you are ready.")}</p>
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
                    {invoice.customer?.displayName ?? invoice.customerName ?? t("Unlinked counterparty")} · <span className="finance-status" data-status={invoice.status}>{statusLabel(invoice.status)}</span>
                    {invoice.daysOverdue
                      ? ` · ${invoice.daysOverdue} ${t("days overdue")}`
                      : ""}
                  </small>
                  <small>
                    {invoice.issueDate && <>{t("Issued")} {new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en", { dateStyle: "medium" }).format(new Date(invoice.issueDate))} · </>}
                    {invoice.status === "DRAFT" ? t("Planned due") : t("Due")}{" "}
                    {new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en", {
                      dateStyle: "medium",
                    }).format(new Date(invoice.dueDate))}
                  </small>
                </div>
                <div className="invoice-balance">
                  <small>{t("Total")} {formatMoney(Number(invoice.total), currency)}</small>
                  <strong>{invoice.status === "DRAFT" ? t("Not issued") : `${formatMoney(invoice.outstanding, currency)} ${t("due")}`}</strong>
                  <small>{formatMoney(invoice.paid, currency)} {t("received")}</small>
                </div>
                {canManage && invoice.status === "DRAFT" && (
                  <div className="invoice-actions">
                    <button disabled={saving} onClick={() => onIssueInvoice(invoice)}>{t("Issue invoice")}</button>
                  </div>
                )}
                {canManage && invoice.outstanding > 0 && !["DRAFT", "CANCELED"].includes(invoice.status) && (
                  <div className="invoice-actions">
                    <button disabled={saving} onClick={() => onRecordPayment(invoice)}>{t("Record payment")}</button>
                    {invoice.customerId && (followUp ? (
                      <button onClick={() => onToggleFollowUp(followUp.id)}>{t("View existing follow-up")}</button>
                    ) : (
                      <button disabled={saving} onClick={() => onCreateFollowUp(invoice)}>{t("Create follow-up")}</button>
                    ))}
                  </div>
                )}
                {followUp && expandedFollowUpId === followUp.id && (
                  <div className="invoice-follow-up-detail">
                    <strong>{followUp.title}</strong>
                    <span>
                      {statusLabel(followUp.status)} · {t("Due")}{" "}
                      {new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(followUp.dueAt))}
                    </span>
                    <span>
                      {t("Assigned to")} {followUp.assignedTo.firstName}{" "}
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
        <h3>{t("Expenses")}</h3>
        {expenses.length === 0 ? (
          <div className="finance-empty">
            <strong>{t("No expenses yet")}</strong>
            <p>{t("Recorded business expenses will appear here.")}</p>
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
                  <button onClick={() => onEditExpense(expense)}>{t("Edit")}</button>
                  <button onClick={() => onArchiveExpense(expense.id)}>
                    {t("Archive")}
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
