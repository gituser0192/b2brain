"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import {
  PaymentCollectionRecords,
  type CollectionInvoice,
  type IncomingTransaction as Tx,
  type PaymentAccount as Account,
  type PaymentRefund as Refund,
} from "./payment-collection-records";
import {
  PaymentCollectionDialog,
  type CollectionDialogMode,
} from "./payment-collection-dialog";
interface P {
  success: true;
  data: {
    accounts: Account[];
    transactions: Tx[];
    refunds: Refund[];
    metrics: {
      activeAccounts: number;
      unmatchedCount: number;
      unmatchedValue: number;
      matchedValue: number;
      pendingRefunds: number;
    };
  };
}
const ab = {
    name: "",
    type: "BANK",
    identifier: "",
    bankName: "",
    accountLast4: "",
    instructions: "",
    isActive: true,
  },
  ib = {
    paymentAccountId: "",
    externalReference: "",
    payerName: "",
    payerContact: "",
    amount: 0,
    currency: "INR",
    receivedAt: new Date().toISOString().slice(0, 16),
    notes: "",
  };
export function PaymentCollectionManager({
  initialAction,
  invoices,
  onFinanceChanged,
}: {
  initialAction?: "incoming";
  invoices: CollectionInvoice[];
  onFinanceChanged: () => Promise<void>;
}) {
  const { session, authorizedRequest } = useAuth(),
    [data, setData] = useState<P["data"]>({
      accounts: [],
      transactions: [],
      refunds: [],
      metrics: {
        activeAccounts: 0,
        unmatchedCount: 0,
        unmatchedValue: 0,
        matchedValue: 0,
        pendingRefunds: 0,
      },
    }),
    [mode, setMode] = useState<CollectionDialogMode | null>(null),
    [account, setAccount] = useState(ab),
    [incoming, setIncoming] = useState(ib),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const initialActionHandled = useRef(false);
  const canManage =
      session?.membership.permissions.includes("FINANCE_MANAGE") ?? false,
    money = (v: number, c = session?.organization.currency ?? "INR") =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: c,
        maximumFractionDigits: 0,
      }).format(v),
    load = useCallback(async () => {
      try {
        const c = await authorizedRequest<P>("/payment-collection");
        setData(c.data);
        setError("");
      } catch (e) {
        setError(
          e instanceof ApiError
            ? e.message
            : "Unable to load payment collection.",
        );
      }
    }, [authorizedRequest]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    if (initialAction !== "incoming" || !canManage || initialActionHandled.current) return;
    initialActionHandled.current = true;
    setIncoming({ ...ib, paymentAccountId: data.accounts.find((item) => item.isActive)?.id ?? "" });
    setMode("incoming");
  }, [canManage, data.accounts, initialAction]);
  async function run(task: () => Promise<unknown>, message: string) {
    try {
      await task();
      setMode(null);
      setNotice(message);
      setError("");
      await load();
      await onFinanceChanged();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Unable to complete payment action.",
      );
    }
  }
  async function reconcile(tx: Tx) {
    const list = invoices.filter(
        (i) => i.outstanding > 0 && !["DRAFT", "CANCELED"].includes(i.status),
      ),
      choice = prompt(
        `Choose invoice:\n${list.map((i, n) => `${n + 1}. ${i.invoiceNumber} · ${i.customer.displayName} · ${money(i.outstanding, i.currency)}`).join("\n")}`,
      ),
      invoice =
        list[Number(choice) - 1] ??
        list.find(
          (i) => i.invoiceNumber.toLowerCase() === choice?.trim().toLowerCase(),
        );
    if (invoice)
      await run(
        () =>
          authorizedRequest(`/payment-collection/incoming/${tx.id}/reconcile`, {
            method: "POST",
            body: JSON.stringify({ invoiceId: invoice.id }),
          }),
        `Matched to ${invoice.invoiceNumber}; receipt created.`,
      );
  }
  async function ignoreIncoming(tx: Tx) {
    const reason = prompt("Why should this transaction be ignored?", "Duplicate of a payment already recorded manually");
    if (reason) await run(() => authorizedRequest(`/payment-collection/incoming/${tx.id}/ignore`, { method: "POST", body: JSON.stringify({ reason }) }), "Incoming transaction marked as ignored; no invoice balance changed.");
  }
  async function captureIncoming() {
    try {
      const response = await authorizedRequest<{ success: true; data: { autoMatched: boolean; invoiceId?: string } }>("/payment-collection/incoming", { method: "POST", body: JSON.stringify({ ...incoming, receivedAt: new Date(incoming.receivedAt).toISOString() }) });
      setMode(null);
      setNotice(response.data.autoMatched ? "Payment matched automatically; receipt created and collection workflow updated." : "Payment captured in the unmatched queue for manual review.");
      setError("");
      await load();
      await onFinanceChanged();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to capture incoming payment."); }
  }
  async function saveAccount() {
    await run(
      () =>
        authorizedRequest("/payment-collection/accounts", {
          method: "POST",
          body: JSON.stringify(account),
        }),
      "Payment account added.",
    );
  }
  async function requestRefund(
    p: CollectionInvoice["payments"][number],
  ) {
    const available = Number(p.amount) - Number(p.refundedAmount),
      amount = Number(
        prompt(`Refund amount (max ${available})`, String(available)),
      ),
      reason = amount ? prompt("Refund reason") : null;
    if (amount && reason)
      await run(
        () =>
          authorizedRequest(`/payment-collection/payments/${p.id}/refunds`, {
            method: "POST",
            body: JSON.stringify({ amount, reason }),
          }),
        "Refund sent to Approvals & Audit.",
      );
  }
  async function complete(r: Refund) {
    const reference = prompt("Refund transaction reference");
    if (reference)
      await run(
        () =>
          authorizedRequest(`/payment-collection/refunds/${r.id}/complete`, {
            method: "POST",
            body: JSON.stringify({ reference }),
          }),
        "Refund completed.",
      );
  }
  return (
    <section className="payment-collection">
      <header>
        <div>
          <p>Cash collection control</p>
          <h2>Payment collection & reconciliation</h2>
          <span>
            Capture money, match invoices, issue receipts, and control refunds.
          </span>
        </div>
        {canManage && (
          <div>
            <button
              onClick={() => {
                setAccount(ab);
                setMode("account");
              }}
            >
              + Account
            </button>
            <button
              onClick={() => {
                setIncoming({
                  ...ib,
                  paymentAccountId:
                    data.accounts.find((a) => a.isActive)?.id ?? "",
                });
                setMode("incoming");
              }}
            >
              + Incoming payment
            </button>
          </div>
        )}
      </header>
      {notice && <div className="dashboard-notice success">{notice}</div>}
      {error && <div className="dashboard-notice error">{error}</div>}
      <PaymentCollectionRecords
        metrics={data.metrics}
        transactions={data.transactions}
        accounts={data.accounts}
        invoices={invoices}
        refunds={data.refunds}
        canManage={canManage}
        money={money}
        onReconcile={(transaction) => void reconcile(transaction)}
        onIgnore={(transaction) => void ignoreIncoming(transaction)}
        onRequestRefund={(payment) => void requestRefund(payment)}
        onCompleteRefund={(refund) => void complete(refund)}
      />
      {mode && (
        <PaymentCollectionDialog
          mode={mode}
          account={account}
          setAccount={setAccount}
          incoming={incoming}
          setIncoming={setIncoming}
          accounts={data.accounts}
          onClose={() => setMode(null)}
          onSaveAccount={() => void saveAccount()}
          onCaptureIncoming={() => void captureIncoming()}
        />
      )}
    </section>
  );
}
