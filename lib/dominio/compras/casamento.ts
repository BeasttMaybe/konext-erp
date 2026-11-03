/**
 * Achar, no catálogo da loja, o produto que a linha da nota está falando.
 *
 * É o passo que decide se a entrada de nota economiza trabalho ou cria
 * trabalho. Sem ele, quinze linhas viram quinze buscas manuais. Com ele
 * frouxo demais, uma linha casa com o produto errado e o custo de um item
 * sobrescreve o de outro — o que é pior do que não casar nada, porque
 * ninguém vai conferir um casamento que o sistema apresentou como certo.
 *
 * Daí a separação em DOIS níveis, que a tela trata de forma diferente:
 *
 * - `CERTEZA` é identidade: código de barras igual, SKU igual, nome igual.
 *   São comparações exatas, não parecidas. Vêm marcadas e prontas.
 * - `SUGESTAO` é semelhança de nome. Vem desmarcada, com o grau de
 *   semelhança à vista, e só entra se alguém disser que sim.
 *
 * Nenhuma sugestão vira vínculo sozinha. A diferença entre "o sistema
 * achou" e "eu conferi" é a coisa toda.
 */

import { normalizarNome } from "@/lib/dominio/texto/chave-de-nome";

export type ProdutoParaCasar = {
  id: string;
  nome: string;
  sku: string | null;
  codigoBarras: string | null;
};

export type MotivoDoCasamento =
  | "CODIGO_DE_BARRAS"
  | "SKU"
  | "NOME_IDENTICO"
  | "NOME_PARECIDO";

export type Candidato = {
  produtoId: string;
  nome: string;
  motivo: MotivoDoCasamento;
  /** 0 a 1. Sempre 1 nos motivos de identidade. */
  semelhanca: number;
};

export type CasamentoDoItem = {
  /** O melhor candidato, ou nulo quando nada passou do piso. */
  escolhido: Candidato | null;
  /** `true` só quando foi identidade — é o que a tela já deixa marcado. */
  certeza: boolean;
  /** Outros candidatos, pra tela oferecer a troca sem nova busca. */
  alternativas: Candidato[];
};

/**
 * Palavras que não distinguem produto nenhum neste ramo.
 *
 * Sem tirar as preposições, "capa de silicone para iphone" e "pelicula de
 * vidro para iphone" já começam com três palavras em comum de seis — o
 * bastante pra empurrar duas coisas diferentes acima do piso de semelhança.
 */
const PALAVRAS_SEM_VALOR = new Set([
  "de", "da", "do", "das", "dos", "para", "pra", "p", "com", "sem", "e", "a", "o", "em", "no", "na",
]);

function emTermos(texto: string): string[] {
  return normalizarNome(texto)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((termo) => termo !== "" && !PALAVRAS_SEM_VALOR.has(termo));
}

/**
 * Metade do crédito quando nenhum dos dois nomes diz a mesma COISA.
 *
 * Dice puro não serve neste ramo, e a diferença não é sutil: "Capa iPhone
 * 13" e "Película iPhone 13" dividem dois termos de três e dão 0,67 — acima
 * de qualquer piso razoável. O motivo é que quase todo produto de assistência
 * técnica termina no mesmo modelo de aparelho, então o modelo não distingue
 * nada; o que distingue é o substantivo que diz o que a peça é.
 *
 * O desempate é esse substantivo. Em nome de produto ele vem na frente, dos
 * dois lados do balcão — o fornecedor escreve "CASE DE IPHONE", "PELICULA DE
 * VIDRO 3D FINA", e o catálogo escreve "Case iPhone 18 Pro". Quando o termo
 * de abertura de um não aparece em lugar nenhum do outro, as duas linhas
 * estão falando de categorias diferentes e a semelhança cai pela metade.
 *
 * A verificação é nos DOIS sentidos, e por presença em qualquer posição:
 * quem cadastra "iPhone 13 capa silicone", com o aparelho na frente,
 * continua casando com "Capa iPhone 13".
 */
const PENALIDADE_DE_CATEGORIA_DIFERENTE = 0.5;

/**
 * Semelhança de Sørensen–Dice sobre os termos: o dobro dos termos em comum
 * dividido pelo total dos dois lados.
 *
 * Por termo e não por letra porque o que muda entre o nome do fornecedor e o
 * nome do catálogo é ordem e abreviação de PALAVRA — "CASE DE IPHONE IP 18
 * PRO" contra "Case iPhone 18 Pro". Comparando letra a letra, a diferença de
 * comprimento domina e as duas parecem distantes; comparando termos,
 * "case/iphone/18/pro" aparece inteiro dos dois lados.
 */
