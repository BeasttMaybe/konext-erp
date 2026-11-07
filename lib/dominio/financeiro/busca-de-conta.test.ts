import { describe, expect, it } from "vitest";

import { casaComBusca, prepararTermoDeBusca } from "./busca-de-conta";

const casa = (termo: string, ...campos: Array<string | null | undefined>) =>
  casaComBusca(prepararTermoDeBusca(termo), campos);

describe("busca nas listas do financeiro", () => {
  it("acha por pedaço do nome", () => {
    // É como a pessoa digita: lembra "intern", não "Internet Fibra 500MB".
    expect(casa("intern", "Internet Fibra 500MB")).toBe(true);
    expect(casa("fibra", "Internet Fibra 500MB")).toBe(true);
  });

  it("ignora acento e caixa", () => {
    // Em loja o mesmo fornecedor é digitado de três jeitos.
    expect(casa("vivo", "VÍVO TELEFONICA")).toBe(true);
    expect(casa("TELEFÔNICA", "vivo telefonica")).toBe(true);
    expect(casa("joao", "João da Silva")).toBe(true);
  });

  it("acha com as palavras em qualquer ordem", () => {
    // Quem lembra o sobrenome primeiro digita o sobrenome primeiro.
    expect(casa("silva joão", "João da Silva")).toBe(true);
    expect(casa("joão silva", "João da Silva")).toBe(true);
  });

  it("exige TODAS as palavras, não qualquer uma", () => {
    // Senão a busca por "aluguel loja" devolveria toda conta com "loja".
    expect(casa("aluguel loja", "Aluguel da loja")).toBe(true);
    expect(casa("aluguel internet", "Aluguel da loja")).toBe(false);
  });

  it("procura em todos os campos da linha", () => {
    expect(casa("vivo", "Internet", "VIVO S.A.")).toBe(true);
    expect(casa("internet vivo", "Internet", "VIVO S.A.")).toBe(true);
  });

  it("termo vazio não esconde nada", () => {
    // É o estado inicial do campo.
    for (const vazio of ["", "   ", "\t"]) {
      expect(casa(vazio, "qualquer coisa"), JSON.stringify(vazio)).toBe(true);
    }
  });

  it("campo nulo é ignorado em vez de virar texto", () => {
    // Sem isso, buscar "nul" acharia toda conta sem cliente.
    expect(casa("nul", "Internet", null)).toBe(false);
    expect(casa("nul", "Internet", undefined)).toBe(false);
    expect(casa("internet", "Internet", null, "")).toBe(true);
  });

  it("não acha o que não está lá", () => {
    expect(casa("aluguel", "Internet Fibra")).toBe(false);
  });

  it("espaço extra digitado não quebra a busca", () => {
    expect(casa("  silva   joão  ", "João da Silva")).toBe(true);
  });

  it("o termo é preparado uma vez e serve pra lista inteira", () => {
    // O motivo de `prepararTermoDeBusca` existir separado: numa lista de
    // centenas de linhas, normalizar o termo por linha é desperdício.
    const palavras = prepararTermoDeBusca("Peça OS");

    expect(palavras).toEqual(["peca", "os"]);
    expect(casaComBusca(palavras, ["Peça de OS #412"])).toBe(true);
    expect(casaComBusca(palavras, ["Aluguel"])).toBe(false);
  });

  it("plural não acha singular — é busca por pedaço, não por radical", () => {
    // Limite honesto e documentado: "peças" não acha "peça". Resolver isso
    // exigiria stemming de português, que erra de formas piores e mais
    // difíceis de explicar ("casa" achando "casamento"). Buscar pelo começo
    // da palavra funciona, e é o que a pessoa faz naturalmente.
    expect(casa("peças", "Peça de OS #412")).toBe(false);
    expect(casa("peç", "Peça de OS #412")).toBe(true);
  });
});
