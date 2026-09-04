"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

const PHONE_WIDTH = 700;
const EDGE_GAP = 16;
const DRAG_THRESHOLD = 6;

type Position = { left: number; top: number };

export function WorkspaceAgentLauncher({ organizationId, userId, open, onOpen, launcherRef }: {
  organizationId: string;
  userId: string;
  open: boolean;
  onOpen: () => void;
  launcherRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const storageKey = `b2brain-agent-launcher:${organizationId}:${userId}`;
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const dragged = useRef(false);
  const [position, setPosition] = useState<Position | null>(null);

  const bounds = useCallback(() => {
    const button = launcherRef.current;
    const width = button?.offsetWidth ?? 52;
    const height = button?.offsetHeight ?? 52;
    const sidebar = document.querySelector<HTMLElement>(".dashboard-sidebar");
    const header = document.querySelector<HTMLElement>(".dashboard-header");
    const sidebarRight = sidebar && getComputedStyle(sidebar).display !== "none" ? sidebar.getBoundingClientRect().right : 0;
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    return {
      minLeft: Math.max(EDGE_GAP, sidebarRight + EDGE_GAP),
      maxLeft: Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP),
      minTop: Math.max(EDGE_GAP, headerBottom + EDGE_GAP),
      maxTop: Math.max(EDGE_GAP, window.innerHeight - height - EDGE_GAP),
    };
  }, [launcherRef]);

  const clamp = useCallback((candidate: Position) => {
    const limit = bounds();
    return {
      left: Math.min(limit.maxLeft, Math.max(limit.minLeft, candidate.left)),
      top: Math.min(limit.maxTop, Math.max(limit.minTop, candidate.top)),
    };
  }, [bounds]);

  const save = useCallback((candidate: Position) => {
    const limit = bounds();
    const snapped = clamp({
      left: candidate.left - limit.minLeft <= limit.maxLeft - candidate.left ? limit.minLeft : limit.maxLeft,
      top: candidate.top,
    });
    setPosition(snapped);
    window.localStorage.setItem(storageKey, JSON.stringify(snapped));
  }, [bounds, clamp, storageKey]);

  const reset = useCallback(() => {
    window.localStorage.removeItem(storageKey);
    setPosition(null);
  }, [storageKey]);

  useEffect(() => {
    if (window.innerWidth <= PHONE_WIDTH) return;
    let frame = 0;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as Position | null;
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) frame = window.requestAnimationFrame(() => setPosition(clamp(saved)));
    } catch {
      window.localStorage.removeItem(storageKey);
    }
    const resize = () => setPosition((current) => current ? clamp(current) : null);
    window.addEventListener("resize", resize);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [clamp, storageKey]);

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (window.innerWidth <= PHONE_WIDTH || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD && !dragged.current) return;
    dragged.current = true;
    setPosition(clamp({ left: drag.current.left + dx, top: drag.current.top + dy }));
  }

  function pointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    if (dragged.current) {
      const rect = event.currentTarget.getBoundingClientRect();
      save({ left: rect.left, top: rect.top });
    }
  }

  const style: CSSProperties | undefined = position ? { left: position.left, top: position.top, right: "auto", bottom: "auto" } : undefined;
  return <button
    ref={launcherRef}
    type="button"
    className="workspace-agent-launcher"
    style={style}
    onPointerDown={pointerDown}
    onPointerMove={pointerMove}
    onPointerUp={pointerUp}
    onClick={() => { if (dragged.current) { dragged.current = false; return; } onOpen(); }}
    onContextMenu={(event) => { event.preventDefault(); reset(); }}
    onKeyDown={(event) => { if (event.shiftKey && event.key === "F10") { event.preventDefault(); reset(); } }}
    aria-label="Open Ask B² Brain"
    aria-expanded={open}
    aria-controls="workspace-agent-drawer"
    aria-keyshortcuts="Shift+F10"
    title="Ask B² Brain. Drag to move; right-click or press Shift+F10 to reset position."
  ><Image src="/brand/b2brain-logo.png" alt="" width={32} height={32} draggable={false} /><span role="tooltip">Ask B² Brain</span></button>;
}
