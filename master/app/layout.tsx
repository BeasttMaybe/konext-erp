import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "TechOS Master",
  description: "Administração das lojas que usam o TechOS ERP.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0f1115", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
