import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ProvedoresLayout } from "@/components/provedores/provedores-layout";
import { CORES_DO_APP } from "@/lib/design/cores-do-app";

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
  // iPhone instalado como app (Compartilhar → Adicionar a Tela de Inicio).
  // O manifesto (app/manifest.ts) cobre o Android; o iOS ainda le estas
  // metatags proprias para nome, tela cheia e cor da barra de status.
  appleWebApp: {
    capable: true,
    title: "Konext",
    // Translucida: o sistema desenha por baixo da barra de status, e a
    // moldura compensa com `env(safe-area-inset-top)` (barra-superior.tsx).
    // As outras opcoes poem uma faixa branca ou preta fixa em cima,
    // destoando do tema.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Ocupa a tela inteira do iPhone, inclusive a area do notch e da barra de
  // gestos — cada borda que encosta nelas desconta a area segura.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: CORES_DO_APP.fundoEscuro },
    { media: "(prefers-color-scheme: light)", color: CORES_DO_APP.fundoClaro },
  ],
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
