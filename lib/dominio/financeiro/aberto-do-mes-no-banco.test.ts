import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GUARDA: o filtro no banco e a regra de dominio dizem a mesma coisa.
 *
 * Os cartoes "A receber" e "A pagar" filtram duas vezes: o `where` da
 * consulta evita trazer a tabela inteira, e `calcularAbertoDoMes` aplica a
 * regra de verdade. Sao duas copias da mesma decisao — "o que conta como
 * liquidado" — e duas copias divergem.
 *
 * Se alguem acrescentar um status liquidado so na regra, o banco passa a
 * trazer linhas que a regra descarta: inofensivo. O perigo e o contrario —
 * acrescentar so no `where` faria uma conta SUMIR do cartao sem que a regra
 * (a que tem testes) soubesse. Este teste trava as duas listas uma na outra.
 */
describe("cartoes de aberto do mes", () => {
  const fonte = readFileSync(join(process.cwd(), "app/actions/financeiro-hub.ts"), "utf8");

  function corpoDe(nome: string): string {
    const inicio = fonte.indexOf(`async function ${nome}(`);
    expect(inicio).toBeGreaterThan(-1);
    const fim = fonte.indexOf("\n}\n", inicio);
    return fonte.slice(inicio, fim);
  }

  const literais = (trecho: string) => [...trecho.matchAll(/"([A-Z_]+)"/g)].map((achado) => achado[1]).sort();

  it("A receber: os status excluidos no banco sao exatamente os que a regra chama de liquidados", () => {
    const corpo = corpoDe("obterReceberEmAberto");

    const noBanco = /status: \{ notIn: \[([^\]]+)\] \}/.exec(corpo)?.[1] ?? "";
    const naRegra = /liquidada: ([^\n]+)/.exec(corpo)?.[1] ?? "";

    expect(literais(noBanco)).toEqual(["ESTORNADO", "PAGO", "RECEBIDO"]);
    expect(literais(naRegra)).toEqual(literais(noBanco));
  });

  it("A pagar: idem", () => {
    const corpo = corpoDe("obterPagarEmAberto");

    const noBanco = /status: \{ not: ("[A-Z_]+") \}/.exec(corpo)?.[1] ?? "";
    const naRegra = /liquidada: ([^\n]+)/.exec(corpo)?.[1] ?? "";

    expect(literais(noBanco)).toEqual(["PAGO"]);
    expect(literais(naRegra)).toEqual(literais(noBanco));
  });

  it.each(["obterReceberEmAberto", "obterPagarEmAberto"])(
    "%s corta pela mesma data que a regra usa, e nao volta a ler a tabela inteira",
    (nome) => {
      const corpo = corpoDe(nome);

      expect(corpo).toContain("dataVencimento: { lte: ultimoDiaDoMesCorrente(fusoHorario) }");
      expect(corpo).toMatch(/findMany\(\{\s*where:/);
    }
  );

  it("a regra e a consulta tiram o corte da mesma funcao", () => {
    expect(corpoDe("abertoAteOFimDoMes")).toContain("const ultimoDia = ultimoDiaDoMesCorrente(fusoHorario);");
  });
});
