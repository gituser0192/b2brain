import type { Metadata } from "next";
import { ProtectedDashboard } from "@/features/auth/protected-dashboard";
export const metadata: Metadata = { title: "Dashboard" };
export default function DashboardPage() { return <ProtectedDashboard />; }
