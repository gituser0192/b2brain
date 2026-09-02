import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/shared/app-providers";
import "./globals.css";
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
