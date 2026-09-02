"use client";

export type DealConversion = {
  name: string;
  amount: number;
  currency: string;
  probability: number;
  expectedCloseDate: string;
};

export function DealConversionDialog({
  value,
  onChange,
  onClose,
  onConvert,
}: {
  value: DealConversion;
  onChange: (value: DealConversion) => void;
  onClose: () => void;
  onConvert: () => void;
}) {
  return (
    <div className="agent-modal">
      <div className="agent-dialog">
        <header>
          <div>
            <p>Qualified inquiry</p>
            <h3>Convert to sales deal</h3>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <div className="dashboard-notice">
          The CRM customer will be linked or created automatically. Existing
          inquiry follow-ups will stop after conversion.
        </div>
        <label>
          <span>Deal name</span>
          <input
            value={value.name}
            onChange={(event) =>
              onChange({ ...value, name: event.target.value })
            }
          />
        </label>
        <div className="agent-form-grid">
          <label>
            <span>Expected value</span>
            <input
              type="number"
              min="0"
              value={value.amount}
              onChange={(event) =>
                onChange({ ...value, amount: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>Currency</span>
            <input
              maxLength={3}
              value={value.currency}
              onChange={(event) =>
                onChange({
                  ...value,
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
              value={value.probability}
              onChange={(event) =>
                onChange({
                  ...value,
                  probability: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            <span>Expected closing date</span>
            <input
              type="date"
              value={value.expectedCloseDate}
              onChange={(event) =>
                onChange({ ...value, expectedCloseDate: event.target.value })
              }
            />
          </label>
        </div>
        <footer>
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={
              value.name.trim().length < 2 ||
              value.amount < 0 ||
              value.currency.length !== 3
            }
            onClick={onConvert}
          >
            Convert inquiry
          </button>
        </footer>
      </div>
    </div>
  );
}