export function semelhancaDeNome(a: string, b: string): number {
  const listaA = emTermos(a);
  const listaB = emTermos(b);

  const termosA = new Set(listaA);
  const termosB = new Set(listaB);

  if (termosA.size === 0 || termosB.size === 0) return 0;

  let comuns = 0;
  for (const termo of termosA) if (termosB.has(termo)) comuns += 1;

  const dice = (2 * comuns) / (termosA.size + termosB.size);

  const mesmaCategoria = termosB.has(listaA[0]) || termosA.has(listaB[0]);

  return mesmaCategoria ? dice : dice * PENALIDADE_DE_CATEGORIA_DIFERENTE;
}

/**
 * Piso de semelhança pra uma sugestão sequer aparecer.
 *
 * Abaixo de 0,55 a lista vira ruído: com nomes curtos de acessório, duas
 * palavras em comum de seis já chegam a 0,33, e "película iPhone 13" casaria
 * com "capa iPhone 13". Uma sugestão ruim custa mais do que nenhuma, porque
 * quem confere quinze linhas rápido tende a aceitar o que está na frente.
 */
export const SEMELHANCA_MINIMA = 0.55;

/** Quantas alternativas a tela recebe além da escolhida. */
const MAXIMO_DE_ALTERNATIVAS = 4;

function soDigitos(valor: string | null): string | null {
  const limpo = valor?.replace(/\D/g, "") ?? "";
  return limpo === "" ? null : limpo;
}

/**
 * Casa UMA linha da nota contra o catálogo.
 *
 * A ordem dos critérios é a ordem da confiança, e a primeira identidade
 * encontrada encerra a busca: código de barras do fabricante é o mesmo
 * número no mundo inteiro, e não há semelhança de nome que valha mais do que
 * isso.
 */
export function casarItem(
  item: {
    descricao: string;
    grupo?: string | null;
    ean: string | null;
    codigoFornecedor: string | null;
  },
  catalogo: ProdutoParaCasar[]
): CasamentoDoItem {
  const ean = soDigitos(item.ean);

  if (ean) {
    const porCodigo = catalogo.find((produto) => soDigitos(produto.codigoBarras) === ean);
    if (porCodigo) {
      return {
        escolhido: {
          produtoId: porCodigo.id,
          nome: porCodigo.nome,
          motivo: "CODIGO_DE_BARRAS",
          semelhanca: 1,
        },
        certeza: true,
        alternativas: [],
      };
    }
  }

  // O código do fornecedor só vale como identidade se alguém tiver gravado
  // ele no SKU do produto — é o jeito de quem já faz esse controle à mão não
  // perder o trabalho que já teve.
  const codigo = item.codigoFornecedor?.trim().toLowerCase();
  if (codigo) {
    const porSku = catalogo.find((produto) => produto.sku?.trim().toLowerCase() === codigo);
    if (porSku) {
      return {
        escolhido: { produtoId: porSku.id, nome: porSku.nome, motivo: "SKU", semelhanca: 1 },
        certeza: true,
        alternativas: [],
      };
    }
  }

  // Duas formas do nome: com o cabeçalho de seção e sem ele.
  //
  // O prefixo do grupo é indispensável numa linha ("CASE DE IPHONE" + "IP 18
  // PRO") e é ruído em outra ("ACESSORIOS" + "FONTE H'MASTON 20W USB-C", que
  // já nomeia o produto inteiro). Tentar as duas resolve os dois casos sem
  // precisar adivinhar de qual se trata.
  const formasDoNome = [item.descricao];

  if (item.grupo) {
    const semGrupo = item.descricao.slice(item.grupo.length).trim();
    if (semGrupo.length > 0) formasDoNome.push(semGrupo);
  }

  for (const forma of formasDoNome) {
    const normalizado = normalizarNome(forma);
    const porNome = catalogo.find((produto) => normalizarNome(produto.nome) === normalizado);

    if (porNome) {
      return {
        escolhido: {
          produtoId: porNome.id,
          nome: porNome.nome,
          motivo: "NOME_IDENTICO",
          semelhanca: 1,
        },
        certeza: true,
        alternativas: [],
      };
    }
  }

  const parecidos = catalogo
    .map((produto) => ({
      produtoId: produto.id,
      nome: produto.nome,
      motivo: "NOME_PARECIDO" as const,
      // A melhor das duas formas: a com prefixo distingue produtos que só o
      // grupo separa, e a sem prefixo não é punida por carregá-lo.
      semelhanca: Math.max(
        ...formasDoNome.map((forma) => semelhancaDeNome(forma, produto.nome))
      ),
    }))
    .filter((candidato) => candidato.semelhanca >= SEMELHANCA_MINIMA)
    // Empate de semelhança desempatado pelo nome, pra conferência de hoje
    // dar o mesmo resultado que a de ontem.
    .sort((a, b) => b.semelhanca - a.semelhanca || a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    escolhido: parecidos[0] ?? null,
    certeza: false,
    alternativas: parecidos.slice(1, 1 + MAXIMO_DE_ALTERNATIVAS),
  };
}
