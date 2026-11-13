import { DocumentoLegal } from "../documento-legal";
import { POLITICA_DE_PRIVACIDADE } from "@/lib/legal/documentos";

export const metadata = { title: "Política de Privacidade - Konext ERP" };

/** Pagina publica (proxy.ts). Texto em lib/legal/documentos.ts. */
export default function PrivacidadePage() {
  return <DocumentoLegal titulo="Política de Privacidade" secoes={POLITICA_DE_PRIVACIDADE} />;
}
