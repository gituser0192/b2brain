import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MarketingShell } from "@/features/language/marketing-shell";

export const metadata: Metadata = { robots: { index: true, follow: true } };

export default function MarketingLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <MarketingShell>{children}</MarketingShell>;
}
