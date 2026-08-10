"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type WorkView = "inquiries" | "crm" | "sales" | "calendar";
interface WorkItem {
  id: string;
  sourceId: string;
  type: "INQUIRY" | "CRM_FOLLOW_UP" | "DEAL" | "APPOINTMENT";
  title: string;
  contact: string;
  detail: string | null;
  dueAt: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  owner: string | null;
  value: number | null;
  currency: string | null;
  view: WorkView;
  canComplete: boolean;
}
interface QueueResponse {
  success: true;
  data: {
    items: WorkItem[];
    metrics: {
      total: number;
      overdue: number;
      dueToday: number;
      unassigned: number;
      forecastAtRisk: number;
    };
  };
}

export function SalesWorkQueue({
  onNavigate,
}: {
  onNavigate: (view: WorkView) => void;
}) {
  const { authorizedRequest } = useAuth();
  const [scope, setScope] = useState<"MINE" | "TEAM">("TEAM");
  const [type, setType] = useState<"ALL" | WorkItem["type"]>("ALL");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    overdue: 0,
    dueToday: 0,
    unassigned: 0,
    forecastAtRisk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authorizedRequest<QueueResponse>(
        `/sales-work-queue?scope=${scope}&horizonDays=30`,
      );
      setItems(response.data.items);
      setMetrics(response.data.metrics);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to load the sales work queue.",
      );
    } finally {
      setLoading(false);
    }
  }, [authorizedRequest, scope]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  const visible = useMemo(
    () => (type === "ALL" ? items : items.filter((item) => item.type === type)),
    [items, type],
  );
  async function complete(item: WorkItem) {
    try {
      const path =
        item.type === "CRM_FOLLOW_UP"
          ? `/sales-work-queue/crm-follow-ups/${item.sourceId}/complete`
          : `/sales-work-queue/inquiries/${item.sourceId}/follow-up/complete`;
      await authorizedRequest(path, { method: "PATCH" });
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to complete this work item.",
      );
    }
  }
  const money = (value: number, currency = "INR") =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  const dueLabel = (value: string | null) => {
    if (!value) return "No deadline";
    const due = new Date(value);
    const now = new Date();
    if (due < now)
      return `Overdue · ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(due)}`;
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(due);
  };

  return (
    <section className="sales-queue">
      <header>
        <div>
          <p>Daily execution</p>
          <h3>Unified sales work queue</h3>
          <span>
            Prioritized from real leads, CRM follow-ups, deals, and
            appointments.
          </span>
        </div>
        <div className="sales-queue-scope">
          <button
            className={scope === "MINE" ? "active" : ""}
            onClick={() => setScope("MINE")}
          >
            My work
          </button>
          <button
            className={scope === "TEAM" ? "active" : ""}
            onClick={() => setScope("TEAM")}
          >
            Team
          </button>
        </div>
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      <div className="sales-queue-metrics">
        <article>
          <span>Open work</span>
          <strong>{metrics.total}</strong>
        </article>
        <article className={metrics.overdue ? "danger" : ""}>
          <span>Overdue</span>
          <strong>{metrics.overdue}</strong>
        </article>
        <article>
          <span>Due today</span>
          <strong>{metrics.dueToday}</strong>
        </article>
        <article>
          <span>Unassigned leads</span>
          <strong>{metrics.unassigned}</strong>
        </article>
        <article>
          <span>Forecast at risk</span>
          <strong>{money(metrics.forecastAtRisk)}</strong>
        </article>
      </div>
      <div className="sales-queue-filters">
        {(
          ["ALL", "INQUIRY", "CRM_FOLLOW_UP", "DEAL", "APPOINTMENT"] as const
        ).map((filter) => (
          <button
            key={filter}
            className={type === filter ? "active" : ""}
            onClick={() => setType(filter)}
          >
            {filter.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="sales-queue-empty">
          <span className="spinner dark" /> Loading work queue…
        </div>
      ) : visible.length === 0 ? (
        <div className="sales-queue-empty">
          <strong>No sales work is due.</strong>
          <span>
            New organizations stay empty until real inquiries, follow-ups,
            deals, or appointments are created.
          </span>
        </div>
      ) : (
        <div className="sales-queue-list">
          {visible.map((item, index) => {
            const overdue = Boolean(
              item.dueAt && new Date(item.dueAt) < new Date(),
            );
            return (
              <article key={item.id}>
                <span className="queue-rank">{index + 1}</span>
                <div className="queue-main">
                  <header>
                    <i className={item.type.toLowerCase()}>
                      {item.type.replaceAll("_", " ")}
                    </i>
                    <em className={item.priority.toLowerCase()}>
                      {item.priority}
                    </em>
                  </header>
                  <button onClick={() => onNavigate(item.view)}>
                    <strong>{item.title}</strong>
                    <span>{item.contact}</span>
                  </button>
                  <p>
                    {item.detail ?? "Open the source record for full context."}
                  </p>
                </div>
                <div className="queue-context">
                  <strong className={overdue ? "overdue" : ""}>
                    {dueLabel(item.dueAt)}
                  </strong>
                  <span>{item.owner ?? "Unassigned"}</span>
                  {item.value !== null && (
                    <b>{money(item.value, item.currency ?? "INR")}</b>
                  )}
                </div>
                <div className="queue-actions">
                  <button onClick={() => onNavigate(item.view)}>Open</button>
                  {item.canComplete && (
                    <button
                      className="complete"
                      onClick={() => void complete(item)}
                    >
                      Complete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
