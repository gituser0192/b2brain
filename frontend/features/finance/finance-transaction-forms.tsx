"use client";

import type { Dispatch, SetStateAction } from "react";

import { formatMoney, type FinanceInvoice } from "./finance-records";
import { useFinanceText } from "./finance-i18n";

export type ExpenseEntry = {
  title: string;
  category: string;
  vendor: string;
  amount: number;
  expenseDate: string;
  notes: string;
};

export type PaymentEntry = {
  amount: number;
  method: string;
  reference: string;
  paidAt: string;
};

export function ExpenseEntryForm({
  value,
  setValue,
  saving,
  isEditing,
  onSave,
}: {
  value: ExpenseEntry;
  setValue: Dispatch<SetStateAction<ExpenseEntry>>;
  saving: boolean;
  isEditing: boolean;
  onSave: () => void;
}) {
  const t = useFinanceText();
  return (
    <>
      <div className="agent-form-grid">
        <label>
          <span>{t("Title")}</span>
          <input value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} />
        </label>
        <label>
          <span>{t("Category")}</span>
          <input value={value.category} onChange={(event) => setValue({ ...value, category: event.target.value })} />
        </label>
        <label>
          <span>{t("Amount")}</span>
          <input type="number" min="0.01" step="0.01" value={value.amount} onChange={(event) => setValue({ ...value, amount: Number(event.target.value) })} />
        </label>
        <label>
          <span>{t("Date")}</span>
          <input type="date" value={value.expenseDate} onChange={(event) => setValue({ ...value, expenseDate: event.target.value })} />
        </label>
      </div>
      <footer>
        <button
          disabled={
            saving ||
            !value.title ||
            !value.category ||
            !value.expenseDate ||
            value.amount <= 0
          }
          onClick={onSave}
        >
          {t(saving ? "Saving..." : isEditing ? "Update expense" : "Record expense")}
        </button>
      </footer>
    </>
  );
}

export function PaymentEntryForm({
  value,
  setValue,
  invoice,
  saving,
  onSave,
}: {
  value: PaymentEntry;
  setValue: Dispatch<SetStateAction<PaymentEntry>>;
  invoice: FinanceInvoice | null;
  saving: boolean;
  onSave: () => void;
}) {
  const t = useFinanceText();
  return (
    <>
      <p className="payment-balance">
        {t("Outstanding balance")}: <strong>{formatMoney(invoice?.outstanding ?? 0)}</strong>
      </p>
      <div className="agent-form-grid">
        <label>
          <span>{t("Amount")}</span>
          <input type="number" min="0.01" max={invoice?.outstanding} step="0.01" value={value.amount} onChange={(event) => setValue({ ...value, amount: Number(event.target.value) })} />
        </label>
        <label>
          <span>{t("Method")}</span>
          <select value={value.method} onChange={(event) => setValue({ ...value, method: event.target.value })}>
            <option value="BANK_TRANSFER">{t("Bank transfer")}</option>
            <option value="UPI">UPI</option>
            <option value="CASH">{t("Cash")}</option>
            <option value="CARD">{t("Card")}</option>
            <option value="CHEQUE">{t("Cheque")}</option>
            <option value="OTHER">{t("Other")}</option>
          </select>
        </label>
        <label>
          <span>{t("Payment reference")}</span>
          <input value={value.reference} onChange={(event) => setValue({ ...value, reference: event.target.value })} placeholder={t("UTR, receipt or transaction ID")} />
        </label>
        <label>
          <span>{t("Paid date")}</span>
          <input type="date" value={value.paidAt} onChange={(event) => setValue({ ...value, paidAt: event.target.value })} />
        </label>
      </div>
      <footer>
        <button
          disabled={
            saving ||
            !invoice ||
            value.amount <= 0 ||
            value.amount > (invoice?.outstanding ?? 0) ||
            !value.paidAt
          }
          onClick={onSave}
        >
          {t(saving ? "Saving..." : "Record payment")}
        </button>
      </footer>
    </>
  );
}
