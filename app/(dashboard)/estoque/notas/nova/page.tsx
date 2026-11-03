import { CabecalhoPagina } from "@/components/ui/pagina";
import { AcessoNegado } from "@/components/ui/acesso-negado";
import { PaginaEntradaDeNota } from "@/components/estoque/nota/pagina-entrada-de-nota";
import { listarCategoriasParaEntrada } from "@/app/actions/compras";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";

export const metadata = {
  title: "Entrada de nota - Konext ERP",
  description: "Lançar a nota do fornecedor no estoque.",
};

export default async function EntradaDeNotaPage() {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "estoque.editar")) {
    return <AcessoNegado />;
  }

  const categorias = await listarCategoriasParaEntrada();

  return (
    <div className="space-y-4 p-6 lg:p-8">
      <CabecalhoPagina titulo="Entrada de nota" />

      <p className="max-w-3xl text-sm text-kx-legenda">
        O arquivo do fornecedor vira estoque aqui. Nada é gravado até você conferir e clicar em
        lançar — e o frete da nota é rateado entre os itens, pro custo de cada produto ser o que
        ele realmente foi.
      </p>

      <PaginaEntradaDeNota categorias={categorias} />
    </div>
  );
}
