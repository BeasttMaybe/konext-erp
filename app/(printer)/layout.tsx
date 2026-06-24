import type { ReactNode } from "react";

/**
 * Layout do grupo (printer) — sem sidebar, sem cabeçalho.
 * Não repete <html>/<body> pois o root app/layout.tsx já os define.
 * O fundo branco é forçado pelo <style> inline de cada página de impressão.
 */
export default function LayoutImpressao({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
