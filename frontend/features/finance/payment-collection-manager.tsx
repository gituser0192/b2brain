"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import {
  PaymentCollectionRecords,
  type CollectionInvoice,
  type IncomingTransaction as Tx,
  type PaymentAccount as Account,
  type PaymentRefund as Refund,
} from "./payment-collection-records";
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
interface F {
  success: true;
  data: {
    invoices: CollectionInvoice[];
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
export function PaymentCollectionManager() {
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
    [invoices, setInvoices] = useState<F["data"]["invoices"]>([]),
    [mode, setMode] = useState<"account" | "incoming" | null>(null),
    [account, setAccount] = useState(ab),
    [incoming, setIncoming] = useState(ib),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
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
        const [c, f] = await Promise.all([
          authorizedRequest<P>("/payment-collection"),
          authorizedRequest<F>("/finance"),
        ]);
        setData(c.data);
        setInvoices(f.data.invoices);
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
  async function run(task: () => Promise<unknown>, message: string) {
    try {
      await task();
      setMode(null);
      setNotice(message);
      setError("");
      await load();
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
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to capture incoming payment."); }
  }
  async function requestRefund(
    p: F["data"]["invoices"][number]["payments"][number],
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
        <div className="agent-modal">
          <div className="agent-dialog collection-dialog">
            <header>
              <h3>
                {mode === "account"
                  ? "Add payment account"
                  : "Capture incoming payment"}
              </h3>
              <button onClick={() => setMode(null)}>×</button>
            </header>
            {mode === "account" ? (
              <>
                <div className="agent-form-grid">
                  <label>
                    <span>Name</span>
                    <input
                      value={account.name}
                      onChange={(e) =>
                        setAccount({ ...account, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      value={account.type}
                      onChange={(e) =>
                        setAccount({ ...account, type: e.target.value })
                      }
                    >
                      {["BANK", "UPI", "CASH", "PAYMENT_GATEWAY", "OTHER"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    <span>Account identifier (UPI ID / bank account)</span>
                    <input placeholder="Example: harsh@upi or account ending 1234"
                      value={account.identifier}
                      onChange={(e) =>
                        setAccount({ ...account, identifier: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Bank</span>
                    <input
                      value={account.bankName}
                      onChange={(e) =>
                        setAccount({ ...account, bankName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Last 4 digits</span>
                    <input
                      maxLength={4}
                      value={account.accountLast4}
                      onChange={(e) =>
                        setAccount({
                          ...account,
                          accountLast4: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </label>
                </div>
                <footer>
                  <button onClick={() => setMode(null)}>Cancel</button>
                  <button
                    disabled={!account.name || !account.identifier}
                    onClick={() =>
                      void run(
                        () =>
                          authorizedRequest("/payment-collection/accounts", {
                            method: "POST",
                            body: JSON.stringify(account),
                          }),
                        "Payment account added.",
                      )
                    }
                  >
                    Save
                  </button>
                </footer>
              </>
            ) : (
              <>
                <div className="agent-form-grid">
                  <label>
                    <span>Account</span>
                    <select
                      value={incoming.paymentAccountId}
                      onChange={(e) =>
                        setIncoming({
                          ...incoming,
                          paymentAccountId: e.target.value,
                        })
                      }
                    >
                      <option value="">Select</option>
                      {data.accounts
                        .filter((a) => a.isActive)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span>Bank UTR / transaction reference</span>
                    <input
                      placeholder="Include invoice number when available"
                      value={incoming.externalReference}
                      onChange={(e) =>
                        setIncoming({
                          ...incoming,
                          externalReference: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Payer email or phone</span>
                    <input placeholder="Customer contact used for matching" value={incoming.payerContact} onChange={(e) => setIncoming({ ...incoming, payerContact: e.target.value })} />
                  </label>
                  <label>
                    <span>Payer</span>
                    <input
                      value={incoming.payerName}
                      onChange={(e) =>
                        setIncoming({ ...incoming, payerName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Amount</span>
                    <input
                      type="number"
                      min=".01"
                      value={incoming.amount}
                      onChange={(e) =>
                        setIncoming({
                          ...incoming,
                          amount: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Currency</span>
                    <input
                      maxLength={3}
                      value={incoming.currency}
                      onChange={(e) =>
                        setIncoming({
                          ...incoming,
                          currency: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Received</span>
                    <input
                      type="datetime-local"
                      value={incoming.receivedAt}
                      onChange={(e) =>
                        setIncoming({ ...incoming, receivedAt: e.target.value })
                      }
                    />
                  </label>
                </div>
                <footer>
                  <button onClick={() => setMode(null)}>Cancel</button>
                  <button
                    disabled={
                      !incoming.paymentAccountId ||
                      !incoming.externalReference ||
                      incoming.amount <= 0
                    }
                    onClick={() => void captureIncoming()}
                  >
                    Capture
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
