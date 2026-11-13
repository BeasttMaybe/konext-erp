import { DocumentoLegal } from "../documento-legal";
import { TERMOS_DE_USO } from "@/lib/legal/documentos";

export const metadata = { title: "Termos de Uso - TechOS ERP" };

/** Pagina publica (proxy.ts). Texto em lib/legal/documentos.ts. */
export default function TermosPage() {
  return <DocumentoLegal titulo="Termos de Uso" secoes={TERMOS_DE_USO} />;
}
