import { notFound } from "next/navigation";

import {
  listarMovimentacoesProduto,
  obterProdutoParaEdicao,
  obterResumoProduto,
} from "@/app/actions/estoque";
import { listarCategoriasAtivas } from "@/app/actions/categorias-produto";
import { PaginaProduto } from "@/components/estoque/produto/pagina-produto";
import { FUSO_HORARIO_PADRAO } from "@/lib/datas";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

type Props = { params: Promise<{ id: string }> };

export const metadata = {
  title: "Produto | TechOS ERP",
};

/** Quantas movimentações a página mostra. O resto fica no sheet do estoque. */
const MOVIMENTACOES_NA_PAGINA = 12;

export default async function ProdutoPage({ params }: Props) {
  const { id } = await params;
  const contexto = await exigirContextoTenant();

  const produto = await obterProdutoParaEdicao(id);

  if (!produto) {
    notFound();
  }

  // Em paralelo: nenhum depende do outro, e são três idas ao banco.
  const [categorias, resumo, movimentacoes] = await Promise.all([
    listarCategoriasAtivas(),
    obterResumoProduto(id),
    listarMovimentacoesProduto(id, MOVIMENTACOES_NA_PAGINA),
  ]);

  // A categoria do produto pode estar DESATIVADA. Ela entra na lista de opções
  // mesmo assim, senão o seletor abriria sem valor selecionado e o primeiro
  // "Salvar" trocaria a categoria do produto sem ninguém pedir.
  const categoriasComAAtual = categorias.some((categoria) => categoria.id === produto.categoriaId)
    ? categorias
    : [
        ...categorias,
        await contexto.prisma.categoriaProduto
          .findUniqueOrThrow({
            where: { id: produto.categoriaId },
            select: { id: true, nome: true },
          })
          .then((categoria) => ({ ...categoria, nome: `${categoria.nome} (desativada)` })),
      ];

  return (
    <PaginaProduto
      produto={produto}
      categoriasIniciais={categoriasComAAtual}
      resumo={resumo}
      movimentacoes={movimentacoes}
      fusoHorario={contexto.fusoHorario ?? FUSO_HORARIO_PADRAO}
    />
  );
}
