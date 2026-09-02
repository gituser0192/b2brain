"use client";

export type QuotationStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CONVERTED"
  | "CANCELED";

export interface Quotation {
  id: string;
  quotationNumber: string;
  status: QuotationStatus;
  issueDate: string;
  validUntil: string;
  currency: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  notes: string | null;
  terms: string | null;
  nextFollowUpAt: string | null;
  customer: { id: string; displayName: string };
  inquiry: { id: string; subject: string } | null;
  deal: { id: string; name: string } | null;
  invoice: { id: string; invoiceNumber: string; status: string } | null;
  items: {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
  }[];
}

type QuotationMetrics = {
  total: number;
  draft: number;
  awaitingDecision: number;
  acceptedValue: number;
  openValue: number;
  expiringSoon: number;
};

export function QuotationList({
  quotations,
  metrics,
  organizationCurrency,
  canManage,
  canConvert,
  money,
  onShare,
  onEdit,
  onStatus,
  onFollowUp,
  onConvert,
}: {
  quotations: Quotation[];
  metrics: QuotationMetrics;
  organizationCurrency?: string;
  canManage: boolean;
  canConvert: boolean;
  money: (value: number, currency?: string) => string;
  onShare: (item: Quotation, channel: "EMAIL" | "WHATSAPP" | "LINK") => void;
  onEdit: (item: Quotation) => void;
  onStatus: (
    item: Quotation,
    status: "SENT" | "ACCEPTED" | "REJECTED" | "CANCELED",
  ) => void;
  onFollowUp: (item: Quotation) => void;
  onConvert: (item: Quotation) => void;
}) {
  return (
    <>
      <div className="quotation-metrics">
        <article><span>Open value</span><strong>{money(metrics.openValue, organizationCurrency)}</strong></article>
        <article><span>Awaiting decision</span><strong>{metrics.awaitingDecision}</strong></article>
        <article><span>Accepted value</span><strong>{money(metrics.acceptedValue, organizationCurrency)}</strong></article>
        <article className={metrics.expiringSoon ? "warning" : ""}><span>Expiring in 3 days</span><strong>{metrics.expiringSoon}</strong></article>
      </div>
      {quotations.length === 0 ? (
        <div className="quotation-empty">
          <strong>No quotations yet</strong>
          <span>Create the first quotation from a real CRM customer. Nothing is pre-filled or seeded.</span>
        </div>
      ) : (
        <div className="quotation-list">
          {quotations.map((item) => (
            <article key={item.id} className={`status-${item.status.toLowerCase()}`}>
              <div>
                <span>{item.status}</span>
                <h3>{item.quotationNumber}</h3>
                <p>{item.customer.displayName}{item.deal ? ` · ${item.deal.name}` : ""}</p>
                <small>Valid until {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.validUntil))}</small>
              </div>
              <div className="quotation-value">
                <strong>{money(Number(item.total), item.currency)}</strong>
                <small>{item.items.length} line item{item.items.length === 1 ? "" : "s"}</small>
                {item.invoice && <b>Invoice {item.invoice.invoiceNumber}</b>}
              </div>
              {canManage && (
                <footer>
                  <button onClick={() => onShare(item, "LINK")}>Preview / PDF</button>
                  <button onClick={() => onShare(item, "EMAIL")}>Email</button>
                  <button onClick={() => onShare(item, "WHATSAPP")}>WhatsApp draft</button>
                  {["DRAFT", "SENT", "EXPIRED"].includes(item.status) && <button onClick={() => onEdit(item)}>Edit</button>}
                  {["DRAFT", "EXPIRED"].includes(item.status) && <button onClick={() => onStatus(item, "SENT")}>Mark sent</button>}
                  {item.status === "SENT" && <><button onClick={() => onStatus(item, "ACCEPTED")}>Accept</button><button onClick={() => onStatus(item, "REJECTED")}>Reject</button></>}
                  {["DRAFT", "SENT", "EXPIRED"].includes(item.status) && <button onClick={() => onFollowUp(item)}>Follow-up</button>}
                  {item.status === "ACCEPTED" && canConvert && <button className="convert" onClick={() => onConvert(item)}>Create invoice</button>}
                </footer>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
