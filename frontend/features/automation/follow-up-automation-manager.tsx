"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
type Channel = "TASK" | "WHATSAPP" | "EMAIL" | "CALL";
interface Step {
  id: string;
  stepOrder: number;
  delayMinutes: number;
  channel: Channel;
  title: string;
  messageTemplate: string;
  requiresApproval: boolean;
}
interface Sequence {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  stopOnResponse: boolean;
  stopOnWonDeal: boolean;
  steps: Step[];
  _count: { enrollments: number };
}
interface Enrollment {
  id: string;
  status: string;
  targetName: string;
  nextStepAt: string | null;
  sequence: { name: string };
}
interface Execution {
  id: string;
  status: "DUE" | "AWAITING_APPROVAL";
  renderedTitle: string;
  renderedMessage: string;
  dueAt: string;
  targetName: string;
  enrollment: { sequence: { name: string } };
}
interface Payload {
  success: true;
  data: {
    sequences: Sequence[];
    enrollments: Enrollment[];
    dueExecutions: Execution[];
    inquiries: { id: string; contactName: string; subject: string }[];
    customers: { id: string; displayName: string }[];
    metrics: {
      activeSequences: number;
      activeEnrollments: number;
      due: number;
      awaitingApproval: number;
    };
  };
}
const newStep = (order = 1): Omit<Step, "id"> => ({
  stepOrder: order,
  delayMinutes: 1440,
  channel: "TASK",
  title: "Follow up with {contactName}",
  messageTemplate: "Follow up regarding {subject}.",
  requiresApproval: false,
});
const blank = () => ({
  name: "",
  description: "",
  isActive: true,
  stopOnResponse: true,
  stopOnWonDeal: true,
  steps: [newStep()],
});
export function FollowUpAutomationManager() {
  const { authorizedRequest } = useAuth();
  const [data, setData] = useState<Payload["data"]>({
    sequences: [],
    enrollments: [],
    dueExecutions: [],
    inquiries: [],
    customers: [],
    metrics: {
      activeSequences: 0,
      activeEnrollments: 0,
      due: 0,
      awaitingApproval: 0,
    },
  });
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState("");
  const [open, setOpen] = useState(false);
  const [enrollment, setEnrollment] = useState({
    sequenceId: "",
    targetType: "INQUIRY" as "INQUIRY" | "CUSTOMER",
    targetId: "",
  });
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await authorizedRequest<Payload>("/follow-up-automation");
      setData(r.data);
      setError("");
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Unable to load follow-up automation.",
      );
    }
  }, [authorizedRequest]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  function show(item?: Sequence) {
    setEditing(item?.id ?? "");
    setForm(
      item
        ? {
            name: item.name,
            description: item.description ?? "",
            isActive: item.isActive,
            stopOnResponse: item.stopOnResponse,
            stopOnWonDeal: item.stopOnWonDeal,
            steps: item.steps.map((step) => ({
              stepOrder: step.stepOrder,
              delayMinutes: step.delayMinutes,
              channel: step.channel,
              title: step.title,
              messageTemplate: step.messageTemplate,
              requiresApproval: step.requiresApproval,
            })),
          }
        : blank(),
    );
    setOpen(true);
  }
  async function save() {
    try {
      await authorizedRequest(
        editing
          ? `/follow-up-automation/sequences/${editing}`
          : "/follow-up-automation/sequences",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            ...form,
            description: form.description || null,
            steps: form.steps.map((step, index) => ({
              ...step,
              stepOrder: index + 1,
              requiresApproval: ["WHATSAPP", "EMAIL"].includes(step.channel)
                ? true
                : step.requiresApproval,
            })),
          }),
        },
      );
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to save sequence.");
    }
  }
  async function enroll() {
    try {
      await authorizedRequest("/follow-up-automation/enrollments", {
        method: "POST",
        body: JSON.stringify(enrollment),
      });
      setEnrollment({ ...enrollment, targetId: "" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to start sequence.");
    }
  }
  async function complete(item: Execution) {
    const outcome = prompt(
      item.status === "AWAITING_APPROVAL"
        ? "Record what happened after reviewing and sending (or choosing not to send)."
        : "Record the follow-up outcome.",
    );
    if (!outcome?.trim()) return;
    try {
      await authorizedRequest(
        `/follow-up-automation/executions/${item.id}/complete`,
        { method: "PATCH", body: JSON.stringify({ outcome }) },
      );
      await load();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to complete follow-up.",
      );
    }
  }
  const targets =
    enrollment.targetType === "INQUIRY"
      ? data.inquiries.map((i) => ({
          id: i.id,
          label: `${i.contactName} · ${i.subject}`,
        }))
      : data.customers.map((c) => ({ id: c.id, label: c.displayName }));
  return (
    <section className="follow-up-automation">
      <header>
        <div>
          <p>Revenue follow-up</p>
          <h3>Follow-up sequences</h3>
          <span>
            Schedule consistent outreach while keeping every customer message
            under human approval.
          </span>
        </div>
        <button onClick={() => show()}>+ New sequence</button>
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      <div className="follow-up-auto-metrics">
        <article>
          <span>Active sequences</span>
          <strong>{data.metrics.activeSequences}</strong>
        </article>
        <article>
          <span>Active enrollments</span>
          <strong>{data.metrics.activeEnrollments}</strong>
        </article>
        <article>
          <span>Due actions</span>
          <strong>{data.metrics.due}</strong>
        </article>
        <article>
          <span>Awaiting approval</span>
          <strong>{data.metrics.awaitingApproval}</strong>
        </article>
      </div>
      <div className="follow-up-enroll">
        <strong>Start a sequence</strong>
        <select
          value={enrollment.sequenceId}
          onChange={(e) =>
            setEnrollment({ ...enrollment, sequenceId: e.target.value })
          }
        >
          <option value="">Select active sequence</option>
          {data.sequences
            .filter((s) => s.isActive)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        <select
          value={enrollment.targetType}
          onChange={(e) =>
            setEnrollment({
              sequenceId: enrollment.sequenceId,
              targetType: e.target.value as typeof enrollment.targetType,
              targetId: "",
            })
          }
        >
          <option value="INQUIRY">Inquiry</option>
          <option value="CUSTOMER">CRM customer</option>
        </select>
        <select
          value={enrollment.targetId}
          onChange={(e) =>
            setEnrollment({ ...enrollment, targetId: e.target.value })
          }
        >
          <option value="">Select record</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          disabled={!enrollment.sequenceId || !enrollment.targetId}
          onClick={() => void enroll()}
        >
          Start
        </button>
      </div>
      {data.dueExecutions.length > 0 && (
        <div className="follow-up-due">
          <h4>Work requiring attention</h4>
          {data.dueExecutions.map((item) => (
            <article key={item.id}>
              <div>
                <span>
                  {item.status.replaceAll("_", " ")} ·{" "}
                  {item.enrollment.sequence.name}
                </span>
                <strong>{item.renderedTitle}</strong>
                <small>
                  {item.targetName} · due{" "}
                  {new Date(item.dueAt).toLocaleString()}
                </small>
                <p>{item.renderedMessage}</p>
              </div>
              <button onClick={() => void complete(item)}>
                {item.status === "AWAITING_APPROVAL"
                  ? "Review & record"
                  : "Complete"}
              </button>
            </article>
          ))}
        </div>
      )}
      <div className="follow-up-sequence-grid">
        {data.sequences.length === 0 ? (
          <div className="assignment-empty">
            <strong>No sequences configured</strong>
            <span>
              Create a sequence from real business needs. Nothing is seeded.
            </span>
          </div>
        ) : (
          data.sequences.map((item) => (
            <article key={item.id}>
              <header>
                <span>{item.isActive ? "ACTIVE" : "PAUSED"}</span>
                <button onClick={() => show(item)}>Edit</button>
              </header>
              <h4>{item.name}</h4>
              <p>{item.description || "No description."}</p>
              <div>
                {item.steps.map((step) => (
                  <span key={step.id}>
                    {step.stepOrder}. {step.channel} after {step.delayMinutes}{" "}
                    min
                  </span>
                ))}
              </div>
              <footer>
                {item._count.enrollments} enrollments ·{" "}
                {item.stopOnResponse
                  ? "stops on response"
                  : "continues after response"}
              </footer>
            </article>
          ))
        )}
      </div>
      {open && (
        <div className="agent-modal">
          <div className="agent-dialog follow-up-dialog">
            <header>
              <div>
                <p>Sequence builder</p>
                <h3>{editing ? "Edit sequence" : "Create sequence"}</h3>
              </div>
              <button onClick={() => setOpen(false)}>×</button>
            </header>
            <label>
              <span>Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <div className="follow-up-stop">
              <label>
                <input
                  type="checkbox"
                  checked={form.stopOnResponse}
                  onChange={(e) =>
                    setForm({ ...form, stopOnResponse: e.target.checked })
                  }
                />{" "}
                Stop when inquiry responds/closes
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.stopOnWonDeal}
                  onChange={(e) =>
                    setForm({ ...form, stopOnWonDeal: e.target.checked })
                  }
                />{" "}
                Stop when customer has a won deal
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />{" "}
                Active
              </label>
            </div>
            <section className="follow-up-step-editor">
              <header>
                <strong>Steps</strong>
                <button
                  onClick={() =>
                    setForm({
                      ...form,
                      steps: [...form.steps, newStep(form.steps.length + 1)],
                    })
                  }
                >
                  + Step
                </button>
              </header>
              {form.steps.map((step, index) => (
                <article key={index}>
                  <span>{index + 1}</span>
                  <select
                    value={step.channel}
                    onChange={(e) => {
                      const steps = [...form.steps];
                      steps[index] = {
                        ...step,
                        channel: e.target.value as Channel,
                        requiresApproval: ["WHATSAPP", "EMAIL"].includes(
                          e.target.value,
                        ),
                      };
                      setForm({ ...form, steps });
                    }}
                  >
                    {["TASK", "CALL", "WHATSAPP", "EMAIL"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={step.delayMinutes}
                    title="Delay in minutes"
                    onChange={(e) => {
                      const steps = [...form.steps];
                      steps[index] = {
                        ...step,
                        delayMinutes: Number(e.target.value),
                      };
                      setForm({ ...form, steps });
                    }}
                  />
                  <input
                    value={step.title}
                    placeholder="Title"
                    onChange={(e) => {
                      const steps = [...form.steps];
                      steps[index] = { ...step, title: e.target.value };
                      setForm({ ...form, steps });
                    }}
                  />
                  <textarea
                    value={step.messageTemplate}
                    placeholder="Use {contactName}, {companyName}, {subject}"
                    onChange={(e) => {
                      const steps = [...form.steps];
                      steps[index] = {
                        ...step,
                        messageTemplate: e.target.value,
                      };
                      setForm({ ...form, steps });
                    }}
                  />
                  <button
                    disabled={form.steps.length === 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        steps: form.steps.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove
                  </button>
                </article>
              ))}
            </section>
            <footer>
              <button onClick={() => setOpen(false)}>Cancel</button>
              <button
                disabled={
                  form.name.length < 2 ||
                  form.steps.some(
                    (s) => s.title.length < 2 || s.messageTemplate.length < 2,
                  )
                }
                onClick={() => void save()}
              >
                Save sequence
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
