"use client";

import { useState } from "react";

import {
  LeadAssignmentControl,
  type AssignmentEmployee,
} from "./lead-assignment-control";

export type InquiryItem = {
  id: string;
  source: string;
  type: string;
  status: string;
  priority: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  subject: string;
  message: string;
  campaignId: string | null;
  assignedEmployeeId: string | null;
  responseDueAt: string | null;
  disqualifiedReason: string | null;
  nextFollowUpAt: string | null;
  followUpNote: string | null;
  followUpCompletedAt: string | null;
  createdAt: string;
  customer: {
    displayName: string;
    email: string | null;
    phone: string | null;
  } | null;
  assignedEmployee: { firstName: string; lastName: string | null } | null;
  timeline: {
    id: string;
    summary: string;
    details: string | null;
    createdAt: string;
    createdBy: { firstName: string };
  }[];
};

type ConversionTarget = "CUSTOMER" | "DEAL" | "SUPPORT";

export function InquiryInbox({
  items,
  chosen,
  metrics,
  employees,
  canManage,
  canConvert,
  onChoose,
  onEdit,
  onChanged,
  onLogContact,
  onScheduleFollowUp,
  onCompleteFollowUp,
  onConvert,
  onAddNote,
}: {
  items: InquiryItem[];
  chosen: InquiryItem | null;
  metrics: Record<string, number>;
  employees: AssignmentEmployee[];
  canManage: boolean;
  canConvert: boolean;
  onChoose: (item: InquiryItem) => void;
  onEdit: (item: InquiryItem) => void;
  onChanged: () => void;
  onLogContact: () => void;
  onScheduleFollowUp: () => void;
  onCompleteFollowUp: () => void;
  onConvert: (target: ConversionTarget) => void;
  onAddNote: () => void;
}) {
  const [stage, setStage] = useState("ALL");
  const stages = [
    ["ALL", "All"], ["NEW", "New"], ["REVIEWING", "Contacted"],
    ["QUALIFIED", "Qualified"], ["CONVERTED", "Won"],
    ["DISQUALIFIED", "Lost"], ["SPAM", "Spam"],
  ];
  const visibleItems = stage === "ALL" ? items : items.filter((item) => item.status === stage);
  const selectStage = (value: string) => {
    setStage(value);
    const next = value === "ALL" ? items[0] : items.find((item) => item.status === value);
    if (next) onChoose(next);
  };
  return (
    <>
      <section className="inquiry-metrics">
        {Object.entries(metrics).map(([key, value]) => (
          <article key={key}>
            <span>{key}</span>
            <strong>
              {key === "conversionRate" ? `${value.toFixed(0)}%` : value}
            </strong>
          </article>
        ))}
      </section>
      <nav className="inquiry-pipeline" aria-label="Inquiry pipeline">
        {stages.map(([value, label]) => <button key={value} className={stage === value ? "active" : ""} onClick={() => selectStage(value)}><span>{label}</span><strong>{value === "ALL" ? items.length : items.filter((item) => item.status === value).length}</strong></button>)}
      </nav>
      {!items.length ? (
        <section className="project-empty">
          <span>◇</span>
          <h3>No inquiries yet</h3>
          <p>
            Your workspace starts empty. Capture the first real inquiry when it
            arrives.
          </p>
        </section>
      ) : !visibleItems.length ? <section className="project-empty"><span>◇</span><h3>No inquiries in this stage</h3><p>Choose another pipeline stage to continue.</p></section> : (
        <div className="inquiry-layout">
          <section className="inquiry-list">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                className={chosen?.id === item.id ? "active" : ""}
                onClick={() => onChoose(item)}
              >
                <span>
                  {item.source} · {item.priority}
                </span>
                <strong>{item.subject}</strong>
                <p>{item.contactName}</p>
                <b>
                  {item.type.replaceAll("_", " ")} · {item.status}
                </b>
              </button>
            ))}
          </section>
          {chosen && (
            <section className="inquiry-detail">
              <header>
                <div>
                  <p>
                    {chosen.source} · {new Date(chosen.createdAt).toLocaleString()}
                  </p>
                  <h3>{chosen.subject}</h3>
                  <span>
                    {chosen.contactName} · {chosen.email || chosen.phone}
                  </span>
                </div>
                {canManage && chosen.status !== "CONVERTED" && (
                  <button onClick={() => onEdit(chosen)}>Edit</button>
                )}
              </header>
              {chosen.customer && (
                <div className="duplicate-match">
                  <strong>Existing CRM match</strong>
                  <span>{chosen.customer.displayName}</span>
                </div>
              )}
              <div className="ticket-description">
                <p>{chosen.message}</p>
              </div>
              {canManage &&
                !["CONVERTED", "DISQUALIFIED", "SPAM"].includes(
                  chosen.status,
                ) && (
                  <LeadAssignmentControl
                    key={`${chosen.id}:${chosen.assignedEmployeeId ?? "unassigned"}`}
                    inquiryId={chosen.id}
                    assignedEmployeeId={chosen.assignedEmployeeId}
                    employees={employees}
                    onChanged={onChanged}
                  />
                )}
              {canManage &&
                !["CONVERTED", "DISQUALIFIED", "SPAM"].includes(
                  chosen.status,
                ) && (
                  <div className="lead-action-bar">
                    <button onClick={onLogContact}>Log contact</button>
                    <button onClick={onScheduleFollowUp}>
                      {chosen.nextFollowUpAt && !chosen.followUpCompletedAt
                        ? "Reschedule follow-up"
                        : "Schedule follow-up"}
                    </button>
                  </div>
                )}
              {chosen.nextFollowUpAt && (
                <div
                  className={`lead-follow-up ${!chosen.followUpCompletedAt && new Date(chosen.nextFollowUpAt) < new Date() ? "overdue" : ""}`}
                >
                  <div>
                    <strong>
                      {chosen.followUpCompletedAt
                        ? "Follow-up completed"
                        : "Next follow-up"}
                    </strong>
                    <p>{chosen.followUpNote}</p>
                    <small>
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(chosen.nextFollowUpAt))}
                    </small>
                  </div>
                  {canManage && !chosen.followUpCompletedAt && (
                    <button onClick={onCompleteFollowUp}>Complete</button>
                  )}
                </div>
              )}
              {canConvert && chosen.status === "QUALIFIED" && (
                <div className="inquiry-convert">
                  <strong>Explicit conversion</strong>
                  <button onClick={() => onConvert("CUSTOMER")}>Customer</button>
                  <button onClick={() => onConvert("DEAL")}>Sales deal</button>
                  <button onClick={() => onConvert("SUPPORT")}>
                    Support ticket
                  </button>
                </div>
              )}
              <section className="inquiry-timeline">
                <header>
                  <strong>Activity</strong>
                  {canManage && <button onClick={onAddNote}>+ Note</button>}
                </header>
                {chosen.timeline.map((timelineItem) => (
                  <article key={timelineItem.id}>
                    <div>
                      <strong>{timelineItem.summary}</strong>
                      {timelineItem.details && <p>{timelineItem.details}</p>}
                      <small>
                        {timelineItem.createdBy.firstName} ·{" "}
                        {new Date(timelineItem.createdAt).toLocaleString()}
                      </small>
                    </div>
                  </article>
                ))}
              </section>
            </section>
          )}
        </div>
      )}
    </>
  );
}
