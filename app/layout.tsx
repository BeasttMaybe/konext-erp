import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ProvedoresLayout } from "@/components/provedores/provedores-layout";

/**
 * Fonte da marca (Fase 3-1) — antes só carregada em app/(auth)/layout.tsx;
 * agora também aqui, pra `font-sans`/`--kx-fonte` valer no app inteiro, não
 * só na tela de login.
 *
 * `next/font/local` e não `next/font/google`: o carregador do Google busca o
 * arquivo na internet em tempo de BUILD, e isso derrubou o build três vezes
 * em 02/11/2026 sem nenhuma mudança de código — a Vercel faz o mesmo
 * download no deploy. O arquivo agora é versionado em `app/fontes/`. Ver
 * `app/fontes/LEIA-ME.md`.
 *
 * Um arquivo variável de 27 KB no lugar dos cinco pesos estáticos que o
 * carregador do Google buscava: o eixo cobre 200–800 contínuo.
 */
const plusJakartaSans = localFont({
  src: "./fontes/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--kx-fonte",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
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
        className={`${plusJakartaSans.variable} font-sans antialiased text-foreground`}
      >
        <ProvedoresLayout>{children}</ProvedoresLayout>
      </body>
    </html>
  );
}
