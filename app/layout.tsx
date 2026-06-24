import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ProvedoresLayout } from "@/components/provedores/provedores-layout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-900 dark:text-slate-50`}
      >
        <ProvedoresLayout>{children}</ProvedoresLayout>
      </body>
    </html>
  );
}
