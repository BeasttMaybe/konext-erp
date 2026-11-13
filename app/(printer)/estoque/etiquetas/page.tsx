import { EtiquetasPdfViewer } from "@/components/pdf/etiqueta-pdf-viewer";
import type { DadosEtiqueta } from "@/components/pdf/EtiquetaProdutoPDF";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { deDecimal, formatarReais } from "@/lib/dinheiro";
import { acharTamanhoDeEtiqueta, codigoDaEtiqueta, digitoVerificadorEanConfere } from "@/lib/dominio/estoque/etiqueta";
import {
  copiasDoProduto,
  MAXIMO_DE_PAGINAS_DE_ETIQUETA,
  MAXIMO_DE_PRODUTOS_NA_ETIQUETA,
  normalizarIds,
  type ModoDeCopias,
} from "@/lib/dominio/estoque/operacoes-em-massa";
import { gerarCodigoDeBarrasPng } from "@/lib/estoque/codigo-de-barras";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);

/**
 * Etiquetas de varios produtos num PDF so (selecao em massa do estoque).
 * `?ids=a,b,c&tamanho=50x30&modo=UMA|FIXO|SALDO&copias=N`. Mesmas regras da
 * etiqueta de um produto (app/(printer)/estoque/produtos/[id]/etiqueta): quem
 * nao tem codigo de barras nem SKU, ou tem EAN com digito errado, fica de fora
 * e a lista aparece acima do PDF.
 */
export default async function EtiquetasEmLotePage({ searchParams }: Props) {
  const consulta = await searchParams;
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");

  const lidos = normalizarIds((primeiro(consulta.ids) ?? "").split(","), MAXIMO_DE_PRODUTOS_NA_ETIQUETA);
  if (!lidos.ok) return <Aviso titulo="Nenhuma etiqueta para imprimir" texto={lidos.erro} />;

  const tamanho = acharTamanhoDeEtiqueta(primeiro(consulta.tamanho) ?? "");
  const modoPedido = primeiro(consulta.modo);
  const modo: ModoDeCopias = modoPedido === "FIXO" || modoPedido === "SALDO" ? modoPedido : "UMA";
  const fixo = Number.parseInt(primeiro(consulta.copias) ?? "1", 10);

  const produtos = await contexto.prisma.produto.findMany({
    where: { id: { in: lidos.ids } },
    select: { id: true, nome: true, sku: true, codigoBarras: true, compatibilidade: true, precoVenda: true, quantidadeEstoque: true },
  });
  // Mesma ordem da selecao.
  const ordem = new Map(lidos.ids.map((id, i) => [id, i]));
  produtos.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));

  const itens: { dados: DadosEtiqueta; copias: number }[] = [];
  const deFora: string[] = [];
  let paginas = 0;

  for (const produto of produtos) {
    const codigo = codigoDaEtiqueta(produto);
    if (!codigo || digitoVerificadorEanConfere(codigo.conteudo) === false) {
      deFora.push(produto.nome);
      continue;
    }
    const png = await gerarCodigoDeBarrasPng(codigo.simbologia, codigo.conteudo);
    if (!png.ok) {
      deFora.push(produto.nome);
      continue;
    }
    const copias = Math.min(copiasDoProduto(modo, fixo, produto.quantidadeEstoque), MAXIMO_DE_PAGINAS_DE_ETIQUETA - paginas);
    if (copias <= 0) break;
    paginas += copias;
    itens.push({
      dados: {
        nome: produto.nome,
        preco: formatarReais(deDecimal(produto.precoVenda)),
        legenda: codigo.legenda,
        sku: produto.sku,
        compatibilidade: produto.compatibilidade,
        codigoDeBarrasPng: png.dataUri,
      },
      copias,
    });
  }

  if (itens.length === 0) {
    return (
      <Aviso
        titulo="Nenhum destes produtos tem etiqueta"
        texto="A etiqueta precisa de um código de barras válido ou de um SKU. Cadastre um dos dois na página de cada produto."
      />
    );
  }

  const cortado = paginas >= MAXIMO_DE_PAGINAS_DE_ETIQUETA;

  return (
    <div className="flex h-screen flex-col">
      {deFora.length > 0 || cortado ? (
        <div className="shrink-0 border-b border-kx-alerta bg-kx-alerta-fundo px-4 py-2 text-sm text-kx-alerta-texto print:hidden">
          {deFora.length > 0 ? (
            <p>
              Sem etiqueta (falta código de barras ou SKU válido): {deFora.slice(0, 8).join(", ")}
              {deFora.length > 8 ? ` e mais ${deFora.length - 8}` : ""}.
            </p>
          ) : null}
          {cortado ? <p>Limite de {MAXIMO_DE_PAGINAS_DE_ETIQUETA} etiquetas por vez: imprima o restante numa segunda seleção.</p> : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <EtiquetasPdfViewer itens={itens} tamanho={tamanho} />
      </div>
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-kx-fundo px-6">
      <div className="max-w-md rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-6 text-center">
        <p className="text-base font-bold text-kx-texto">{titulo}</p>
        <p className="mt-2 text-sm text-kx-legenda">{texto}</p>
      </div>
    </div>
  );
}
