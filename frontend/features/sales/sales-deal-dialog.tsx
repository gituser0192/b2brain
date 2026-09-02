import type { DealStage, SalesDeal } from "./sales-deal-board";

export interface DealFormState {
  customerId: string;
  name: string;
  stage: DealStage;
  amount: number;
  currency: string;
  probability: number;
  expectedCloseDate: string;
  lostReason: string;
  notes: string;
}

export const dealStageDefaults: Record<DealStage, number> = {
  PROSPECTING: 10,
  QUALIFIED: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

export function SalesDealDialog({
  editing,
  form,
  customers,
  onChange,
  onClose,
  onSave,
}: {
  editing: SalesDeal | null;
  form: DealFormState;
  customers: { id: string; displayName: string }[];
  onChange: (form: DealFormState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="agent-modal">
      <div className="agent-dialog">
        <header>
          <div>
            <p>Sales opportunity</p>
            <h3>{editing ? "Update deal" : "Create deal"}</h3>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <label>
          <span>Customer</span>
          <select
            value={form.customerId}
            onChange={(event) =>
              onChange({ ...form, customerId: event.target.value })
            }
          >
            <option value="">Select CRM customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Deal name</span>
          <input
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
          />
        </label>
        <div className="agent-form-grid">
          <label>
            <span>Stage</span>
            <select
              value={form.stage}
              onChange={(event) => {
                const stage = event.target.value as DealStage;
                onChange({
                  ...form,
                  stage,
                  probability: dealStageDefaults[stage],
                });
              }}
            >
              {Object.keys(dealStageDefaults).map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Amount</span>
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(event) =>
                onChange({ ...form, amount: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>Currency</span>
            <input
              maxLength={3}
              value={form.currency}
              onChange={(event) =>
                onChange({
                  ...form,
                  currency: event.target.value.toUpperCase(),
                })
              }
            />
          </label>
          <label>
            <span>Probability %</span>
            <input
              type="number"
              min="0"
              max="100"
              value={form.probability}
              onChange={(event) =>
                onChange({ ...form, probability: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>Expected close</span>
            <input
              type="date"
              value={form.expectedCloseDate}
              onChange={(event) =>
                onChange({ ...form, expectedCloseDate: event.target.value })
              }
            />
          </label>
        </div>
        {form.stage === "LOST" && (
          <label>
            <span>Lost reason</span>
            <input
              value={form.lostReason}
              onChange={(event) =>
                onChange({ ...form, lostReason: event.target.value })
              }
            />
          </label>
        )}
        <label>
          <span>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) =>
              onChange({ ...form, notes: event.target.value })
            }
          />
        </label>
        <footer>
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={
              !form.customerId ||
              form.name.length < 2 ||
              form.amount < 0 ||
              form.currency.length !== 3 ||
              (form.stage === "LOST" && !form.lostReason)
            }
            onClick={onSave}
          >
            Save deal
          </button>
        </footer>
      </div>
    </div>
  );
}
