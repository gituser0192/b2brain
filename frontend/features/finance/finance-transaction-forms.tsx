"use client";

import type { Dispatch, SetStateAction } from "react";

import { formatMoney, type FinanceInvoice } from "./finance-records";

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
  return (
    <>
      <div className="agent-form-grid">
        <label>
          <span>Title</span>
          <input value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} />
        </label>
        <label>
          <span>Category</span>
          <input value={value.category} onChange={(event) => setValue({ ...value, category: event.target.value })} />
        </label>
        <label>
          <span>Amount</span>
          <input type="number" min="0.01" step="0.01" value={value.amount} onChange={(event) => setValue({ ...value, amount: Number(event.target.value) })} />
        </label>
        <label>
          <span>Date</span>
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
          {saving ? "Saving..." : isEditing ? "Update expense" : "Record expense"}
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
  return (
    <>
      <p className="payment-balance">
        Outstanding balance: <strong>{formatMoney(invoice?.outstanding ?? 0)}</strong>
      </p>
      <div className="agent-form-grid">
        <label>
          <span>Amount</span>
          <input type="number" min="0.01" max={invoice?.outstanding} step="0.01" value={value.amount} onChange={(event) => setValue({ ...value, amount: Number(event.target.value) })} />
        </label>
        <label>
          <span>Method</span>
          <select value={value.method} onChange={(event) => setValue({ ...value, method: event.target.value })}>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label>
          <span>Payment reference</span>
          <input value={value.reference} onChange={(event) => setValue({ ...value, reference: event.target.value })} placeholder="UTR, receipt or transaction ID" />
        </label>
        <label>
          <span>Paid date</span>
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
          {saving ? "Saving..." : "Record payment"}
        </button>
      </footer>
    </>
  );
}
