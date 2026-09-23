import type { Metadata } from "next";
import MarketingLayout from "./(marketing)/layout";
import HomePage from "@/features/marketing-site/home-page";

export const metadata: Metadata = {
  title: { absolute: "SATHOS | Business Operating System" },
  description: "Bring customers, projects, finance, people and business intelligence into one connected workspace. Explore SATHOS and request a guided private-beta setup.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default function PublicHomePage() {
  return <MarketingLayout><HomePage /></MarketingLayout>;
}
