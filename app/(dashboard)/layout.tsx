import { ConteudoPrincipal } from "@/components/layout/conteudo-principal";
import { Rodape } from "@/components/layout/rodape";
import { Cabecalho } from "@/components/layout/cabecalho";

/**
 * Layout do Dashboard: cabeçalho único com a navegação, conteúdo e rodapé.
 */
export default function LayoutDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <Cabecalho />

      <ConteudoPrincipal>{children}</ConteudoPrincipal>

      <Rodape />
    </div>
  );
}
