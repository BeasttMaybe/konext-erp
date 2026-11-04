import { describe, expect, it } from "vitest";

import { formatarReais, somar } from "@/lib/dinheiro";

import { LAYOUT_COLUNAS_SEM_CODIGO } from "./amostras/a-colunas-invertidas";
import { LAYOUT_SEM_CABECALHO_DE_TABELA } from "./amostras/b-sem-cabecalho";
import { LAYOUT_COM_CODIGO_DO_FORNECEDOR } from "./amostras/c-com-codigo";
import { LAYOUT_DUAS_PAGINAS } from "./amostras/d-duas-paginas";
import { LAYOUT_DESCRICAO_EM_DUAS_LINHAS } from "./amostras/e-descricao-quebrada";
import { LAYOUT_SEM_CIFRAO_COM_UNIDADE } from "./amostras/f-sem-cifrao-fracionado";
import { lerNotaDePalavras, type PalavraPdf } from "./leitura-pdf";
import { conferirNota } from "./nota";

/**
 * Sete fornecedores, sete layouts.
 *
 * O orçamento da EA CENTRAL (em `leitura-pdf.test.ts`) é a nota real que
 * originou o parser, e passar nela não prova quase nada: todo parser passa
 * no documento que serviu de modelo. Estes seis foram desenhados PARA
 * QUEBRÁ-LO, cada um mexendo numa suposição diferente — e os seis
 * quebraram, de sete jeitos distintos, na primeira vez que rodaram.
 *
 * O que cada um pegou está no comentário da própria amostra. O que todos
 * provam junto é a única coisa que importa aqui: a leitura de um PDF só pode
 * ser confiada quando a CONTA DELE FECHA, e a conta dos quatro fecha.
 */

type Caso = {
  nome: string;
  palavras: PalavraPdf[];
  emitente: string;
  emitidaEm: string;
  itens: number;
  /** Nulo quando o documento não declara o subtotal de mercadoria. */
  produtosCentavos: number | null;
  freteCentavos: number;
  descontoCentavos: number;
  totalCentavos: number | null;
};

const CASOS: Caso[] = [
  {
    nome: "colunas sem código, fechamento com rótulo colado no valor",
    palavras: LAYOUT_COLUNAS_SEM_CODIGO,
    emitente: "DISTRIBUIDORA SUL ACESSORIOS LTDA",
    emitidaEm: "2026-10-28",
    itens: 4,
    produtosCentavos: 33_300,
    freteCentavos: 4_150,
    descontoCentavos: 0,
    totalCentavos: 37_450,
  },
  {
    nome: "sem cabeçalho de tabela",
    palavras: LAYOUT_SEM_CABECALHO_DE_TABELA,
    emitente: "MEGA PARTS IMPORT",
    emitidaEm: "2026-10-30",
    itens: 3,
    produtosCentavos: null,
    freteCentavos: 0,
    descontoCentavos: 0,
    totalCentavos: 47_540,
  },
  {
    nome: "código do fornecedor antes da quantidade, fechamento numa linha só",
    palavras: LAYOUT_COM_CODIGO_DO_FORNECEDOR,
    emitente: "NORTE CELL COMERCIO",
    emitidaEm: "2026-10-29",
    itens: 3,
    // "MERCADORIAS R$ 258,00" sozinho conta como subtotal: nem todo emissor
    // escreve a palavra "subtotal" ou "total de produtos".
    produtosCentavos: 25_800,
    freteCentavos: 2_000,
    descontoCentavos: 800,
    totalCentavos: 27_000,
  },
  {
    nome: "duas páginas, com o cabeçalho da tabela repetido na segunda",
    palavras: LAYOUT_DUAS_PAGINAS,
    emitente: "ATACADO TECH PECAS",
    emitidaEm: "2026-10-31",
    itens: 5,
    produtosCentavos: 56_400,
    freteCentavos: 3_600,
    descontoCentavos: 0,
    totalCentavos: 60_000,
  },
  {
    nome: "descrição longa quebrada em duas linhas",
    palavras: LAYOUT_DESCRICAO_EM_DUAS_LINHAS,
    emitente: "IMPORT PHONE PARTS",
    emitidaEm: "2026-11-02",
    itens: 2,
    produtosCentavos: null,
    freteCentavos: 0,
    descontoCentavos: 0,
    totalCentavos: 118_500,
  },
  {
    nome: "sem cifrão, quantidade fracionária e coluna de unidade",
    palavras: LAYOUT_SEM_CIFRAO_COM_UNIDADE,
    emitente: "QUIMICA ELETRONICA DO SUL",
    emitidaEm: "2026-11-01",
    itens: 3,
    produtosCentavos: 30_200,
    freteCentavos: 1_800,
    descontoCentavos: 0,
    totalCentavos: 32_000,
  },
];

