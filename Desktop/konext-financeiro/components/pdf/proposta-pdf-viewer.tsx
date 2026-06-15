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
};

export function PropostaPdfViewer({ proposal, company }: PropostaPdfViewerProps) {
  return (
    <div className="h-screen w-full bg-zinc-100 print:bg-white">
      <PDFViewer style={{ width: "100%", height: "100%" }} showToolbar>
        <PropostaPDF proposal={proposal} company={company} />
      </PDFViewer>
    </div>
  );
}

export default PropostaPdfViewer;