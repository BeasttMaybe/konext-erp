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

type RotuloDeTotal = keyof typeof ROTULOS_DE_TOTAL;

type PapelDaLinha =
  | { tipo: "ITEM"; item: Omit<ItemLidoDaNota, "ordem" | "descricao"> & { descricao: string } }
  | { tipo: "TOTAL"; valores: Array<{ rotulo: RotuloDeTotal; centavos: number }> }
  | { tipo: "CABECALHO_DE_GRUPO"; texto: string }
  | { tipo: "IGNORAR" };

/** Dinheiro em pt-BR dentro de um texto maior, com a posição de cada achado. */
const MOEDA_NO_TEXTO = /R?\$?\s*(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})\b/g;

/**
 * Lê uma linha de fechamento como uma sequência de RÓTULO → VALOR.
 *
 * Antes isto era "achou a palavra frete na linha? então o último valor da
 * linha é o frete" — e errava de dois jeitos que só aparecem fora da nota
 * que serviu de modelo:
 *
 * 1. Um emissor que escreve tudo numa linha só ("MERCADORIAS R$ 258,00
 *    DESCONTO R$ 8,00 FRETE R$ 20,00 VALOR TOTAL R$ 270,00") fazia o frete
 *    virar R$ 270,00 — o último valor, não o que vem depois da palavra.
 * 2. Um emissor que escreve "Subtotal: R$ 333,00" como um pedaço de texto só
 *    não era reconhecido de jeito nenhum, porque o valor precisava estar
 *    isolado numa célula. A nota entrava com frete zero.
 *
 * Agora cada valor é associado ao rótulo que aparece ANTES dele no texto, o
 * que é como se lê a linha.
 */
