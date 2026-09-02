"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import type { AssignmentEmployee } from "./lead-assignment-control";
interface Rule {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  source: string | null;
  inquiryType: string | null;
  priority: string | null;
  campaignId: string | null;
  strategy: "FIXED" | "ROUND_ROBIN";
  eligibleEmployeeIds: string[];
  responseTimeMinutes: number;
  escalationAfterMinutes: number | null;
  escalationEmployeeId: string | null;
  followUpSequenceId: string | null;
}
interface RulesResponse {
  success: true;
  data: {
    rules: Rule[];
    employees: AssignmentEmployee[];
    campaigns: { id: string; name: string }[];
    followUpSequences: { id: string; name: string }[];
  };
}
const blank = {
  name: "",
  isActive: true,
  sortOrder: 100,
  source: "",
  inquiryType: "",
  priority: "",
  campaignId: "",
  strategy: "ROUND_ROBIN" as "FIXED" | "ROUND_ROBIN",
  eligibleEmployeeIds: [] as string[],
  responseTimeMinutes: 60,
  escalationAfterMinutes: 120,
  escalationEmployeeId: "",
  followUpSequenceId: "",
};
const sources = [
  "MANUAL",
  "WEBSITE",
  "WHATSAPP",
  "EMAIL",
  "PHONE",
  "SOCIAL",
  "REFERRAL",
  "STORE",
  "OTHER",
];
const types = [
  "UNCLASSIFIED",
  "SALES",
  "PRODUCT_QUESTION",
  "SUPPORT",
  "COMPLAINT",
  "ORDER_REQUEST",
  "PARTNERSHIP",
  "SPAM",
  "OTHER",
];

