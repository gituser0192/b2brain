"use client";

import type { Dispatch, SetStateAction } from "react";

export type InvoiceEntry = {
  customerId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  discount: number;
  notes: string;
};

export function InvoiceEntryForm({
  value,
  setValue,
  customers,
  saving,
  onSave,
}: {
  value: InvoiceEntry;
  setValue: Dispatch<SetStateAction<InvoiceEntry>>;
  customers: { id: string; displayName: string }[];
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <>
      <label>
        <span>Customer</span>
        <select
          value={value.customerId}
          onChange={(event) =>
            setValue({ ...value, customerId: event.target.value })
          }
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.displayName}
            </option>
          ))}
        </select>
      </label>
      <div className="agent-form-grid">
        <label>
          <span>Invoice number</span>
          <input value={value.invoiceNumber} onChange={(event) => setValue({ ...value, invoiceNumber: event.target.value })} />
        </label>
        <label>
          <span>Issue date</span>
          <input type="date" value={value.issueDate} onChange={(event) => setValue({ ...value, issueDate: event.target.value })} />
        </label>
        <label>
          <span>Due date</span>
          <input type="date" value={value.dueDate} onChange={(event) => setValue({ ...value, dueDate: event.target.value })} />
        </label>
        <label>
          <span>Item</span>
          <input value={value.description} onChange={(event) => setValue({ ...value, description: event.target.value })} />
        </label>
        <label>
          <span>Quantity</span>
          <input type="number" min="0.001" step="0.001" value={value.quantity} onChange={(event) => setValue({ ...value, quantity: Number(event.target.value) })} />
        </label>
        <label>
          <span>Unit price</span>
          <input type="number" min="0" step="0.01" value={value.unitPrice} onChange={(event) => setValue({ ...value, unitPrice: Number(event.target.value) })} />
        </label>
      </div>
      <footer>
        <button
          disabled={
            saving ||
            !value.customerId ||
            !value.invoiceNumber ||
            !value.issueDate ||
            !value.dueDate ||
            !value.description
          }
          onClick={onSave}
        >
          {saving ? "Saving..." : "Create invoice"}
        </button>
      </footer>
    </>
  );
}
