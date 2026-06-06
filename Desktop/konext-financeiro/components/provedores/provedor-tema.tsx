"use client";

import { ThemeProvider } from "next-themes";

/**
 * Provedor de Tema - Wrapper cliente para o ThemeProvider
 * Necessário porque ThemeProvider é um client component
 */
export function ProvedorTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true} storageKey="konext-theme">
      {children}
    </ThemeProvider>
  );
}
