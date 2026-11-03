/**
 * O que é uma "nota de compra" lida de um arquivo, antes de virar estoque.
 *
 * Este módulo é o contrato comum entre as duas portas de entrada — o XML da
 * NF-e e o PDF do fornecedor — e o lugar onde mora a CONFERÊNCIA ARITMÉTICA.
 *
 * A conferência existe porque as duas portas têm confiabilidades muito
 * diferentes e a tela não pode tratar as duas igual:
 *
 * - O XML é estruturado e assinado. Cada campo tem nome. Ler errado é bug.
 * - O PDF é desenho. O que chega é um monte de pedaço de texto com posição
 *   na página, e "qual coluna é o preço unitário" é INFERÊNCIA. Inferência
 *   erra, e errar aqui significa gravar custo errado no produto — que
 *   contamina margem, markup e preço de venda em silêncio, meses depois.
 *
 * A saída é que uma nota de compra se conta: `quantidade × unitário` tem que
 * dar `total` em cada linha, a soma das linhas tem que dar o subtotal, e
 * subtotal + frete tem que dar o total geral. Quando as três contas fecham,
 * a leitura está certa — não "provavelmente certa": se uma coluna tivesse
 * sido trocada, a conta não fechava. Quando alguma não fecha, o item vai pra
 * tela marcado, e quem confere decide.
 *
 * É por isso que a tela de conferência não é enfeite: ela é o mecanismo de
 * correção. Nenhuma leitura de PDF entra no estoque sem passar por ela.
 */

import { multiplicarPorQuantidade, somar, subtrair } from "@/lib/dinheiro";

/** De onde veio o documento — muda o quanto a leitura merece confiança. */
export type OrigemDaNota = "XML" | "PDF";

export type ItemLidoDaNota = {
  /** Posição na nota, preservada: é como a pessoa acha a linha no papel. */
  ordem: number;

  /**
   * O nome como está escrito no documento, sem nenhum tratamento.
   *
   * No PDF de fornecedor, costuma ser o cabeçalho da seção junto com a
   * linha: a nota diz "CASE DE IPHONE" numa linha e "IP 18 PRO" na seguinte,
   * e o produto é "CASE DE IPHONE IP 18 PRO". Lida isolada, a linha vira um
   * produto chamado "IP 18 PRO" — e como o mesmo "IP 18 PRO" aparece embaixo
   * de capa, película e case, viravam três produtos de nome idêntico.
   */
  descricao: string;

  /**
   * O cabeçalho da seção que deu origem ao prefixo, quando houve.
   *
   * Guardado separado porque o prefixo ajuda e atrapalha, dependendo da
   * linha. Em "CASE DE IPHONE" + "IP 18 PRO" ele é o que distingue o
   * produto — sem ele, quatro linhas viram quatro produtos chamados "IP 18
   * PRO". Em "ACESSORIOS" + "FONTE H'MASTON 20W USB-C" ele é ruído: a linha
   * já nomeia o produto inteiro, e o prefixo só impede que o nome bata
   * exato com o que está no catálogo.
   *
   * Com os dois guardados, o casamento tenta as duas formas e nenhuma das
   * duas situações precisa ser adivinhada.
   */
  grupo: string | null;

  /** Código do item no catálogo do FORNECEDOR (`cProd` no XML). */
  codigoFornecedor: string | null;

  /** Código de barras do fabricante (`cEAN`), quando a nota traz. */
  ean: string | null;

  ncm: string | null;

  /** "UN", "CX", "PC"... como veio. Normalizar é problema de quem cadastra. */
  unidade: string | null;

  quantidade: number;

  valorUnitarioCentavos: number;

  /**
   * O total da linha COMO O DOCUMENTO DECLARA — nunca recalculado na leitura.
   *
   * Guardar o declarado em vez de recalcular é o que permite a conferência
   * existir: se eu substituísse por `quantidade × unitário`, a conta fecharia
   * sempre, por construção, e a verificação não verificaria nada.
   */
  valorTotalCentavos: number;
};

export type NotaLida = {
  origem: OrigemDaNota;

  /** Os 44 dígitos da NF-e. Só existe em XML — orçamento não tem chave. */
  chaveAcesso: string | null;

  numero: string | null;
  serie: string | null;

  emitenteNome: string | null;
  emitenteCnpj: string | null;

  /** Data de emissão como `"aaaa-mm-dd"`, ou nulo quando ilegível. */
  emitidaEm: string | null;

  itens: ItemLidoDaNota[];

  /** Soma das mercadorias DECLARADA pelo documento (não a soma das linhas). */
  valorProdutosCentavos: number | null;

  valorFreteCentavos: number;

  valorDescontoCentavos: number;

  /** Total geral declarado. */
  valorTotalCentavos: number | null;

  /**
   * Trechos que a leitura reconheceu como linha de item mas não conseguiu
   * interpretar. Vão pra tela como aviso em vez de sumirem: uma linha que
   * desaparece em silêncio é pior do que uma linha que aparece com defeito,
   * porque ninguém procura o que não sabe que falta.
   */
  linhasIgnoradas: string[];
};

/** O que a conferência achou de errado numa linha. */
export type ProblemaDoItem =
  | "TOTAL_NAO_BATE"
  | "QUANTIDADE_INVALIDA"
  | "VALOR_INVALIDO";

export type ConferenciaDoItem = {
  ordem: number;
  problemas: ProblemaDoItem[];
  /** `quantidade × unitário`, pra tela mostrar ao lado do total declarado. */
  totalCalculadoCentavos: number;
};

export type ProblemaDaNota =
  | "SOMA_DOS_ITENS_NAO_BATE"
  | "TOTAL_GERAL_NAO_BATE"
  | "SEM_ITENS";

