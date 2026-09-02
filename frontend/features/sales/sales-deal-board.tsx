export type DealStage =
  | "PROSPECTING"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export interface SalesDeal {
  id: string;
  name: string;
  stage: DealStage;
  amount: string;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  lostReason: string | null;
  notes: string | null;
  customer: { id: string; displayName: string };
}

interface SalesMetrics {
  openDeals: number;
  pipelineValue: number;
  weightedValue: number;
  wonRevenue: number;
  wonDeals: number;
}

const stages: DealStage[] = [
  "PROSPECTING",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];

export function SalesDealBoard({
  deals,
  metrics,
  money,
  onSelect,
}: {
  deals: SalesDeal[];
  metrics: SalesMetrics;
  money: (value: number, currency?: string) => string;
  onSelect: (deal: SalesDeal) => void;
}) {
  return (
    <>
      <section className="sales-metrics">
        <article>
          <span>Open deals</span>
          <strong>{metrics.openDeals}</strong>
        </article>
        <article>
          <span>Pipeline value</span>
          <strong>{money(metrics.pipelineValue)}</strong>
        </article>
        <article>
          <span>Weighted forecast</span>
          <strong>{money(metrics.weightedValue)}</strong>
        </article>
        <article>
          <span>Won revenue</span>
          <strong>{money(metrics.wonRevenue)}</strong>
        </article>
      </section>

      {deals.length === 0 ? (
        <section className="project-empty">
          <span>◇</span>
          <h3>No sales deals yet</h3>
          <p>Add a real opportunity when a customer enters your sales process.</p>
        </section>
      ) : (
        <section className="deal-board">
          {stages.map((stage) => {
            const stageDeals = deals.filter((deal) => deal.stage === stage);
            return (
              <div key={stage}>
                <header>
                  <strong>{stage.replace("_", " ")}</strong>
                  <span>{stageDeals.length}</span>
                </header>
                {stageDeals.map((deal) => (
                  <article key={deal.id} onClick={() => onSelect(deal)}>
                    <small>{deal.customer.displayName}</small>
                    <h3>{deal.name}</h3>
                    <strong>{money(Number(deal.amount), deal.currency)}</strong>
                    <footer>
                      <span>{deal.probability}% probability</span>
                      <span>
                        {deal.expectedCloseDate
                          ? new Intl.DateTimeFormat("en", {
                              dateStyle: "medium",
                            }).format(new Date(deal.expectedCloseDate))
                          : "No close date"}
                      </span>
                    </footer>
                  </article>
                ))}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
