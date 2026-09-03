import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/shared/app-providers";
import "./styles/foundations/tokens.css";
import "./styles/foundations/reset.css";
import "./styles/foundations/typography.css";
import "./styles/layouts/auth.css";
import "./styles/layouts/dashboard-shell.css";
import "./globals.css";
import "./styles/features/automation.css";
import "./styles/features/finance.css";
import "./styles/features/projects.css";
import "./styles/features/crm.css";
import "./styles/customer-enquiry-agent.css";
import "./styles/knowledge-management.css";
import "./styles/dashboard-mobile.css";

export const metadata: Metadata = {
  title: { default: "B² Brain", template: "%s · B² Brain" },
  description: "A focused workspace for running your organization.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><AppProviders>{children}</AppProviders></body></html>;
}
