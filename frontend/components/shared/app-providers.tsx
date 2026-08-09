"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth-context";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthProvider>{children}</AuthProvider>;
}
