"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/auth-context";
import { LanguageProvider, type Language } from "@/features/language/language";

export function AppProviders({ children, language }: Readonly<{ children: ReactNode; language: Language }>) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  const publicWebsite = new Set(["/", "/services", "/why-sathos", "/how-it-works", "/security", "/pricing", "/contact", "/privacy", "/terms"]).has(pathname);
  return <LanguageProvider language={language}><QueryClientProvider client={queryClient}>{publicWebsite ? children : <AuthProvider>{children}</AuthProvider>}</QueryClientProvider></LanguageProvider>;
}
