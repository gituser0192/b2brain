import { Suspense, type ReactNode } from "react";
import { WorkspaceShell } from "@/features/auth/workspace-shell";

export default function AuthenticatedWorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <Suspense fallback={<main className="screen-loader"><span className="spinner dark" /><p>Opening your workspace…</p></main>}><WorkspaceShell>{children}</WorkspaceShell></Suspense>;
}
