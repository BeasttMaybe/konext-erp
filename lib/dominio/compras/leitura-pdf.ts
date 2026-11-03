/**
 * Lê a tabela de itens de um PDF de fornecedor a partir das PALAVRAS da
 * página — cada pedaço de texto com a posição onde foi desenhado.
 *
 * Um PDF não tem tabela. Tem texto em coordenadas. "Coluna" e "linha" são
 * coisas que o olho humano reconstrói e que aqui precisam ser inferidas, e é
 * por isso que este módulo não tenta adivinhar por template de fornecedor:
 * o primeiro fornecedor novo quebraria o template, e quebraria em silêncio,
 * gravando custo errado.
 *
 * A estratégia é ler como alguém leria:
 *
 * 1. Junta as palavras em linhas pelo Y (com folga, porque o emissor desenha
 *    a descrição e o preço com um ou dois pontos de diferença).
 * 2. Em cada linha, acha os VALORES MONETÁRIOS. O último é o total, o
 *    penúltimo é o unitário — a ordem da direita pra esquerda é a convenção
 *    de toda nota brasileira, e é mais estável que a posição absoluta.
 * 3. Um número solto ANTES do texto é a quantidade.
 * 4. O que sobra no meio é a descrição.
 *
 * Nada disso precisa estar certo por construção, porque `conferirNota` em
 * `./nota` testa cada linha pela aritmética (`quantidade × unitário = total`)
 * e a nota inteira pelos somatórios. Se a coluna foi trocada, a conta não
 * fecha e o item chega marcado na tela de conferência. A inferência é só o
 * palpite; a conta é a prova.
 */

import { lerReais } from "@/lib/dinheiro";

import type { ItemLidoDaNota, NotaLida } from "./nota";

/** Um pedaço de texto do PDF, com onde ele foi desenhado na página. */
export type PalavraPdf = {
  texto: string;
  /** Distância da borda esquerda, em pontos. */
  x: number;
  /** Altura na página, em pontos, contada DE BAIXO pra cima (padrão PDF). */
  y: number;
};

export type LinhaPdf = {
  y: number;
  palavras: PalavraPdf[];
};

/**
 * Folga vertical, em pontos, pra duas palavras contarem como a mesma linha.
 *
 * Três pontos. Emissor nenhum alinha a célula de descrição e a de preço no
 * mesmo Y exato — neste orçamento a quantidade e o valor de um item saíram
 * com um ponto de diferença, e com tolerância zero a linha se parte em duas,
 * uma sem preço e outra sem descrição. Mais do que isso começa a grudar
 * linhas vizinhas de tabelas apertadas, que é o erro oposto e pior: junta o
 * preço de um item com a descrição do outro.
 */
const FOLGA_DA_LINHA_EM_PONTOS = 3;

/** Agrupa as palavras em linhas, de cima pra baixo. */
export function agruparEmLinhas(
  palavras: PalavraPdf[],
  folga = FOLGA_DA_LINHA_EM_PONTOS
): LinhaPdf[] {
  const linhas: LinhaPdf[] = [];

  for (const palavra of palavras) {
    if (palavra.texto.trim() === "") continue;

    const existente = linhas.find((linha) => Math.abs(linha.y - palavra.y) <= folga);

    if (existente) {
      existente.palavras.push(palavra);
      continue;
    }

    linhas.push({ y: palavra.y, palavras: [palavra] });
  }

  for (const linha of linhas) linha.palavras.sort((a, b) => a.x - b.x);

  // Y cresce pra cima no PDF: decrescente é de cima pra baixo na folha.
  return linhas.sort((a, b) => b.y - a.y);
}

