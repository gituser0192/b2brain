"use client";

import type { Dispatch, SetStateAction } from "react";

export type InquiryFormValues = {
  source: string;
  type: string;
  status: string;
  priority: string;
  contactName: string;
  email: string;
  phone: string;
  companyName: string;
  subject: string;
  message: string;
  campaignId: string;
  assignedEmployeeId: string;
  responseDueAt: string;
  disqualifiedReason: string;
};

export type DuplicateInquiry = {
  inquiryId: string;
  contactName: string;
  subject: string;
};

type Reference = {
  id: string;
  firstName?: string;
  lastName?: string | null;
  name?: string;
};

const selectOptions = {
  source: [
    "MANUAL",
    "WEBSITE",
    "WHATSAPP",
    "EMAIL",
    "PHONE",
    "SOCIAL",
    "REFERRAL",
    "STORE",
    "OTHER",
  ],
  type: [
    "UNCLASSIFIED",
    "SALES",
    "PRODUCT_QUESTION",
    "SUPPORT",
    "COMPLAINT",
    "ORDER_REQUEST",
    "PARTNERSHIP",
    "SPAM",
    "OTHER",
  ],
  status: ["NEW", "REVIEWING", "QUALIFIED", "DISQUALIFIED", "SPAM"],
  priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
};

export function InquiryFormDialog({
  isEditing,
  form,
  setForm,
  employees,
  campaigns,
  duplicate,
  onClose,
  onOpenDuplicate,
  onMergeDuplicate,
  onSave,
}: {
  isEditing: boolean;
  form: InquiryFormValues;
  setForm: Dispatch<SetStateAction<InquiryFormValues>>;
  employees: Reference[];
  campaigns: Reference[];
  duplicate: DuplicateInquiry | null;
  onClose: () => void;
  onOpenDuplicate: () => void;
  onMergeDuplicate: () => void;
  onSave: (allowDuplicate?: boolean) => void;
}) {
  return (
    <div className="agent-modal">
      <div className="agent-dialog inquiry-dialog">
        <header>
          <h3>{isEditing ? "Update" : "Capture"} inquiry</h3>
          <button onClick={onClose}>×</button>
        </header>
        <div className="agent-form-grid">
          {(["source", "type", "status", "priority"] as const).map((key) => (
            <label key={key}>
              <span>{key}</span>
              <select
                value={form[key]}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
              >
                {selectOptions[key].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
          {(["contactName", "companyName", "email", "phone"] as const).map(
            (key) => (
              <label key={key}>
                <span>{key}</span>
                <input
                  value={form[key]}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                />
              </label>
            ),
          )}
          <label>
            <span>Assigned employee</span>
            <select
              value={form.assignedEmployeeId}
              onChange={(event) =>
                setForm({ ...form, assignedEmployeeId: event.target.value })
              }
            >
              <option value="">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Campaign</span>
            <select
              value={form.campaignId}
              onChange={(event) =>
                setForm({ ...form, campaignId: event.target.value })
              }
            >
              <option value="">None</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Response due</span>
            <input
              type="datetime-local"
              value={form.responseDueAt}
              onChange={(event) =>
                setForm({ ...form, responseDueAt: event.target.value })
              }
            />
          </label>
        </div>
        <label>
          <span>Subject</span>
          <input
            value={form.subject}
            onChange={(event) =>
              setForm({ ...form, subject: event.target.value })
            }
          />
        </label>
        <label>
          <span>Message</span>
          <textarea
            rows={4}
            value={form.message}
            onChange={(event) =>
              setForm({ ...form, message: event.target.value })
            }
          />
        </label>
        {form.status === "DISQUALIFIED" && (
          <label>
            <span>Reason</span>
            <textarea
              value={form.disqualifiedReason}
              onChange={(event) =>
                setForm({ ...form, disqualifiedReason: event.target.value })
              }
            />
          </label>
        )}
        {duplicate && (
          <section className="inquiry-duplicate-warning">
            <strong>Possible duplicate inquiry</strong>
            <p>
              {duplicate.contactName} already has an open “{duplicate.subject}”
              inquiry.
            </p>
            <div>
              <button onClick={onOpenDuplicate}>Open existing</button>
              <button onClick={onMergeDuplicate}>Attach this message</button>
              <button onClick={() => onSave(true)}>Create separately</button>
            </div>
          </section>
        )}
        <footer>
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={
              !form.contactName ||
              !form.subject ||
              !form.message ||
              (!form.email && !form.phone)
            }
            onClick={() => onSave()}
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