export function LeadAssignmentManager({
  onChanged,
}: {
  onChanged: () => void;
}) {
  const { authorizedRequest } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [employees, setEmployees] = useState<AssignmentEmployee[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [followUpSequences, setFollowUpSequences] = useState<
    { id: string; name: string }[]
  >([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<RulesResponse>(
        "/inquiries/assignment-rules",
      );
      setRules(response.data.rules);
      setEmployees(response.data.employees);
      setCampaigns(response.data.campaigns);
      setFollowUpSequences(response.data.followUpSequences);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to load assignment rules.",
      );
    }
  }, [authorizedRequest]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  function edit(rule?: Rule) {
    setEditingId(rule?.id ?? "");
    setForm(
      rule
        ? {
            name: rule.name,
            isActive: rule.isActive,
            sortOrder: rule.sortOrder,
            source: rule.source ?? "",
            inquiryType: rule.inquiryType ?? "",
            priority: rule.priority ?? "",
            campaignId: rule.campaignId ?? "",
            strategy: rule.strategy,
            eligibleEmployeeIds: rule.eligibleEmployeeIds,
            responseTimeMinutes: rule.responseTimeMinutes,
            escalationAfterMinutes: rule.escalationAfterMinutes ?? 120,
            escalationEmployeeId: rule.escalationEmployeeId ?? "",
            followUpSequenceId: rule.followUpSequenceId ?? "",
          }
        : blank,
    );
    setOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await authorizedRequest(
        editingId
          ? `/inquiries/assignment-rules/${editingId}`
          : "/inquiries/assignment-rules",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify({
            ...form,
            source: form.source || null,
            inquiryType: form.inquiryType || null,
            priority: form.priority || null,
            campaignId: form.campaignId || null,
            escalationAfterMinutes: form.escalationEmployeeId
              ? form.escalationAfterMinutes
              : null,
            escalationEmployeeId: form.escalationEmployeeId || null,
            followUpSequenceId: form.followUpSequenceId || null,
          }),
        },
      );
      setOpen(false);
      await load();
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to save assignment rule.",
      );
    }
  }
  async function archive(id: string) {
    if (
      !confirm(
        "Archive this assignment rule? Existing assignment history will remain.",
      )
    )
      return;
    try {
      await authorizedRequest(`/inquiries/assignment-rules/${id}`, {
        method: "DELETE",
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to archive assignment rule.",
      );
    }
  }
  const name = (employee: AssignmentEmployee) =>
    `${employee.firstName} ${employee.lastName ?? ""}`.trim();
  return (
    <section className="assignment-rule-manager">
      <header>
        <div>
          <p>Routing automation</p>
          <h3>Lead assignment rules</h3>
          <span>
            Rules are evaluated in order. The first matching rule with an
            available employee wins.
          </span>
        </div>
        <button onClick={() => edit()}>+ New rule</button>
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      {rules.length === 0 ? (
        <div className="assignment-empty">
          <strong>No assignment rules yet</strong>
          <span>
            New inquiries remain unassigned until you create a rule or assign
            them manually.
          </span>
        </div>
      ) : (
        <div className="assignment-rule-list">
          {rules.map((rule) => (
            <article key={rule.id}>
              <div>
                <span>
                  #{rule.sortOrder} · {rule.isActive ? "ACTIVE" : "PAUSED"}
                </span>
                <strong>{rule.name}</strong>
                <small>
                  {[rule.source, rule.inquiryType, rule.priority]
                    .filter(Boolean)
                    .join(" · ") || "All inquiries"}
                </small>
              </div>
              <div>
                <b>{rule.strategy.replace("_", " ")}</b>
                <span>
                  {rule.eligibleEmployeeIds.length} eligible · respond in{" "}
                  {rule.responseTimeMinutes} min
                </span>
              </div>
              <footer>
                <button onClick={() => edit(rule)}>Edit</button>
                <button onClick={() => void archive(rule.id)}>Archive</button>
              </footer>
            </article>
          ))}
        </div>
      )}
      {open && (
        <div className="agent-modal">
          <form className="agent-dialog assignment-rule-dialog" onSubmit={save}>
            <header>
              <div>
                <p>Routing rule</p>
                <h3>
                  {editingId
                    ? "Edit assignment rule"
                    : "Create assignment rule"}
                </h3>
              </div>
              <button type="button" onClick={() => setOpen(false)}>
                ×
              </button>
            </header>
            <div className="agent-form-grid">
              <label>
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                <span>Order</span>
                <input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm({ ...form, sortOrder: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Status</span>
                <select
                  value={form.isActive ? "ACTIVE" : "PAUSED"}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isActive: event.target.value === "ACTIVE",
                    })
                  }
                >
                  <option>ACTIVE</option>
                  <option>PAUSED</option>
                </select>
              </label>
              <label>
                <span>Source condition</span>
                <select
                  value={form.source}
                  onChange={(event) =>
                    setForm({ ...form, source: event.target.value })
                  }
                >
                  <option value="">Any source</option>
                  {sources.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Type condition</span>
                <select
                  value={form.inquiryType}
                  onChange={(event) =>
                    setForm({ ...form, inquiryType: event.target.value })
                  }
                >
                  <option value="">Any type</option>
                  {types.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority condition</span>
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm({ ...form, priority: event.target.value })
                  }
                >
                  <option value="">Any priority</option>
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Campaign condition</span>
                <select
                  value={form.campaignId}
                  onChange={(event) =>
                    setForm({ ...form, campaignId: event.target.value })
                  }
                >
                  <option value="">Any campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Strategy</span>
                <select
                  value={form.strategy}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      strategy: event.target.value as typeof form.strategy,
                      eligibleEmployeeIds:
                        event.target.value === "FIXED"
                          ? form.eligibleEmployeeIds.slice(0, 1)
                          : form.eligibleEmployeeIds,
                    })
                  }
                >
                  <option value="ROUND_ROBIN">Round robin</option>
                  <option value="FIXED">Fixed employee</option>
                </select>
              </label>
              <label>
                <span>Response time (minutes)</span>
                <input
                  type="number"
                  min="5"
                  value={form.responseTimeMinutes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      responseTimeMinutes: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                <span>Escalate after (minutes)</span>
                <input
                  type="number"
                  min="5"
                  value={form.escalationAfterMinutes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      escalationAfterMinutes: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                <span>Escalate to</span>
                <select
                  value={form.escalationEmployeeId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      escalationEmployeeId: event.target.value,
                    })
                  }
                >
                  <option value="">No escalation</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {name(employee)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Start follow-up sequence</span>
                <select
                  value={form.followUpSequenceId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      followUpSequenceId: event.target.value,
                    })
                  }
                >
                  <option value="">Do not start automatically</option>
                  {followUpSequences.map((sequence) => (
                    <option key={sequence.id} value={sequence.id}>
                      {sequence.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend>Eligible employees</legend>
              {employees.map((employee) => (
                <label key={employee.id}>
                  <input
                    type="checkbox"
                    checked={form.eligibleEmployeeIds.includes(employee.id)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        eligibleEmployeeIds: event.target.checked
                          ? form.strategy === "FIXED"
                            ? [employee.id]
                            : [...form.eligibleEmployeeIds, employee.id]
                          : form.eligibleEmployeeIds.filter(
                              (id) => id !== employee.id,
                            ),
                      })
                    }
                  />
                  <span>
                    {name(employee)} <small>{employee.jobTitle}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <footer>
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                disabled={
                  form.name.length < 2 || form.eligibleEmployeeIds.length === 0
                }
              >
                Save rule
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
