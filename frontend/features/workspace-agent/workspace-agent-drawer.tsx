"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { WorkspaceAgent } from "./workspace-agent";

const suggestionsByView: Record<string, string[]> = {
  overview: ["Check my business health", "What should I focus on today?", "Explain my current profit"],
  crm: ["Count my customers", "Which customers need follow-up?", "How do I add a customer?"],
  finance: ["Explain this month’s profit", "Check my financial health", "What expenses need attention?"],
  projects: ["Which tasks are overdue?", "What should my team prioritize?"],
};

export function WorkspaceAgentDrawer({ activeView, launcherRef, onClose, onNavigate }: {
  activeView: string;
  launcherRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onNavigate: (view: string) => void;
}) {
  const { session } = useAuth();
  const drawerRef = useRef<HTMLElement>(null);
  const [chatKey, setChatKey] = useState(0);
  useEffect(() => {
    const drawer = drawerRef.current;
    const launcher = launcherRef.current;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); launcher?.focus(); };
  }, [launcherRef, onClose]);

  return <div className="workspace-agent-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside id="workspace-agent-drawer" ref={drawerRef} className="workspace-agent-drawer" role="dialog" aria-modal="true" aria-labelledby="workspace-agent-drawer-title">
      <header><div><strong id="workspace-agent-drawer-title">Ask B² Brain</strong><span>Uses your permitted workspace data</span></div><div className="workspace-agent-drawer-actions"><button type="button" className="workspace-agent-new-chat" onClick={() => { if (session) window.sessionStorage.removeItem(`b2brain-agent-draft:${session.organization.id}:${session.user.id}`); setChatKey((value) => value + 1); }}>New chat</button><Link href="/agent" onClick={onClose}>Full workspace</Link><button type="button" onClick={onClose} aria-label="Close Ask B² Brain">×</button></div></header>
      <WorkspaceAgent key={chatKey} compact suggestions={suggestionsByView[activeView]} onNavigate={(view) => { onNavigate(view); onClose(); }} />
    </aside>
  </div>;
}
