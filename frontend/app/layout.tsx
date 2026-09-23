import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/shared/app-providers";
import "./styles/foundations/tokens.css";
import "./styles/foundations/reset.css";
import "./styles/foundations/typography.css";
import "./styles/layouts/auth.css";
import "./styles/layouts/dashboard-shell.css";
import "./styles/layouts/marketing.css";
import "./globals.css";
import "./styles/features/dashboard.css";
import "./styles/features/automation.css";
import "./styles/features/finance.css";
import "./styles/features/settings.css";
import "./styles/features/platform.css";
import "./styles/features/people.css";
import "./styles/features/projects.css";
import "./styles/features/crm.css";
import "./styles/customer-enquiry-agent.css";
import "./styles/features/workspace-agent.css";
import "./styles/knowledge-management.css";
import "./styles/dashboard-mobile.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sathos.in"),
  title: { default: "SATHOS", template: "%s · SATHOS" },
  description: "SATHOS brings customers, projects, finance, people and business intelligence into one connected workspace for growing businesses.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><AppProviders>{children}</AppProviders></body></html>;
}