export type ConferenciaDaNota = {
  itens: ConferenciaDoItem[];
  problemas: ProblemaDaNota[];
  /** Soma dos totais declarados das linhas. */
  somaDosItensCentavos: number;
  /** Quantas linhas passaram em todas as contas. */
  itensConferidos: number;
  /**
   * `true` quando tudo fecha. Só nesse caso a leitura de um PDF pode ser
   * tratada como tão confiável quanto um XML.
   */
  fecha: boolean;
};

/**
 * Tolerância mínima de UM CENTAVO por linha na comparação de totais.
 *
 * Não é frouxidão: é o arredondamento legítimo do próprio emissor. Uma nota
 * com unitário de R$ 1,665 e quantidade 3 pode declarar R$ 5,00 ou R$ 4,99
 * dependendo de onde o sistema do fornecedor arredondou, e reprovar essa
 * linha treinaria quem confere a ignorar o aviso — que é o único jeito de um
 * aviso parar de funcionar.
 */
export const TOLERANCIA_DE_CENTAVOS = 1;

/**
 * A tolerância da linha CRESCE com a quantidade, e isso não é arbitrário.
 *
 * O XML da NF-e declara o unitário com até DEZ casas decimais (`vUnCom`),
 * mas o total da linha com duas. Guardar o unitário em centavos perde o que
 * passa da segunda casa, e esse arredondamento de até meio centavo se
 * multiplica pela quantidade: um item de `vUnCom` 1,6666666667 comprado 10
 * vezes fecha em R$ 16,67 na nota e em R$ 16,70 se eu multiplicar o
 * centavo arredondado. Três centavos de diferença que são matemática, não
 * erro de leitura.
 *
 * Meio centavo por unidade é exatamente o pior caso desse arredondamento.
 * Continua desprezível perto do erro que importa pegar: trocar a coluna do
 * unitário pela do total numa linha de quantidade 4 erra por 300%.
 */
function toleranciaDaLinha(quantidade: number): number {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return TOLERANCIA_DE_CENTAVOS;
  return Math.max(TOLERANCIA_DE_CENTAVOS, Math.ceil(quantidade / 2));
}

function diferencaAbsoluta(aCentavos: number, bCentavos: number): number {
  return Math.abs(subtrair(aCentavos, bCentavos));
}

function conferirItem(item: ItemLidoDaNota): ConferenciaDoItem {
  const problemas: ProblemaDoItem[] = [];

  const quantidadeValida = Number.isFinite(item.quantidade) && item.quantidade > 0;
  if (!quantidadeValida) problemas.push("QUANTIDADE_INVALIDA");

  if (
    !Number.isInteger(item.valorUnitarioCentavos) ||
    item.valorUnitarioCentavos < 0 ||
    !Number.isInteger(item.valorTotalCentavos) ||
    item.valorTotalCentavos < 0
  ) {
    problemas.push("VALOR_INVALIDO");
  }

  const totalCalculadoCentavos =
    quantidadeValida && Number.isInteger(item.valorUnitarioCentavos)
      ? multiplicarPorQuantidade(item.valorUnitarioCentavos, item.quantidade)
      : 0;

  if (
    problemas.length === 0 &&
    diferencaAbsoluta(totalCalculadoCentavos, item.valorTotalCentavos) >
      toleranciaDaLinha(item.quantidade)
  ) {
    problemas.push("TOTAL_NAO_BATE");
  }

  return { ordem: item.ordem, problemas, totalCalculadoCentavos };
}

/**
 * Passa a nota inteira pelas três contas.
 *
 * A tolerância da SOMA cresce com o número de linhas (um centavo por linha):
 * cada linha pode carregar legitimamente o seu centavo de arredondamento, e
 * uma nota de quarenta itens não pode ser reprovada por acumular quarenta
 * centavos que o próprio fornecedor arredondou.
 */
export function conferirNota(nota: NotaLida): ConferenciaDaNota {
  const itens = nota.itens.map(conferirItem);
  const problemas: ProblemaDaNota[] = [];

  if (nota.itens.length === 0) problemas.push("SEM_ITENS");

  const somaDosItensCentavos = somar(...nota.itens.map((item) => item.valorTotalCentavos));

  // A tolerância do somatório é a soma das tolerâncias das linhas: cada
  // linha pode carregar legitimamente o seu arredondamento, e uma nota de
  // quarenta itens não pode ser reprovada por acumular o que o próprio
  // fornecedor arredondou quarenta vezes.
  const toleranciaDaSoma = Math.max(
    TOLERANCIA_DE_CENTAVOS,
    nota.itens.reduce((total, item) => total + toleranciaDaLinha(item.quantidade), 0)
  );

  if (
    nota.valorProdutosCentavos !== null &&
    diferencaAbsoluta(somaDosItensCentavos, nota.valorProdutosCentavos) > toleranciaDaSoma
  ) {
    problemas.push("SOMA_DOS_ITENS_NAO_BATE");
  }

  if (nota.valorTotalCentavos !== null) {
    const esperado = subtrair(
      somar(nota.valorProdutosCentavos ?? somaDosItensCentavos, nota.valorFreteCentavos),
      nota.valorDescontoCentavos
    );

    if (diferencaAbsoluta(esperado, nota.valorTotalCentavos) > toleranciaDaSoma) {
      problemas.push("TOTAL_GERAL_NAO_BATE");
    }
  }

  const itensConferidos = itens.filter((item) => item.problemas.length === 0).length;

  return {
    itens,
    problemas,
    somaDosItensCentavos,
    itensConferidos,
    fecha: problemas.length === 0 && itensConferidos === nota.itens.length,
  };
}
