/**
 * Regras da etiqueta do produto.
 *
 * O ponto da etiqueta é o leitor da loja conseguir bipar. Isso decide duas
 * coisas que não são escolha de estilo:
 *
 * 1. **Qual simbologia.** Se o produto tem o código de barras do fabricante
 *    (12 ou 13 dígitos), a etiqueta usa EAN-13 — é o que o leitor espera e o
 *    que permite bipar a embalagem original. Sem ele, usa Code128 com o SKU,
 *    que aceita letra e hífen (`CAP-0012`) e é o que o EAN não aceita.
 * 2. **Qual tamanho.** A etiqueta sai numa impressora térmica de rolo, e o
 *    tamanho é o da etiqueta física já comprada. Errar o tamanho não produz
 *    etiqueta feia: produz etiqueta cortada.
 */

/** Simbologias suportadas, nos nomes que o gerador entende. */
export type SimbologiaEtiqueta = "ean13" | "ean8" | "code128";

export type CodigoDaEtiqueta = {
  simbologia: SimbologiaEtiqueta;
  /** O que vai codificado nas barras. */
  conteudo: string;
  /** O que é impresso em texto abaixo das barras. */
  legenda: string;
  /**
   * De onde o código saiu, pra tela poder avisar. Produto sem SKU e sem código
   * de barras não tem etiqueta — e dizer isso é melhor que imprimir uma
   * etiqueta com barras que não representam nada.
   */
  origem: "CODIGO_DE_BARRAS" | "SKU";
};

const APENAS_DIGITOS = /^\d+$/;

/**
 * Escolhe o que a etiqueta codifica.
 *
 * `null` quando o produto não tem nem código de barras nem SKU: a etiqueta
 * precisa de ALGO que o leitor devolva, e inventar um número aqui geraria uma
 * etiqueta que bipa e não acha produto nenhum.
 */
export function codigoDaEtiqueta(produto: {
  codigoBarras: string | null;
  sku: string | null;
}): CodigoDaEtiqueta | null {
  const codigoBarras = produto.codigoBarras?.trim() ?? "";
  const sku = produto.sku?.trim() ?? "";

  if (codigoBarras.length > 0 && APENAS_DIGITOS.test(codigoBarras)) {
    // 12 dígitos: o EAN-13 calcula o 13º (dígito verificador) sozinho.
    if (codigoBarras.length === 12 || codigoBarras.length === 13) {
      return {
        simbologia: "ean13",
        conteudo: codigoBarras,
        legenda: codigoBarras,
        origem: "CODIGO_DE_BARRAS",
      };
    }

    if (codigoBarras.length === 7 || codigoBarras.length === 8) {
      return {
        simbologia: "ean8",
        conteudo: codigoBarras,
        legenda: codigoBarras,
        origem: "CODIGO_DE_BARRAS",
      };
    }
  }

  // Código de barras com letra, ou com um número de dígitos que não é EAN,
  // ainda vale: o Code128 codifica qualquer coisa imprimível. Melhor bipar o
  // código que o dono cadastrou do que ignorá-lo e usar o SKU.
  if (codigoBarras.length > 0) {
    return {
      simbologia: "code128",
      conteudo: codigoBarras,
      legenda: codigoBarras,
      origem: "CODIGO_DE_BARRAS",
    };
  }

  if (sku.length > 0) {
    return { simbologia: "code128", conteudo: sku, legenda: sku, origem: "SKU" };
  }

  return null;
}

/**
 * Confere o dígito verificador de um EAN-8/EAN-13.
 *
 * Existe porque o gerador RECUSA um EAN de 13 dígitos com verificador errado —
 * e com razão: um dígito trocado na digitação produz um código que nenhum
 * leitor de loja reconhece como aquele produto. Sem esta conferência, o dono só
 * descobriria o erro ao tentar imprimir, e a mensagem seria
 * `bwipp.ean13badCheckDigit#6915`.
 *
 * A regra é a do GS1: soma ponderada 1-3 da direita pra esquerda, e o
 * verificador é o que falta pra fechar na dezena.
 *
 * `null` quando o código não tem tamanho de EAN completo — aí não há
 * verificador a conferir (um EAN-13 de 12 dígitos é válido justamente porque o
 * 13º ainda vai ser calculado).
 */
