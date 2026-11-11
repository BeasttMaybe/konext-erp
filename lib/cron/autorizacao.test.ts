import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { cronEstaProtegido, decidirAutorizacaoDoCron } from "./autorizacao";

describe("decidirAutorizacaoDoCron", () => {
  it("em producao, SEM segredo configurado, recusa — era aqui que a rota ficava aberta", () => {
    const decisao = decidirAutorizacaoDoCron({
      cabecalho: null,
      segredo: undefined,
      ambiente: "production",
    });

    expect(decisao).toEqual({
      autorizado: false,
      status: 503,
      erro: expect.stringContaining("CRON_SECRET"),
    });
  });

  it("segredo vazio ou so de espacos conta como ausente", () => {
    for (const segredo of ["", "   ", "\n"]) {
      const decisao = decidirAutorizacaoDoCron({
        cabecalho: "Bearer ",
        segredo,
        ambiente: "production",
      });

      expect(decisao.autorizado).toBe(false);
    }
  });

  it("um atacante nao entra mandando 'Bearer undefined' quando o segredo nao existe", () => {
    // O codigo antigo montava `Bearer ${cronSecret}` — com a variavel ausente
    // isso seria o texto "Bearer undefined". A checagem estava atras de um
    // `cronSecret &&`, entao nem chegava a comparar; aqui garante-se que
    // nenhum texto passa quando nao ha segredo.
    const decisao = decidirAutorizacaoDoCron({
      cabecalho: "Bearer undefined",
      segredo: undefined,
      ambiente: "production",
    });

    expect(decisao.autorizado).toBe(false);
  });

  it("com segredo, exige o cabecalho exato", () => {
    const base = { segredo: "s3gredo-longo", ambiente: "production" };

    expect(decidirAutorizacaoDoCron({ ...base, cabecalho: "Bearer s3gredo-longo" })).toEqual({
      autorizado: true,
    });

    for (const cabecalho of [null, "", "s3gredo-longo", "Bearer s3gredo-longo ", "bearer s3gredo-longo", "Bearer s3gredo"]) {
      expect(decidirAutorizacaoDoCron({ ...base, cabecalho })).toEqual({
        autorizado: false,
        status: 401,
        erro: "Não autorizado.",
      });
    }
  });

  it("fora de producao o segredo e opcional, mas se existir e exigido", () => {
    expect(
      decidirAutorizacaoDoCron({ cabecalho: null, segredo: undefined, ambiente: "development" })
    ).toEqual({ autorizado: true });

    expect(
      decidirAutorizacaoDoCron({ cabecalho: null, segredo: "abc", ambiente: "development" }).autorizado
    ).toBe(false);
  });
});

describe("cronEstaProtegido", () => {
  it("so e verdadeiro com segredo de verdade", () => {
    expect(cronEstaProtegido("abc")).toBe(true);
    expect(cronEstaProtegido("")).toBe(false);
    expect(cronEstaProtegido("  ")).toBe(false);
    expect(cronEstaProtegido(undefined)).toBe(false);
  });
});

/**
 * GUARDA: toda rota de cron passa pela decisao acima.
 *
 * A regra certa existir num arquivo nao adianta se a proxima rota de cron for
 * escrita copiando a checagem antiga de memoria. Este teste le as rotas.
 */
describe("rotas de cron", () => {
  const raiz = join(process.cwd(), "app/api/cron");
  const rotas = readdirSync(raiz).map((pasta) => ({
    pasta,
    fonte: readFileSync(join(raiz, pasta, "route.ts"), "utf8"),
  }));

  it("existem rotas para conferir", () => {
    expect(rotas.length).toBeGreaterThanOrEqual(3);
  });

  it.each(rotas)("$pasta usa decidirAutorizacaoDoCron", ({ fonte }) => {
    expect(fonte).toContain("decidirAutorizacaoDoCron(");
  });

  it.each(rotas)("$pasta nao compara o segredo por conta propria", ({ fonte }) => {
    // A forma antiga, que falhava aberta.
    expect(fonte).not.toMatch(/cronSecret\s*&&/);
    expect(fonte).not.toMatch(/!==\s*`Bearer/);
  });
});