describe.each(CASOS)("layout de fornecedor: $nome", (caso) => {
  const nota = lerNotaDePalavras(caso.palavras);

  it("lê todos os itens", () => {
    expect(nota.itens).toHaveLength(caso.itens);
  });

  it("identifica o fornecedor sem os dados do documento colados", () => {
    // O timbre junta nome, número e data numa linha só. O nome é o que vem
    // antes do primeiro marcador — não a linha inteira, e não a linha
    // seguinte quando a primeira é descartada.
    expect(nota.emitenteNome).toBe(caso.emitente);
    expect(nota.emitidaEm).toBe(caso.emitidaEm);
  });

  it("lê o fechamento, onde quer que ele esteja escrito", () => {
    expect(nota.valorProdutosCentavos).toBe(caso.produtosCentavos);
    expect(nota.valorFreteCentavos).toBe(caso.freteCentavos);
    expect(nota.valorDescontoCentavos).toBe(caso.descontoCentavos);
    expect(nota.valorTotalCentavos).toBe(caso.totalCentavos);
  });

  it("não perde nenhuma linha pelo caminho", () => {
    expect(nota.linhasIgnoradas).toEqual([]);
  });

  it("nenhum nome de produto carrega o timbre do fornecedor", () => {
    // O defeito que o layout sem cabeçalho revelou: todo produto saía com o
    // nome da loja e a data na frente, e ia assim pro cadastro.
    for (const item of nota.itens) {
      expect(item.descricao, item.descricao).not.toContain(caso.emitente);
      expect(item.descricao, item.descricao).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    }
  });

  it("A CONTA FECHA", () => {
    const conferencia = conferirNota(nota);

    expect(
      conferencia.problemas,
      `soma lida: ${formatarReais(conferencia.somaDosItensCentavos)}`
    ).toEqual([]);
    expect(conferencia.itensConferidos).toBe(caso.itens);
    expect(conferencia.fecha).toBe(true);
  });

  it("o total do documento bate com a soma das linhas mais frete menos desconto", () => {
    const soma = somar(...nota.itens.map((item) => item.valorTotalCentavos));
    const esperado = soma + caso.freteCentavos - caso.descontoCentavos;

    if (caso.totalCentavos !== null) {
      expect(Math.abs(esperado - caso.totalCentavos)).toBeLessThanOrEqual(nota.itens.length);
    }
  });
});

describe("o código do fornecedor é separado da descrição", () => {
  it("vira campo próprio, e não parte do nome do produto", () => {
    // Guardar o código importa: é por ele que a PRÓXIMA nota do mesmo
    // fornecedor casa com certeza, em vez de por semelhança de nome.
    const nota = lerNotaDePalavras(LAYOUT_COM_CODIGO_DO_FORNECEDOR);

    expect(nota.itens.map((item) => item.codigoFornecedor)).toEqual([
      "A-1001",
      "A-1002",
      "B-2010",
    ]);

    for (const item of nota.itens) {
      expect(item.descricao).not.toContain("-10");
      expect(item.descricao).not.toContain("B-2");
    }
  });
});

describe("descrição quebrada em duas linhas", () => {
  it("a segunda linha volta pro item de cima, e não vira grupo", () => {
    // O defeito que este caso revelou é o único das sete que a aritmética
    // NÃO pegaria: quantidade e valores certos, nomes trocados entre si.
    const nota = lerNotaDePalavras(LAYOUT_DESCRICAO_EM_DUAS_LINHAS);

    expect(nota.itens[0].descricao).toBe(
      "TELA OLED SAMSUNG GALAXY S21 ULTRA COM ARO E ADESIVO DE VEDACAO ORIGINAL"
    );
    expect(nota.itens[1].descricao).toBe(
      "BATERIA XIAOMI POCO X5 PRO ALTA CAPACIDADE SELO HOLOGRAFICO"
    );

    // E nada do nome de um item aparece no outro.
    expect(nota.itens[1].descricao).not.toContain("VEDACAO");
  });
});

describe("coluna de unidade", () => {
  it("vira campo próprio, e não prefixo do nome do produto", () => {
    const nota = lerNotaDePalavras(LAYOUT_SEM_CIFRAO_COM_UNIDADE);

    expect(nota.itens.map((item) => item.unidade)).toEqual(["KG", "MT", "LT"]);
    expect(nota.itens[0].descricao).toBe("FLUXO DE SOLDA EM PASTA");
    // Quantidade fracionária de insumo sobrevive: 2,500 kg são 2,5.
    expect(nota.itens[0].quantidade).toBe(2.5);
  });

  it("palavra curta que NÃO é unidade continua no nome", () => {
    // A lista de abreviações é fechada de propósito: solta, um produto
    // chamado "PC GAMER" perderia o "PC".
    const nota = lerNotaDePalavras([
      { texto: "QTD", x: 50, y: 700 },
      { texto: "DESCRIÇÃO", x: 150, y: 700 },
      { texto: "TOTAL", x: 400, y: 700 },
      { texto: "2", x: 50, y: 680 },
      { texto: "GAMER", x: 150, y: 680 },
      { texto: "MOUSE PAD", x: 200, y: 680 },
      { texto: "R$", x: 380, y: 680 },
      { texto: "30,00", x: 400, y: 680 },
      { texto: "R$", x: 450, y: 680 },
      { texto: "60,00", x: 470, y: 680 },
    ]);

    expect(nota.itens[0].descricao).toBe("GAMER MOUSE PAD");
    expect(nota.itens[0].unidade).toBeNull();
  });
});

describe("cabeçalho de tabela repetido", () => {
  it("não vira nome de grupo na segunda página", () => {
    const nota = lerNotaDePalavras(LAYOUT_DUAS_PAGINAS);

    for (const item of nota.itens) {
      expect(item.descricao, item.descricao).not.toMatch(/descri[çc][ãa]o/i);
      expect(item.descricao, item.descricao).not.toMatch(/unit[áa]rio/i);
    }

    // E os itens das duas páginas entram, na ordem.
    expect(nota.itens.map((item) => item.descricao)).toEqual([
      "CONECTOR DE CARGA MOTO G54",
      "ALTO FALANTE XIAOMI REDMI 12",
      "PARAFUSO PENTALOBE KIT 50UN",
      "COLA B7000 50ML",
      "ESTACAO DE SOLDA DIGITAL",
    ]);
  });
});
