import { notFound } from "next/navigation";

import EtiquetaPdfViewer from "@/components/pdf/etiqueta-pdf-viewer";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { deDecimal, formatarReais } from "@/lib/dinheiro";
import {
  acharTamanhoDeEtiqueta,
  codigoDaEtiqueta,
  digitoVerificadorEanConfere,
} from "@/lib/dominio/estoque/etiqueta";
import { gerarCodigoDeBarrasPng } from "@/lib/estoque/codigo-de-barras";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Mais que isso não é etiqueta de produto, é erro de digitação no campo. */
const MAXIMO_DE_COPIAS = 100;

/**
 * Etiqueta do produto em PDF, no tamanho do rolo.
 *
 * O código de barras é gerado AQUI, no servidor: `bwip-js` é Node, e as barras
 * têm que sair do algoritmo da simbologia — barra desenhada à mão não é lida
 * por leitor nenhum.
 */
export default async function EtiquetaProdutoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const consulta = await searchParams;

  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");

  const produto = await contexto.prisma.produto.findUnique({
    where: { id },
    select: {
      nome: true,
      sku: true,
      codigoBarras: true,
      compatibilidade: true,
      precoVenda: true,
    },
  });

  if (!produto) {
    notFound();
  }

  const tamanho = acharTamanhoDeEtiqueta(primeiro(consulta.tamanho) ?? "");
  const copiasPedidas = Number.parseInt(primeiro(consulta.copias) ?? "1", 10);
  const copias = Number.isFinite(copiasPedidas)
    ? Math.min(MAXIMO_DE_COPIAS, Math.max(1, copiasPedidas))
    : 1;

  const codigo = codigoDaEtiqueta(produto);

  if (!codigo) {
    return (
      <Aviso
        titulo="Este produto não tem etiqueta"
        texto="A etiqueta precisa de um código de barras ou de um SKU para o leitor devolver. Cadastre um dos dois na página do produto."
      />
    );
  }

  // O verificador é conferido antes de chamar o gerador só pra poder dizer o
  // que está errado: o gerador recusaria do mesmo jeito, com a mensagem crua
  // `bwipp.ean13badCheckDigit`.
  if (digitoVerificadorEanConfere(codigo.conteudo) === false) {
    return (
      <Aviso
        titulo="O código de barras não fecha"
        texto={`O dígito verificador de ${codigo.conteudo} está errado — provavelmente um número trocado na digitação. Confira o código na embalagem, ou deixe o campo vazio para a etiqueta sair com o SKU.`}
      />
    );
  }

  const codigoDeBarras = await gerarCodigoDeBarrasPng(codigo.simbologia, codigo.conteudo);

  if (!codigoDeBarras.ok) {
    return <Aviso titulo="Não foi possível gerar a etiqueta" texto={codigoDeBarras.erro} />;
  }

  return (
    <EtiquetaPdfViewer
      dados={{
        nome: produto.nome,
        preco: formatarReais(deDecimal(produto.precoVenda)),
        legenda: codigo.legenda,
        sku: produto.sku,
        compatibilidade: produto.compatibilidade,
        codigoDeBarrasPng: codigoDeBarras.dataUri,
      }}
      tamanho={tamanho}
      copias={copias}
    />
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
