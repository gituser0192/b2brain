"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { WorkspaceAgentHeader } from "./workspace-agent-header";
import { BusinessBriefView } from "./business-brief-view";
import { BusinessGoalsView } from "./business-goals-view";
import { WorkspaceAgentComposer, WorkspaceAgentConversation } from "./workspace-agent-conversation";
import type { AgentItem, AgentOutput, AgentSection, BusinessBrief, BusinessGoal, GoalDraft } from "./workspace-agent-types";
const initialGoal = (): GoalDraft => {
  const now = new Date();
  return {
    type: "MONTHLY_REVENUE",
    title: "Monthly revenue target",
    targetValue: 0,
    periodStart: now.toISOString().slice(0, 10),
    periodEnd: new Date(now.getTime() + 30 * 86400000)
      .toISOString()
      .slice(0, 10),
  };
};

export function WorkspaceAgent({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: (view: string) => void;
}) {
  const { session, authorizedRequest } = useAuth(),
    storageKey = `b2brain-agent-conversation:${session?.organization.id ?? "none"}:${session?.membership.id ?? "none"}`;
  const [conversationId] = useState(() => {
      if (typeof window === "undefined") return crypto.randomUUID();
      const saved = window.localStorage.getItem(storageKey),
        id = saved ?? crypto.randomUUID();
      window.localStorage.setItem(storageKey, id);
      return id;
    }),
    [items, setItems] = useState<AgentItem[]>([]),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [section, setSection] = useState<AgentSection>(
      "brief",
    ),
    [brief, setBrief] = useState<BusinessBrief | null>(null),
    [goals, setGoals] = useState<BusinessGoal[]>([]),
    [goalOpen, setGoalOpen] = useState(false),
    [goal, setGoal] = useState(initialGoal);
  const load = useCallback(async () => {
    const response = await authorizedRequest<{ success: true; data: AgentItem[] }>(
      `/workspace-agent/conversations/${conversationId}`,
    );
    setItems(response.data);
  }, [authorizedRequest, conversationId]);
  useEffect(() => {
    const task = window.setTimeout(
      () =>
        void load()
          .catch((reason) =>
            setError(
              reason instanceof ApiError
                ? reason.message
                : "Unable to load Ask B² Brain.",
            ),
          )
          .finally(() => setLoading(false)),
      0,
    );
    return () => window.clearTimeout(task);
  }, [load]);
  const loadManagement = useCallback(async () => {
    if (compact) return;
    const [briefResponse, goalResponse] = await Promise.all([
      authorizedRequest<{ success: true; data: BusinessBrief }>(
        "/workspace-agent/brief",
      ),
      authorizedRequest<{ success: true; data: BusinessGoal[] }>(
        "/workspace-agent/goals",
      ),
    ]);
    setBrief(briefResponse.data);
    setGoals(goalResponse.data);
  }, [authorizedRequest, compact]);
  useEffect(() => {
    const task = window.setTimeout(
      () =>
        void loadManagement().catch((reason) =>
          setError(
            reason instanceof ApiError
              ? reason.message
              : "Unable to calculate the business brief.",
          ),
        ),
      0,
    );
    return () => window.clearTimeout(task);
  }, [loadManagement]);
  async function createGoal() {
    setLoading(true);
    setError("");
    try {
      await authorizedRequest("/workspace-agent/goals", {
        method: "POST",
        body: JSON.stringify({
          ...goal,
          targetValue: Number(goal.targetValue),
          periodStart: new Date(
            `${goal.periodStart}T00:00:00.000Z`,
          ).toISOString(),
          periodEnd: new Date(`${goal.periodEnd}T23:59:59.999Z`).toISOString(),
        }),
      });
      setGoalOpen(false);
      await loadManagement();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to create the goal.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function send(text = message) {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest<{ success: true; data: AgentOutput }>(
        "/workspace-agent/messages",
        {
          method: "POST",
          body: JSON.stringify({
            conversationId,
            externalMessageId: crypto.randomUUID(),
            message: text.trim(),
          }),
        },
      );
      setItems((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          message: text.trim(),
          output: response.data,
        },
      ]);
      setMessage("");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Ask B² Brain could not complete that request safely.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className={`workspace-agent ${compact ? "compact" : "full"}`}>
      {!compact && <WorkspaceAgentHeader section={section} onSection={setSection} />}
      {!compact && section === "brief" && brief && <BusinessBriefView brief={brief} onNavigate={onNavigate} />}
      {!compact && section === "goals" && <BusinessGoalsView goals={goals} goal={goal} open={goalOpen} loading={loading} onToggle={() => setGoalOpen((value) => !value)} onGoal={setGoal} onCreate={() => void createGoal()} />}
      {(compact || section === "conversation") && <WorkspaceAgentConversation items={items} loading={loading} compact={compact} onSend={(text) => void send(text)} onNavigate={onNavigate} onSection={setSection} />}
      {error && <div className="dashboard-notice error">{error}</div>}
      {(compact || section === "conversation") && <WorkspaceAgentComposer message={message} loading={loading} compact={compact} onMessage={setMessage} onSend={() => void send()} />}
    </section>
  );
}
