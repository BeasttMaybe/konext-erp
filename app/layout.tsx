import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ProvedoresLayout } from "@/components/provedores/provedores-layout";

/**
 * Fonte da marca (Fase 3-1) — antes só carregada em app/(auth)/layout.tsx;
 * agora também aqui, pra `font-sans`/`--kx-fonte` valer no app inteiro, não
 * só na tela de login. Os dois `Plus_Jakarta_Sans({variable: "--kx-fonte"})`
 * apontam pra mesma variável CSS de propósito — next/font dedupa o download.
 */
const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--kx-fonte",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Konext ERP",
  description: "Sistema ERP com Dashboard, Financeiro, PDV e OS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${plusJakartaSans.variable} ${geistMono.variable} font-sans antialiased text-foreground`}
      >
        <ProvedoresLayout>{children}</ProvedoresLayout>
      </body>
    </html>
  );
}
