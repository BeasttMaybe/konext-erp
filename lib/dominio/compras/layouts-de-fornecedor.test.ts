import { describe, expect, it } from "vitest";

import { formatarReais, somar } from "@/lib/dinheiro";

import { LAYOUT_COLUNAS_SEM_CODIGO } from "./amostras/a-colunas-invertidas";
import { LAYOUT_SEM_CABECALHO_DE_TABELA } from "./amostras/b-sem-cabecalho";
import { LAYOUT_COM_CODIGO_DO_FORNECEDOR } from "./amostras/c-com-codigo";
import { lerNotaDePalavras, type PalavraPdf } from "./leitura-pdf";
import { conferirNota } from "./nota";

/**
 * Quatro fornecedores, quatro layouts.
 *
 * O orçamento da EA CENTRAL (em `leitura-pdf.test.ts`) é a nota real que
 * originou o parser, e passar nela não prova quase nada: todo parser passa
 * no documento que serviu de modelo. Estes três foram desenhados PARA
 * QUEBRÁ-LO, cada um mexendo numa suposição diferente — e os três quebraram,
 * de quatro jeitos distintos, na primeira vez que rodaram.
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
    produtosCentavos: null,
    freteCentavos: 2_000,
    descontoCentavos: 800,
    totalCentavos: 27_000,
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
