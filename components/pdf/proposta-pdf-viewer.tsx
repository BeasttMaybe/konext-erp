"use client";

import dynamic from "next/dynamic";
import PropostaPDF, { type CompanyPdfInfo, type ProposalPdfData } from "@/components/pdf/PropostaPDF";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((module) => module.PDFViewer),
  {
    ssr: false,
  }
);

type PropostaPdfViewerProps = {
  proposal: ProposalPdfData;
  company: CompanyPdfInfo;
  assinatura?: { nome: string; url: string | null } | null;
};

/**
 * O gerador de PDF busca a imagem por conta propria e nao entende caminho
 * relativo — e a logo enviada pela tela Empresa (e a assinatura do Meu
 * Perfil) e servida em um
 * ("/logo-da-empresa?v=..."). Completa com o endereco do proprio sistema.
 * O visualizador so roda no navegador (ssr: false), onde `window` existe.
 */
function logoComEnderecoCompleto(logoUrl: string | undefined): string | undefined {
  if (!logoUrl?.startsWith("/") || typeof window === "undefined") return logoUrl;
  return `${window.location.origin}${logoUrl}`;
}

export function PropostaPdfViewer({ proposal, company, assinatura = null }: PropostaPdfViewerProps) {
  const empresa = { ...company, logoUrl: logoComEnderecoCompleto(company.logoUrl) };
  const assinaturaCompleta = assinatura
    ? { nome: assinatura.nome, url: logoComEnderecoCompleto(assinatura.url ?? undefined) ?? null }
    : null;
  return (
    <div className="h-screen w-full bg-kx-papel-alternado print:bg-kx-papel">
      <PDFViewer style={{ width: "100%", height: "100%" }} showToolbar>
        <PropostaPDF proposal={proposal} company={empresa} assinatura={assinaturaCompleta} />
      </PDFViewer>
    </div>
  );
}

export default PropostaPdfViewer;