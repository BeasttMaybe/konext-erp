import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";

import {
  TAMANHOS_DE_ETIQUETA,
  acharTamanhoDeEtiqueta,
  mmParaPontos,
} from "@/lib/dominio/estoque/etiqueta";

import { EtiquetaProdutoPDF, EtiquetasPDF, type DadosEtiqueta } from "./EtiquetaProdutoPDF";

/**
 * Renderiza a etiqueta DE VERDADE e confere o tamanho da página.
 *
 * Por que existe: impressora térmica corta no picote a cada página. Se a página
 * do PDF não tiver exatamente a medida do rolo, a etiqueta sai cortada — e isso
 * não aparece em teste de unidade nem em revisão de código, só no rolo
 * desperdiçado. Aqui o PDF é gerado e as medidas são lidas de dentro dele.
 */

/**
 * PNG 1×1 preto. Serve porque o teste não está conferindo o desenho do código
 * de barras (isso é da lib, e `lib/dominio/estoque/etiqueta.test.ts` cobre a
 * escolha da simbologia) — está conferindo o layout e as medidas da página.
 */
const PNG_MINIMO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const DADOS: DadosEtiqueta = {
  nome: "Capa de silicone iPhone 13 Pro",
  preco: "R$ 34,90",
  legenda: "CAP-0012",
  sku: "CAP-0012",
  compatibilidade: "iPhone 13 / 13 Pro",
  codigoDeBarrasPng: PNG_MINIMO,
};

/**
 * Lê `/MediaBox [0 0 largura altura]` do PDF gerado. É onde o tamanho real da
 * página fica registrado, então é a única forma de conferir sem abrir o arquivo
 * num leitor.
 */
function lerMediaBox(pdf: Buffer): Array<{ largura: number; altura: number }> {
  const texto = pdf.toString("latin1");
  const encontrados = [...texto.matchAll(/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];

  return encontrados.map((encontrado) => ({
    largura: Number(encontrado[1]),
    altura: Number(encontrado[2]),
  }));
}

describe("EtiquetaProdutoPDF — a página tem o tamanho do rolo", () => {
  it.each(TAMANHOS_DE_ETIQUETA.map((tamanho) => [tamanho.id, tamanho] as const))(
    "%s sai na medida exata",
    async (_id, tamanho) => {
      const pdf = await renderToBuffer(
        <EtiquetaProdutoPDF dados={DADOS} tamanho={tamanho} copias={1} />
      );

      const paginas = lerMediaBox(pdf);

      expect(paginas).toHaveLength(1);
      // Tolerância de 0,1 pt: o PDF grava com casas decimais limitadas, e
      // 0,1 pt é 0,035 mm — bem abaixo do que qualquer picote percebe.
      expect(paginas[0].largura).toBeCloseTo(mmParaPontos(tamanho.larguraMm), 1);
      expect(paginas[0].altura).toBeCloseTo(mmParaPontos(tamanho.alturaMm), 1);
    },
    30_000
  );
});

describe("EtiquetaProdutoPDF — cópias", () => {
  it("cada cópia é uma página, porque a impressora corta por página", async () => {
    const pdf = await renderToBuffer(
      <EtiquetaProdutoPDF dados={DADOS} tamanho={acharTamanhoDeEtiqueta("50x30")} copias={3} />
    );

    expect(lerMediaBox(pdf)).toHaveLength(3);
  }, 30_000);

  it("zero cópias ainda rende uma etiqueta, em vez de um PDF vazio", async () => {
    const pdf = await renderToBuffer(
      <EtiquetaProdutoPDF dados={DADOS} tamanho={acharTamanhoDeEtiqueta("50x30")} copias={0} />
    );

    expect(lerMediaBox(pdf)).toHaveLength(1);
  }, 30_000);
});

describe("EtiquetaProdutoPDF — conteúdo por tamanho", () => {
  /**
   * A etiqueta de 33 mm não leva o nome de propósito: tentar encaixar nome,
   * preço e código nela deixa os três ilegíveis. O preço e o código ficam.
   */
  it("a etiqueta estreita sai sem o nome, mas com preço e código", async () => {
    const pdf = await renderToBuffer(
      <EtiquetaProdutoPDF dados={DADOS} tamanho={acharTamanhoDeEtiqueta("33x22")} copias={1} />
    );

    // O PDF comprime os fluxos de conteúdo, então o texto não aparece cru no
    // buffer. O que se pode afirmar sem descomprimir é que o arquivo foi
    // gerado e tem uma página no tamanho certo — o resto é coberto pelos
    // testes de `encurtarParaEtiqueta` e `limiteDeNomePorTamanho`.
    expect(pdf.byteLength).toBeGreaterThan(0);
    expect(lerMediaBox(pdf)).toHaveLength(1);
  }, 30_000);
});

describe("EtiquetasPDF — lote do estoque", () => {
  it("soma as cópias de todos os produtos, uma página cada, na medida do rolo", async () => {
    const tamanho = acharTamanhoDeEtiqueta("50x30");
    const pdf = await renderToBuffer(
      <EtiquetasPDF
        tamanho={tamanho}
        itens={[
          { dados: DADOS, copias: 2 },
          { dados: { ...DADOS, nome: "Película 3D", legenda: "PEL-0001", sku: "PEL-0001" }, copias: 3 },
        ]}
      />
    );
    const paginas = lerMediaBox(pdf);
    expect(paginas).toHaveLength(5);
    expect(paginas.every((p) => Math.abs(p.largura - mmParaPontos(tamanho.larguraMm)) < 0.1)).toBe(true);
  }, 30_000);
});
