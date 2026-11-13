"use client";

import dynamic from "next/dynamic";

import EtiquetaProdutoPDF, { EtiquetasPDF, type DadosEtiqueta } from "@/components/pdf/EtiquetaProdutoPDF";
import type { TamanhoEtiqueta } from "@/lib/dominio/estoque/etiqueta";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((module) => module.PDFViewer),
  { ssr: false }
);

export function EtiquetaPdfViewer({
  dados,
  tamanho,
  copias,
}: {
  dados: DadosEtiqueta;
  tamanho: TamanhoEtiqueta;
  copias: number;
}) {
  return (
    <div className="h-screen w-full bg-kx-papel-alternado print:bg-kx-papel">
      <PDFViewer style={{ width: "100%", height: "100%" }} showToolbar>
        <EtiquetaProdutoPDF dados={dados} tamanho={tamanho} copias={copias} />
      </PDFViewer>
    </div>
  );
}

export default EtiquetaPdfViewer;

export function EtiquetasPdfViewer({
  itens,
  tamanho,
}: {
  itens: ReadonlyArray<{ dados: DadosEtiqueta; copias: number }>;
  tamanho: TamanhoEtiqueta;
}) {
  return (
    <div className="h-full w-full bg-kx-papel-alternado print:bg-kx-papel">
      <PDFViewer style={{ width: "100%", height: "100%" }} showToolbar>
        <EtiquetasPDF itens={itens} tamanho={tamanho} />
      </PDFViewer>
    </div>
  );
}
