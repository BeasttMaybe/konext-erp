import { obterProdutoParaEdicao, type ProdutoParaEdicao } from "@/app/actions/estoque";
import { listarCategoriasAtivas } from "@/app/actions/categorias-produto";
import { PaginaProduto } from "@/components/estoque/produto/pagina-produto";
import { FUSO_HORARIO_PADRAO } from "@/lib/datas";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata = {
  title: "Novo produto | TechOS ERP",
};

/**
 * Cadastro de produto. Mesma tela da edição, de propósito: telas separadas
 * divergem, e a de cadastro é sempre a que fica para trás.
 *
 * `?copiarDe=<id>` traz os campos de outro produto. É o "Duplicar" da
 * referência, e serve pro caso comum numa assistência: o mesmo acessório em
 * outra cor ou outro modelo, com dez campos iguais e dois diferentes.
 */
export default async function NovoProdutoPage({ searchParams }: Props) {
  const consulta = await searchParams;
  const contexto = await exigirContextoTenant();

  const copiarDeBruto = consulta.copiarDe;
  const copiarDe = Array.isArray(copiarDeBruto) ? copiarDeBruto[0] : copiarDeBruto;

  const categorias = await listarCategoriasAtivas();

  let modelo: ProdutoParaEdicao | null = null;

  if (copiarDe) {
    const original = await obterProdutoParaEdicao(copiarDe);

    if (original) {
      // Nome, SKU e código de barras NÃO são copiados: os três são
      // identificadores. SKU e código de barras são únicos no banco, então
      // copiá-los faria o primeiro "Salvar" falhar; e o nome idêntico
      // produziria dois produtos indistinguíveis na busca do balcão.
      //
      // O saldo também não: a cópia é um produto novo, que ainda não entrou.
      modelo = {
        ...original,
        id: "",
        nome: `${original.nome} (cópia)`,
        sku: null,
        codigoBarras: null,
        quantidadeEstoque: 0,
      };
    }
  }

  return (
    <PaginaProduto
      // `produto` nulo é o que diz à tela que isto é cadastro, não edição.
      // Os valores do modelo entram como estado inicial do formulário.
      produto={null}
      valoresIniciais={modelo}
      categoriasIniciais={categorias}
      resumo={null}
      movimentacoes={[]}
      fusoHorario={contexto.fusoHorario ?? FUSO_HORARIO_PADRAO}
    />
  );
}
