"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import {
  SalesWorkQueueView,
  type SalesQueueMetrics,
  type SalesWorkItem,
  type WorkView,
} from "./sales-work-queue-view";
interface QueueResponse {
  success: true;
  data: {
    items: SalesWorkItem[];
    metrics: SalesQueueMetrics;
    scope: {
      requested: "MINE" | "TEAM";
      effective: "MINE" | "TEAM";
      canViewTeam: boolean;
    };
  };
}

export function SalesWorkQueue({
  onNavigate,
}: {
  onNavigate: (view: WorkView) => void;
}) {
  const { session, authorizedRequest } = useAuth();
  const canViewTeam = session?.membership.role.code === "ORGANIZATION_OWNER";
  const canManageDeals =
    session?.membership.permissions.includes("DEAL_MANAGE") ?? false;
  const [scope, setScope] = useState<"MINE" | "TEAM">(
    canViewTeam ? "TEAM" : "MINE",
  );
  const [type, setType] = useState<"ALL" | SalesWorkItem["type"]>("ALL");
  const [items, setItems] = useState<SalesWorkItem[]>([]);
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
  async function complete(item: SalesWorkItem) {
    try {
      const path =
        item.type === "CRM_FOLLOW_UP"
          ? `/sales-work-queue/crm-follow-ups/${item.sourceId}/complete`
          : item.type === "AUTOMATED_FOLLOW_UP"
            ? `/sales-work-queue/automated-follow-ups/${item.sourceId}/complete`
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
  async function decideAlert(
    item: SalesWorkItem,
    decision: "EXECUTE" | "DISMISS" | "SNOOZE",
  ) {
    try {
      const body =
        decision === "SNOOZE"
          ? {
              decision,
              note: "Snoozed from sales work queue.",
              snoozedUntil: new Date(Date.now() + 86_400_000).toISOString(),
            }
          : decision === "DISMISS"
            ? { decision, note: "Resolved from sales work queue." }
            : { decision, note: "Next action created from sales work queue." };
      await authorizedRequest(
        `/sales-work-queue/pipeline-alerts/${item.sourceId}/decision`,
        { method: "POST", body: JSON.stringify(body) },
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to update the pipeline alert.",
      );
    }
  }
  return (
    <SalesWorkQueueView
      scope={scope}
      filter={type}
      items={visible}
      metrics={metrics}
      loading={loading}
      error={error}
      canViewTeam={canViewTeam}
      canManageDeals={canManageDeals}
      onScopeChange={setScope}
      onFilterChange={setType}
      onNavigate={onNavigate}
      onComplete={(item) => void complete(item)}
      onDecideAlert={(item, decision) => void decideAlert(item, decision)}
    />
  );
}