export function digitoVerificadorEanConfere(codigo: string): boolean | null {
  const limpo = codigo.trim();

  if (!APENAS_DIGITOS.test(limpo)) return null;
  if (limpo.length !== 8 && limpo.length !== 13) return null;

  const digitos = limpo.split("").map(Number);
  const informado = digitos.pop()!;

  // Da direita pra esquerda, pesos alternam 3 e 1 — começando em 3.
  const soma = digitos
    .reverse()
    .reduce((total, digito, indice) => total + digito * (indice % 2 === 0 ? 3 : 1), 0);

  return (10 - (soma % 10)) % 10 === informado;
}

export type TamanhoEtiqueta = {
  id: string;
  rotulo: string;
  larguraMm: number;
  alturaMm: number;
  /** Descrição curta pro dono reconhecer o rolo que tem na gaveta. */
  ajuda: string;
};

/**
 * Os três tamanhos de rolo que uma assistência compra. Lista fixa: o tamanho
 * tem que casar com a etiqueta física, então é escolha de uma lista, nunca
 * campo livre em milímetros.
 */
export const TAMANHOS_DE_ETIQUETA: readonly TamanhoEtiqueta[] = [
  {
    id: "33x22",
    rotulo: "33 × 22 mm",
    larguraMm: 33,
    alturaMm: 22,
    ajuda: "Rolo pequeno, duas colunas. Só código e preço.",
  },
  {
    id: "50x30",
    rotulo: "50 × 30 mm",
    larguraMm: 50,
    alturaMm: 30,
    ajuda: "O mais comum. Cabe nome, preço e código.",
  },
  {
    id: "60x40",
    rotulo: "60 × 40 mm",
    larguraMm: 60,
    alturaMm: 40,
    ajuda: "Maior, para nome comprido e compatibilidade.",
  },
] as const;

export const TAMANHO_DE_ETIQUETA_PADRAO = "50x30";

export function acharTamanhoDeEtiqueta(id: string): TamanhoEtiqueta {
  return (
    TAMANHOS_DE_ETIQUETA.find((tamanho) => tamanho.id === id) ??
    TAMANHOS_DE_ETIQUETA.find((tamanho) => tamanho.id === TAMANHO_DE_ETIQUETA_PADRAO)!
  );
}

/**
 * Milímetros para pontos tipográficos, que é a unidade do PDF (1 pt = 1/72").
 *
 * A conversão precisa ser exata: a impressora térmica corta no tamanho físico
 * do rolo, então 1 mm de erro acumulado numa etiqueta de 22 mm de altura já
 * desloca o conteúdo pro meio do picote.
 */
export function mmParaPontos(milimetros: number): number {
  return (milimetros * 72) / 25.4;
}

/**
 * O nome não cabe inteiro numa etiqueta de 33 mm, e o PDF não quebra texto
 * elegantemente nesse espaço. Cortar aqui, com reticências, é melhor que
 * deixar o renderizador estourar a caixa — numa etiqueta, texto que estoura
 * some, ele não vira segunda linha.
 */
export function encurtarParaEtiqueta(texto: string, limite: number): string {
  const limpo = texto.trim().replace(/\s+/g, " ");
  if (limpo.length <= limite) return limpo;
  return `${limpo.slice(0, Math.max(1, limite - 1)).trimEnd()}…`;
}

/** Quantos caracteres do nome cabem, por tamanho de etiqueta. */
export function limiteDeNomePorTamanho(tamanho: TamanhoEtiqueta): number {
  if (tamanho.larguraMm <= 35) return 22;
  if (tamanho.larguraMm <= 52) return 38;
  return 50;
}
