"use client";

import type { Dispatch, SetStateAction } from "react";

import type { PaymentAccount } from "./payment-collection-records";

export type CollectionDialogMode = "account" | "incoming";

export type PaymentAccountEntry = {
  name: string;
  type: string;
  identifier: string;
  bankName: string;
  accountLast4: string;
  instructions: string;
  isActive: boolean;
};

export type IncomingPaymentEntry = {
  paymentAccountId: string;
  externalReference: string;
  payerName: string;
  payerContact: string;
  amount: number;
  currency: string;
  receivedAt: string;
  notes: string;
};

export function PaymentCollectionDialog({
  mode,
  account,
  setAccount,
  incoming,
  setIncoming,
  accounts,
  onClose,
  onSaveAccount,
  onCaptureIncoming,
}: {
  mode: CollectionDialogMode;
  account: PaymentAccountEntry;
  setAccount: Dispatch<SetStateAction<PaymentAccountEntry>>;
  incoming: IncomingPaymentEntry;
  setIncoming: Dispatch<SetStateAction<IncomingPaymentEntry>>;
  accounts: PaymentAccount[];
  onClose: () => void;
  onSaveAccount: () => void;
  onCaptureIncoming: () => void;
}) {
  return (
    <div className="agent-modal">
      <div className="agent-dialog collection-dialog">
        <header>
          <h3>
            {mode === "account"
              ? "Add payment account"
              : "Capture incoming payment"}
          </h3>
          <button onClick={onClose}>×</button>
        </header>
        {mode === "account" ? (
          <>
            <div className="agent-form-grid">
              <label><span>Name</span><input value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} /></label>
              <label><span>Type</span><select value={account.type} onChange={(event) => setAccount({ ...account, type: event.target.value })}>{["BANK", "UPI", "CASH", "PAYMENT_GATEWAY", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Account identifier (UPI ID / bank account)</span><input placeholder="Example: harsh@upi or account ending 1234" value={account.identifier} onChange={(event) => setAccount({ ...account, identifier: event.target.value })} /></label>
              <label><span>Bank</span><input value={account.bankName} onChange={(event) => setAccount({ ...account, bankName: event.target.value })} /></label>
              <label><span>Last 4 digits</span><input maxLength={4} value={account.accountLast4} onChange={(event) => setAccount({ ...account, accountLast4: event.target.value.replace(/\D/g, "") })} /></label>
            </div>
            <footer>
              <button onClick={onClose}>Cancel</button>
              <button disabled={!account.name || !account.identifier} onClick={onSaveAccount}>Save</button>
            </footer>
          </>
        ) : (
          <>
            <div className="agent-form-grid">
              <label><span>Account</span><select value={incoming.paymentAccountId} onChange={(event) => setIncoming({ ...incoming, paymentAccountId: event.target.value })}><option value="">Select</option>{accounts.filter((accountItem) => accountItem.isActive).map((accountItem) => <option key={accountItem.id} value={accountItem.id}>{accountItem.name}</option>)}</select></label>
              <label><span>Bank UTR / transaction reference</span><input placeholder="Include invoice number when available" value={incoming.externalReference} onChange={(event) => setIncoming({ ...incoming, externalReference: event.target.value })} /></label>
              <label><span>Payer email or phone</span><input placeholder="Customer contact used for matching" value={incoming.payerContact} onChange={(event) => setIncoming({ ...incoming, payerContact: event.target.value })} /></label>
              <label><span>Payer</span><input value={incoming.payerName} onChange={(event) => setIncoming({ ...incoming, payerName: event.target.value })} /></label>
              <label><span>Amount</span><input type="number" min=".01" value={incoming.amount} onChange={(event) => setIncoming({ ...incoming, amount: Number(event.target.value) })} /></label>
              <label><span>Currency</span><input maxLength={3} value={incoming.currency} onChange={(event) => setIncoming({ ...incoming, currency: event.target.value.toUpperCase() })} /></label>
              <label><span>Received</span><input type="datetime-local" value={incoming.receivedAt} onChange={(event) => setIncoming({ ...incoming, receivedAt: event.target.value })} /></label>
            </div>
            <footer>
              <button onClick={onClose}>Cancel</button>
              <button disabled={!incoming.paymentAccountId || !incoming.externalReference || incoming.amount <= 0} onClick={onCaptureIncoming}>Capture</button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