/** O texto da linha como uma pessoa leria. */
export function textoDaLinha(linha: LinhaPdf): string {
  return linha.palavras
    .map((palavra) => palavra.texto.trim())
    .filter((texto) => texto !== "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Valor monetário em pt-BR: exige as DUAS casas decimais depois da vírgula.
 *
 * Exigir as duas casas é o que separa dinheiro de quantidade no meio da
 * linha. "22,00" é preço; "5000mAh" e "1,5" não são. Sem essa exigência, a
 * quantidade fracionária de uma nota de peso viraria mais uma "coluna de
 * dinheiro" e empurraria o total pra posição errada.
 */
const PADRAO_MONETARIO = /^R?\$?\s*(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})$/;

/** Número solto, aceitando fracionário (nota de peso/medida). */
const PADRAO_QUANTIDADE = /^(\d+(?:[.,]\d{1,4})?)$/;

function lerValorMonetario(texto: string): number | null {
  const limpo = texto.trim();
  if (!PADRAO_MONETARIO.test(limpo)) return null;

  try {
    return lerReais(limpo);
  } catch {
    return null;
  }
}

function lerQuantidade(texto: string): number | null {
  const limpo = texto.trim();
  const encontrado = PADRAO_QUANTIDADE.exec(limpo);
  if (!encontrado) return null;

  const numero = Number(encontrado[1].replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * Junta um "R$" solto com o número seguinte.
 *
 * O emissor deste orçamento desenha o símbolo e o número como dois objetos
 * separados, a 60 pontos de distância um do outro (a moeda encostada na
 * borda esquerda da célula, o número alinhado à direita). Sem juntar, o "R$"
 * vira uma palavra de texto no meio da linha e corta a descrição ao meio.
 */
function juntarSimboloDeMoeda(palavras: PalavraPdf[]): PalavraPdf[] {
  const resultado: PalavraPdf[] = [];

  for (let indice = 0; indice < palavras.length; indice += 1) {
    const atual = palavras[indice];
    const proxima = palavras[indice + 1];

    if (/^R\$$/i.test(atual.texto.trim()) && proxima && lerValorMonetario(proxima.texto) !== null) {
      resultado.push({ texto: `R$ ${proxima.texto.trim()}`, x: atual.x, y: atual.y });
      indice += 1;
      continue;
    }

    resultado.push(atual);
  }

  return resultado;
}

/** Linhas de fechamento, reconhecidas por palavra-chave e não por posição. */
const ROTULOS_DE_TOTAL = {
  frete: /\bfrete\b|\bsedex\b|\bentrega\b|\btransporte\b/i,
  desconto: /\bdesconto\b|\babatimento\b/i,
  produtos: /\bsubtotal\b|\btotal\s+(?:das\s+)?mercadoria|\btotal\s+(?:dos\s+)?produto|\bvalor\s+(?:dos\s+)?produto/i,
  totalGeral: /\btotal\s+geral\b|\btotal\s+(?:da\s+)?nota\b|\bvalor\s+total\b|\btotal\s+a\s+pagar\b|^total$/i,
} as const;

type PapelDaLinha =
  | { tipo: "ITEM"; item: Omit<ItemLidoDaNota, "ordem" | "descricao"> & { descricao: string } }
  | { tipo: "TOTAL"; rotulo: keyof typeof ROTULOS_DE_TOTAL; valorCentavos: number }
  | { tipo: "CABECALHO_DE_GRUPO"; texto: string }
  | { tipo: "IGNORAR" };

function classificarLinha(linha: LinhaPdf): PapelDaLinha {
  const palavras = juntarSimboloDeMoeda(linha.palavras);
  const texto = textoDaLinha({ ...linha, palavras });

  if (texto === "") return { tipo: "IGNORAR" };

  const monetarios: Array<{ indice: number; centavos: number }> = [];
  palavras.forEach((palavra, indice) => {
    const centavos = lerValorMonetario(palavra.texto);
    if (centavos !== null) monetarios.push({ indice, centavos });
  });

  // Fechamento primeiro: "SUBTOTAL MERCADORIA R$ 501,00" tem dinheiro e texto
  // e passaria por item se a quantidade fosse inferida de forma mais frouxa.
  if (monetarios.length > 0) {
    for (const [rotulo, padrao] of Object.entries(ROTULOS_DE_TOTAL)) {
      if (padrao.test(texto)) {
        return {
          tipo: "TOTAL",
          rotulo: rotulo as keyof typeof ROTULOS_DE_TOTAL,
          // O valor de uma linha de fechamento é o último da direita.
          valorCentavos: monetarios[monetarios.length - 1].centavos,
        };
      }
    }
  }

  if (monetarios.length === 0) {
    // Texto sozinho no corpo da tabela: é o cabeçalho da seção ("CASE DE
    // IPHONE"), que dá nome aos itens que vêm abaixo dele.
    return { tipo: "CABECALHO_DE_GRUPO", texto };
  }

  const primeiroMonetario = monetarios[0].indice;
  const quantidade = lerQuantidade(palavras[0]?.texto ?? "");

  // Sem quantidade à esquerda não é linha de item: é rodapé, observação ou
  // um fechamento que a lista de rótulos não conhece. Vira linha ignorada e
  // aparece como aviso em vez de sumir.
  if (quantidade === null || primeiroMonetario < 1) return { tipo: "IGNORAR" };

  const descricao = palavras
    .slice(1, primeiroMonetario)
    .map((palavra) => palavra.texto.trim())
    .filter((parte) => parte !== "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (descricao === "") return { tipo: "IGNORAR" };

  // Dois ou mais valores: o último é o total da linha, o anterior é o
  // unitário. Com um valor só não dá pra saber qual dos dois é, então
  // assume-se unitário e o total declarado vira o calculado — a conferência
  // não tem o que provar nessa linha, e a tela mostra que não tem.
  const ultimo = monetarios[monetarios.length - 1].centavos;
  const penultimo = monetarios.length >= 2 ? monetarios[monetarios.length - 2].centavos : null;

  const valorUnitarioCentavos = penultimo ?? ultimo;
  const valorTotalCentavos =
    penultimo !== null ? ultimo : Math.round(valorUnitarioCentavos * quantidade);

  return {
    tipo: "ITEM",
    item: {
      descricao,
      grupo: null,
      codigoFornecedor: null,
      ean: null,
      ncm: null,
      unidade: null,
      quantidade,
      valorUnitarioCentavos,
      valorTotalCentavos,
    },
  };
}

/** Cabeçalho da tabela: o ponto onde o corpo começa. */
const PALAVRAS_DO_CABECALHO = [
  /^(qntd|qtd|qtde|quant\.?|quantidade)$/i,
  /^(descri[çc][ãa]o|produto|discrimina[çc][ãa]o|mercadoria)$/i,
  /^(total|vl\.?\s*total|valor\s*total)$/i,
  /^(pre[çc]o|unit[áa]rio|vl\.?\s*unit\.?|pre[çc]o\s*uni\.?)$/i,
];

function ehLinhaDeCabecalho(linha: LinhaPdf): boolean {
  const encontrados = PALAVRAS_DO_CABECALHO.filter((padrao) =>
    linha.palavras.some((palavra) => padrao.test(palavra.texto.trim()))
  );

  return encontrados.length >= 2;
}

const PADRAO_DE_DATA = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;

function acharDataDeEmissao(linhas: LinhaPdf[]): string | null {
  for (const linha of linhas.slice(0, 6)) {
    const encontrado = PADRAO_DE_DATA.exec(textoDaLinha(linha));
    if (encontrado) return `${encontrado[3]}-${encontrado[2]}-${encontrado[1]}`;
  }

  return null;
}

/**
 * O nome do fornecedor é um PALPITE a partir do topo da página.
 *
 * Um orçamento não tem campo de emitente como o XML tem — tem um timbre. O
 * que dá pra fazer é pegar a primeira linha de texto e tirar o tipo do
 * documento que costuma vir grudado ("EA CENTRAL - ORÇAMENTO"). Por ser
 * palpite, o nome chega editável na tela: errar aqui não contamina nada
 * além do rótulo, e o acerto é mais barato de corrigir do que de adivinhar.
 */
function acharEmitente(linhas: LinhaPdf[]): string | null {
  for (const linha of linhas.slice(0, 3)) {
    const texto = textoDaLinha(linha)
      .replace(
        /\s*[-–]\s*(or[çc]amento|pedido|nota|proposta|romaneio|pr[ée][- ]?venda).*$/i,
        ""
      )
      .trim();

    if (texto.length >= 3 && !PADRAO_DE_DATA.test(texto)) return texto;
  }

  return null;
}

const PADRAO_DE_CNPJ = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/;

function acharCnpj(linhas: LinhaPdf[]): string | null {
  for (const linha of linhas.slice(0, 8)) {
    const encontrado = PADRAO_DE_CNPJ.exec(textoDaLinha(linha));
    if (encontrado) return encontrado[1].replace(/\D/g, "");
  }

  return null;
}

/**
 * Monta a nota a partir das palavras da página.
 *
 * O corpo começa depois da linha de cabeçalho da tabela. Quando não há
 * cabeçalho reconhecível, começa uma linha ANTES do primeiro item — porque o
 * cabeçalho de grupo do primeiro bloco ("CASE DE IPHONE") fica exatamente
 * ali, e começar no próprio item perderia o nome de todo o primeiro grupo.
 */
export function lerNotaDePalavras(palavras: PalavraPdf[]): NotaLida {
  const linhas = agruparEmLinhas(palavras);
  const classificadas = linhas.map((linha) => ({ linha, papel: classificarLinha(linha) }));

  const indiceDoCabecalho = linhas.findIndex(ehLinhaDeCabecalho);
  const primeiroItem = classificadas.findIndex((entrada) => entrada.papel.tipo === "ITEM");

  const inicioDoCorpo =
    indiceDoCabecalho >= 0
      ? indiceDoCabecalho + 1
      : primeiroItem > 0
        ? primeiroItem - 1
        : Math.max(primeiroItem, 0);

  const itens: ItemLidoDaNota[] = [];
  const linhasIgnoradas: string[] = [];

  let grupoAtual: string | null = null;
  let valorProdutosCentavos: number | null = null;
  let valorTotalCentavos: number | null = null;
  let valorFreteCentavos = 0;
  let valorDescontoCentavos = 0;

  for (const { linha, papel } of classificadas.slice(inicioDoCorpo)) {
    switch (papel.tipo) {
      case "CABECALHO_DE_GRUPO":
        grupoAtual = papel.texto;
        break;

      case "ITEM": {
        const descricao = grupoAtual
          ? `${grupoAtual} ${papel.item.descricao}`.replace(/\s+/g, " ").trim()
          : papel.item.descricao;

        itens.push({ ...papel.item, descricao, grupo: grupoAtual, ordem: itens.length + 1 });
        break;
      }

      case "TOTAL":
        // Fechamento encerra o bloco: o que vier depois é rodapé, e não pode
        // virar nome de grupo de item nenhum.
        grupoAtual = null;

        if (papel.rotulo === "frete") valorFreteCentavos = papel.valorCentavos;
        if (papel.rotulo === "desconto") valorDescontoCentavos = papel.valorCentavos;
        if (papel.rotulo === "produtos") valorProdutosCentavos = papel.valorCentavos;
        if (papel.rotulo === "totalGeral") valorTotalCentavos = papel.valorCentavos;
        break;

      case "IGNORAR": {
        const texto = textoDaLinha(linha);
        // Só vira aviso o que tem cara de item perdido: linha com dinheiro.
        // Rodapé de endereço e telefone não interessa a ninguém.
        if (texto !== "" && /\d+,\d{2}/.test(texto)) linhasIgnoradas.push(texto);
        break;
      }
    }
  }

  return {
    origem: "PDF",
    chaveAcesso: null,
    numero: null,
    serie: null,
    emitenteNome: acharEmitente(linhas),
    emitenteCnpj: acharCnpj(linhas),
    emitidaEm: acharDataDeEmissao(linhas),
    itens,
    valorProdutosCentavos,
    valorFreteCentavos,
    valorDescontoCentavos,
    valorTotalCentavos,
    linhasIgnoradas,
  };
}
