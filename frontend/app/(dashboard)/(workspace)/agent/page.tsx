"use client";
import { useRouter } from "next/navigation";
import { WorkspaceAgent, type ActiveView } from "@/features/auth/dashboard-workspaces";
import { routeForView } from "@/features/auth/workspace-routes";
export default function AgentPage() { const router = useRouter(); return <WorkspaceAgent onNavigate={(view) => router.push(routeForView(view as ActiveView))} />; }
