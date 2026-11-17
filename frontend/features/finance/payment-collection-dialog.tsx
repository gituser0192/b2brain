"use client";

import type { Dispatch, SetStateAction } from "react";

import type { PaymentAccount } from "./payment-collection-records";
import { useFinanceText } from "./finance-i18n";

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
  const t = useFinanceText();
  return (
    <div className="agent-modal">
      <div className="agent-dialog collection-dialog">
        <header>
          <h3>
            {t(mode === "account"
              ? "Add payment account"
              : "Capture incoming payment")}
          </h3>
          <button onClick={onClose}>×</button>
        </header>
        {mode === "account" ? (
          <>
            <div className="agent-form-grid">
              <label><span>{t("Name")}</span><input value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} /></label>
              <label><span>{t("Type")}</span><select value={account.type} onChange={(event) => setAccount({ ...account, type: event.target.value })}>{["BANK", "UPI", "CASH", "PAYMENT_GATEWAY", "OTHER"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
              <label><span>{t("Account identifier (UPI ID / bank account)")}</span><input placeholder={t("Example: harsh@upi or account ending 1234")} value={account.identifier} onChange={(event) => setAccount({ ...account, identifier: event.target.value })} /></label>
              <label><span>{t("Bank")}</span><input value={account.bankName} onChange={(event) => setAccount({ ...account, bankName: event.target.value })} /></label>
              <label><span>{t("Last 4 digits")}</span><input maxLength={4} value={account.accountLast4} onChange={(event) => setAccount({ ...account, accountLast4: event.target.value.replace(/\D/g, "") })} /></label>
            </div>
            <footer>
              <button onClick={onClose}>{t("Cancel")}</button>
              <button disabled={!account.name || !account.identifier} onClick={onSaveAccount}>{t("Save")}</button>
            </footer>
          </>
        ) : (
          <>
            <div className="agent-form-grid">
              <label><span>{t("Account")}</span><select value={incoming.paymentAccountId} onChange={(event) => setIncoming({ ...incoming, paymentAccountId: event.target.value })}><option value="">{t("Select")}</option>{accounts.filter((accountItem) => accountItem.isActive).map((accountItem) => <option key={accountItem.id} value={accountItem.id}>{accountItem.name}</option>)}</select></label>
              <label><span>{t("Bank UTR / transaction reference")}</span><input placeholder={t("Include invoice number when available")} value={incoming.externalReference} onChange={(event) => setIncoming({ ...incoming, externalReference: event.target.value })} /></label>
              <label><span>{t("Payer email or phone")}</span><input placeholder={t("Customer contact used for matching")} value={incoming.payerContact} onChange={(event) => setIncoming({ ...incoming, payerContact: event.target.value })} /></label>
              <label><span>{t("Payer")}</span><input value={incoming.payerName} onChange={(event) => setIncoming({ ...incoming, payerName: event.target.value })} /></label>
              <label><span>{t("Amount")}</span><input type="number" min=".01" value={incoming.amount} onChange={(event) => setIncoming({ ...incoming, amount: Number(event.target.value) })} /></label>
              <label><span>{t("Currency")}</span><input maxLength={3} value={incoming.currency} onChange={(event) => setIncoming({ ...incoming, currency: event.target.value.toUpperCase() })} /></label>
              <label><span>{t("Received")}</span><input type="datetime-local" value={incoming.receivedAt} onChange={(event) => setIncoming({ ...incoming, receivedAt: event.target.value })} /></label>
            </div>
            <footer>
              <button onClick={onClose}>{t("Cancel")}</button>
              <button disabled={!incoming.paymentAccountId || !incoming.externalReference || incoming.amount <= 0} onClick={onCaptureIncoming}>{t("Capture")}</button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
