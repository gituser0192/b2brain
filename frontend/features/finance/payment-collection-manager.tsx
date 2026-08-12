"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
type Account = {
  id: string;
  name: string;
  type: string;
  identifier: string;
  isActive: boolean;
};
type Tx = {
  id: string;
  externalReference: string;
  payerName: string | null;
  amount: string;
  currency: string;
  receivedAt: string;
  status: string;
  paymentAccount: { name: string };
  payment: { receiptNumber: string; invoice: { invoiceNumber: string } } | null;
};
type Refund = {
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
    invoices: {
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
    }[];
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
      <div className="collection-metrics">
        <article>
          <span>Active accounts</span>
          <strong>{data.metrics.activeAccounts}</strong>
        </article>
        <article className={data.metrics.unmatchedCount ? "warning" : ""}>
          <span>Unmatched</span>
          <strong>{data.metrics.unmatchedCount}</strong>
          <small>{money(data.metrics.unmatchedValue)}</small>
        </article>
        <article>
          <span>Reconciled</span>
          <strong>{money(data.metrics.matchedValue)}</strong>
        </article>
        <article>
          <span>Refund approvals</span>
          <strong>{data.metrics.pendingRefunds}</strong>
        </article>
      </div>
      <div className="collection-columns">
        <section>
          <h3>Incoming transactions</h3>
          {data.transactions.length ? (
            data.transactions.map((t) => (
              <article key={t.id}>
                <div>
                  <small>
                    {t.paymentAccount.name} · {t.externalReference}
                  </small>
                  <strong>{t.payerName || "Payer not specified"}</strong>
                  <span>{new Date(t.receivedAt).toLocaleString()}</span>
                  {t.payment && (
                    <b>
                      {t.payment.receiptNumber} ·{" "}
                      {t.payment.invoice.invoiceNumber}
                    </b>
                  )}
                </div>
                <strong>{money(Number(t.amount), t.currency)}</strong>
                <i>{t.status}</i>
                {canManage && t.status === "UNMATCHED" && (
                  <button onClick={() => void reconcile(t)}>
                    Match invoice
                  </button>
                )}
              </article>
            ))
          ) : (
            <p>No incoming payments captured.</p>
          )}
        </section>
        <section>
          <h3>Payment accounts</h3>
          {data.accounts.length ? (
            data.accounts.map((a) => (
              <article key={a.id}>
                <div>
                  <small>{a.type}</small>
                  <strong>{a.name}</strong>
                  <span>{a.identifier}</span>
                </div>
                <i>{a.isActive ? "ACTIVE" : "INACTIVE"}</i>
              </article>
            ))
          ) : (
            <p>Add a bank, UPI, cash, or gateway account.</p>
          )}
        </section>
      </div>
      <section className="receipt-register">
        <header>
          <h3>Receipts & refunds</h3>
          <span>Refunds require approval by a different authorized user.</span>
        </header>
        {invoices
          .flatMap((i) => i.payments.map((p) => ({ i, p })))
          .map(({ i, p }) => (
            <article key={p.id}>
              <div>
                <strong>{p.receiptNumber}</strong>
                <small>
                  {i.invoiceNumber} · {i.customer.displayName}
                </small>
              </div>
              <span>{money(Number(p.amount), i.currency)}</span>
              <span>
                {Number(p.refundedAmount)
                  ? `${money(Number(p.refundedAmount), i.currency)} refunded`
                  : "No refunds"}
              </span>
              {canManage && Number(p.amount) > Number(p.refundedAmount) && (
                <button onClick={() => void requestRefund(p)}>
                  Request refund
                </button>
              )}
            </article>
          ))}
        {data.refunds.map((r) => (
          <article key={r.id}>
            <div>
              <strong>Refund · {r.payment.receiptNumber}</strong>
              <small>
                {r.payment.invoice.invoiceNumber} · {r.reason}
              </small>
            </div>
            <span>{money(Number(r.amount), r.payment.currency)}</span>
            <i>{r.status.replaceAll("_", " ")}</i>
            {canManage && r.status === "APPROVED" && (
              <button onClick={() => void complete(r)}>Mark completed</button>
            )}
          </article>
        ))}
      </section>
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
                    <span>Identifier</span>
                    <input
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
                    <span>Reference</span>
                    <input
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
                    onClick={() =>
                      void run(
                        () =>
                          authorizedRequest("/payment-collection/incoming", {
                            method: "POST",
                            body: JSON.stringify({
                              ...incoming,
                              receivedAt: new Date(
                                incoming.receivedAt,
                              ).toISOString(),
                            }),
                          }),
                        "Incoming payment captured.",
                      )
                    }
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