function lerValoresDeFechamento(texto: string): Array<{ rotulo: RotuloDeTotal; centavos: number }> {
  const achados: Array<{ rotulo: RotuloDeTotal; centavos: number }> = [];

  MOEDA_NO_TEXTO.lastIndex = 0;
  let fim = 0;
  let encontrado: RegExpExecArray | null;

  while ((encontrado = MOEDA_NO_TEXTO.exec(texto)) !== null) {
    // O trecho entre o valor anterior e este é onde mora o rótulo dele.
    const trecho = texto.slice(fim, encontrado.index);
    fim = encontrado.index + encontrado[0].length;

    const centavos = lerValorMonetario(`${encontrado[1]},${encontrado[2]}`);
    if (centavos === null) continue;

    for (const [rotulo, padrao] of Object.entries(ROTULOS_DE_TOTAL)) {
      if (padrao.test(trecho)) {
        achados.push({ rotulo: rotulo as RotuloDeTotal, centavos });
        break;
      }
    }
  }

  return achados;
}

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
  const fechamento = lerValoresDeFechamento(texto);
  if (fechamento.length > 0) return { tipo: "TOTAL", valores: fechamento };

  if (monetarios.length === 0) {
    // Texto sozinho no corpo da tabela: é o cabeçalho da seção ("CASE DE
    // IPHONE"), que dá nome aos itens que vêm abaixo dele.
    return { tipo: "CABECALHO_DE_GRUPO", texto };
  }

  const primeiroMonetario = monetarios[0].indice;

  // A quantidade não é obrigatoriamente o PRIMEIRO campo da linha.
  //
  // Metade dos emissores põe um código de produto antes dela ("A-1001 | 10 |
  // SUPORTE VEICULAR"), e exigir a quantidade na posição zero fazia a nota
  // inteira ser lida como zero itens — a linha não casava com nada e virava
  // aviso.
  //
  // Então todo campo numérico à esquerda do dinheiro é CANDIDATO a
  // quantidade, e quem desempata é a conta: vence o candidato cujo
  // `quantidade × unitário` reproduz o total da linha. É o mesmo princípio
  // que o módulo inteiro segue — a inferência é o palpite, a conta é a prova
  // — só que aplicado antes, para escolher entre palpites em vez de apenas
  // julgar um.
  const candidatos: Array<{ indice: number; quantidade: number }> = [];
  for (let indice = 0; indice < primeiroMonetario; indice += 1) {
    const quantidade = lerQuantidade(palavras[indice]?.texto ?? "");
    if (quantidade !== null) candidatos.push({ indice, quantidade });
  }

  // Sem nenhum número à esquerda não é linha de item: é rodapé, observação
  // ou um fechamento que a lista de rótulos não conhece. Vira linha ignorada
  // e aparece como aviso em vez de sumir.
  if (candidatos.length === 0 || primeiroMonetario < 1) return { tipo: "IGNORAR" };

  // Dois ou mais valores: o último é o total da linha, o anterior é o
  // unitário. Com um valor só não dá pra saber qual dos dois é, então
  // assume-se unitário e o total declarado vira o calculado — a conferência
  // não tem o que provar nessa linha, e a tela mostra que não tem.
  const ultimo = monetarios[monetarios.length - 1].centavos;
  const penultimo = monetarios.length >= 2 ? monetarios[monetarios.length - 2].centavos : null;

  const valorUnitarioCentavos = penultimo ?? ultimo;

  const escolhido =
    penultimo === null
      ? candidatos[0]
      : (candidatos.find(
          (candidato) =>
            Math.abs(Math.round(valorUnitarioCentavos * candidato.quantidade) - ultimo) <=
            Math.max(1, Math.ceil(candidato.quantidade / 2))
        ) ?? candidatos[0]);

  const valorTotalCentavos =
    penultimo !== null ? ultimo : Math.round(valorUnitarioCentavos * escolhido.quantidade);

  // Tudo à esquerda da quantidade é código do fornecedor; o que fica entre
  // ela e o dinheiro é a descrição.
  const juntar = (de: number, ate: number) =>
    palavras
      .slice(de, ate)
      .map((palavra) => palavra.texto.trim())
      .filter((parte) => parte !== "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  const descricao = juntar(escolhido.indice + 1, primeiroMonetario);
  const codigoFornecedor = juntar(0, escolhido.indice);

  if (descricao === "") return { tipo: "IGNORAR" };

  return {
    tipo: "ITEM",
    item: {
      descricao,
      grupo: null,
      codigoFornecedor: codigoFornecedor === "" ? null : codigoFornecedor,
      ean: null,
      ncm: null,
      unidade: null,
      quantidade: escolhido.quantidade,
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
/**
 * Onde o nome do fornecedor acaba e os dados do documento começam.
 *
 * Quase todo timbre junta as duas coisas numa linha só: "EA CENTRAL -
 * ORÇAMENTO", "MEGA PARTS IMPORT — Orçamento 445/26 — 30/10/2026", "NORTE
 * CELL COMERCIO — CNPJ 55.444.333/0001-22 — NOTA 12345". O nome é sempre o
 * que vem antes do primeiro desses marcadores.
 */
const INICIO_DOS_DADOS_DO_DOCUMENTO =
  /\s*[-–—|]?\s*\b(or[çc]amento|pedido|nota\s*fiscal|nota|proposta|romaneio|pr[ée][- ]?venda|cnpj|cpf|data|emiss[ãa]o)\b/i;

function acharEmitente(
  classificadas: Array<{ linha: LinhaPdf; papel: PapelDaLinha }>
): string | null {
  for (const { linha, papel } of classificadas.slice(0, 4)) {
    // Linha que já é item, fechamento ou cabeçalho de tabela não é timbre.
    //
    // Sem esta conferência, um documento cujo timbre traz a data colada tinha
    // a primeira linha descartada inteira e o nome do fornecedor virava a
    // linha seguinte — que costuma ser o cabeçalho da tabela ("Cód Qt Produto
    // Unitário Total") ou o primeiro item. Um nome errado que parece
    // plausível é pior que nenhum: ninguém confere o que parece certo.
    if (papel.tipo !== "CABECALHO_DE_GRUPO" && papel.tipo !== "IGNORAR") continue;
    if (ehLinhaDeCabecalho(linha)) continue;

    const bruto = textoDaLinha(linha);

    // Corta no primeiro marcador de dado do documento em vez de descartar a
    // linha: o nome está ali, na frente dele.
    const corte = INICIO_DOS_DADOS_DO_DOCUMENTO.exec(bruto);
    const texto = (corte ? bruto.slice(0, corte.index) : bruto)
      .replace(/[\s\-–—|]+$/, "")
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

/** Um cabeçalho de grupo não carrega data nem CNPJ — isso é timbre. */
function podeSerCabecalhoDeGrupo(texto: string): boolean {
  if (PADRAO_DE_DATA.test(texto)) return false;
  if (PADRAO_DE_CNPJ.test(texto)) return false;
  if (/\b(or[çc]amento|pedido|nota fiscal|cnpj|raz[ãa]o social)\b/i.test(texto)) return false;

  return true;
}

/**
 * Monta a nota a partir das palavras da página.
 *
 * O corpo começa depois da linha de cabeçalho da tabela. Quando não há
 * cabeçalho reconhecível, começa NO primeiro item.
 *
 * Esse "no primeiro item" já foi "uma linha antes", pra capturar o cabeçalho
 * de grupo do primeiro bloco ("CASE DE IPHONE"), que fica exatamente ali. O
 * preço era alto demais: num documento sem cabeçalho de tabela, a linha
 * anterior ao primeiro item é o TIMBRE, e todo produto saía com o nome do
 * fornecedor e a data colados na frente — "MEGA PARTS IMPORT — Orçamento
 * 445/26 — 30/10/2026 TELA INCELL IPHONE 11".
 *
 * Perder o nome do primeiro grupo num documento sem cabeçalho é um erro
 * menor, e visível na tela de conferência; contaminar todos os nomes é um
 * erro que se propaga pro cadastro do produto.
 */
export function lerNotaDePalavras(palavras: PalavraPdf[]): NotaLida {
  const linhas = agruparEmLinhas(palavras);
  const classificadas = linhas.map((linha) => ({ linha, papel: classificarLinha(linha) }));

  const indiceDoCabecalho = linhas.findIndex(ehLinhaDeCabecalho);
  const primeiroItem = classificadas.findIndex((entrada) => entrada.papel.tipo === "ITEM");

  const inicioDoCorpo =
    indiceDoCabecalho >= 0 ? indiceDoCabecalho + 1 : Math.max(primeiroItem, 0);

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
        // Linha de texto com data ou CNPJ é timbre, não nome de seção.
        grupoAtual = podeSerCabecalhoDeGrupo(papel.texto) ? papel.texto : null;
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

        for (const { rotulo, centavos } of papel.valores) {
          if (rotulo === "frete") valorFreteCentavos = centavos;
          if (rotulo === "desconto") valorDescontoCentavos = centavos;
          if (rotulo === "produtos") valorProdutosCentavos = centavos;
          if (rotulo === "totalGeral") valorTotalCentavos = centavos;
        }
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
    emitenteNome: acharEmitente(classificadas),
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
